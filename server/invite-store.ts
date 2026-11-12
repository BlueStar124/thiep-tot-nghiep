/**
 * Logic lưu/đọc thiệp, dùng chung cho:
 *  - api/invite.ts (chạy trên Vercel, lưu vào Upstash Redis)
 *  - vite.config.ts (chạy thử trên máy, lưu vào file .data/invites.json)
 */
import { assignGuestSlugs, ownerSlugFrom, slugDisplay, SLUG_RE, RESERVED_SLUGS, type Guest } from '../src/lib/slug.js'

export interface KV {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

interface StoredInvite {
  /** Khoá lưu trong database: chữ thường */
  slug: string
  /** Tên link hiển thị, giữ chữ hoa: "XuanCuong" */
  display?: string
  invitation: Record<string, string | number>
  guests: Guest[]
  keyHash: string
  /** Khoá sửa cấp thêm khi chủ thiệp đăng nhập bằng mật khẩu trên máy khác (giữ 5 khoá gần nhất) */
  extraKeyHashes?: string[]
  createdAt: number
  updatedAt: number
}

/**
 * Mật khẩu chủ thiệp (biến môi trường ADMIN_PASSWORD trên Vercel):
 *  - 'open'        : chạy thử trên máy, không cần mật khẩu
 *  - { password }  : cần đúng mật khẩu để tạo thiệp / lấy lại quyền sửa; password trống = chưa đặt → khoá hết
 */
export type Auth = 'open' | { password?: string }

export interface ApiResult {
  status: number
  body: unknown
}

const KEY = (slug: string) => `invite:${slug.toLowerCase()}`

/**
 * Link đã đổi tên/gỡ: chỉ còn trỏ sang link mới.
 *  - hidden = false: khách mở link cũ vẫn tự chuyển sang link mới
 *  - hidden = true : link cũ coi như đã xoá (khách thấy "không tìm thấy"), chỉ chủ thiệp được dẫn sang link mới
 */
interface Moved {
  movedTo: string
  hidden?: boolean
}

const TEXT_FIELDS: Record<string, number> = {
  graduateName: 80,
  degreeTitle: 40,
  faculty: 120,
  ceremonyHall: 120,
  phone: 20,
  message: 300
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Có phải khoá sửa của thiệp này không */
async function ownsKey(rec: StoredInvite, editKey: unknown) {
  if (typeof editKey !== 'string' || !editKey) return false
  const h = await sha256(editKey)
  return h === rec.keyHash || (rec.extraKeyHashes ?? []).includes(h)
}

/** So mật khẩu qua mã băm, so từng ký tự đủ cả chuỗi để thời gian so sánh không lộ ký tự đúng */
async function checkPassword(auth: Auth, given: unknown): Promise<ApiResult | null> {
  if (auth === 'open') return null
  if (!auth.password) return { status: 503, body: { error: 'Chưa đặt mật khẩu chủ thiệp (ADMIN_PASSWORD) trên Vercel' } }
  if (typeof given !== 'string' || given.length > 200) return { status: 401, body: { error: 'Sai mật khẩu' } }
  const [a, b] = await Promise.all([sha256('huit:' + given), sha256('huit:' + auth.password)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0 ? null : { status: 401, body: { error: 'Sai mật khẩu' } }
}

function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function cleanInvitation(raw: unknown): Record<string, string | number> | string {
  if (!raw || typeof raw !== 'object') return 'Thiếu nội dung thiệp'
  const src = raw as Record<string, unknown>
  const out: Record<string, string | number> = {}
  for (const [field, max] of Object.entries(TEXT_FIELDS)) {
    const v = src[field]
    if (typeof v !== 'string') return `Thiếu trường ${field}`
    out[field] = v.trim().slice(0, max)
  }
  if (!out.graduateName) return 'Chưa có họ tên'
  const start = src.startISO
  if (typeof start !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) return 'Ngày giờ lễ không hợp lệ'
  out.startISO = start
  const dur = Number(src.durationMin)
  out.durationMin = Number.isFinite(dur) ? Math.min(720, Math.max(30, Math.round(dur))) : 240
  return out
}

type Record_ = StoredInvite | Moved
const isMoved = (r: Record_): r is Moved => typeof (r as Moved).movedTo === 'string'
const shown = (r: StoredInvite) => r.display ?? r.slug

async function readRaw(kv: KV, slug: string): Promise<Record_ | null> {
  const raw = await kv.get(KEY(slug))
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record_
  } catch {
    return null
  }
}

/** Đọc thiệp, đi theo các lần đổi tên (tối đa 5 bước). forOwner = true thì đi qua cả link đã gỡ. */
async function readInvite(kv: KV, slug: string, forOwner = false): Promise<StoredInvite | null> {
  let cur = slug
  for (let i = 0; i < 5; i++) {
    const rec = await readRaw(kv, cur)
    if (!rec) return null
    if (!isMoved(rec)) return rec
    if (rec.hidden && !forOwner) return null
    cur = rec.movedTo
  }
  return null
}

/**
 * GET /api/invite?slug=XuanCuong&guest=co-lan → nội dung thiệp + đúng khách đó.
 * Không trả cả danh sách khách: người có link không xem được còn mời những ai.
 */
export async function getInvite(kv: KV, slug: string | null, guestSlug?: string | null): Promise<ApiResult> {
  if (!slug || !SLUG_RE.test(slug.toLowerCase())) return { status: 400, body: { error: 'Link không hợp lệ' } }
  const rec = await readInvite(kv, slug)
  if (!rec) return { status: 404, body: { error: 'Không tìm thấy thiệp' } }
  const guest = guestSlug ? rec.guests.find((g) => g.slug === guestSlug.toLowerCase()) : undefined
  return { status: 200, body: { slug: shown(rec), invitation: rec.invitation, guests: guest ? [guest] : [] } }
}

/** Kiểm tra tên link mới: hợp lệ, không trùng từ khoá hệ thống */
function checkSlug(raw: string): { display: string; key: string } | string {
  const display = slugDisplay(raw)
  const key = display.toLowerCase()
  if (!display || !SLUG_RE.test(key)) return 'Tên link chỉ gồm chữ không dấu, số và dấu gạch ngang (2–40 ký tự)'
  if (RESERVED_SLUGS.has(key)) return 'Tên link này hệ thống đang dùng, hãy chọn tên khác'
  return { display, key }
}

/**
 * POST /api/invite
 *  - Tạo mới:   { password, invitation, guests: string[], desiredSlug? } → trả về slug + editKey (chỉ trả 1 lần)
 *  - Cập nhật:  { slug, editKey, invitation, guests, newSlug? } → cần đúng khoá sửa; newSlug = đổi tên link
 *  - Hỏi lại:   { action: 'resolve', slug, editKey } → tên link hiện tại (khi đã đổi tên ở nơi khác)
 *  - Đăng nhập: { action: 'login', password, slug? } → mở trình tạo thiệp; có slug thì cấp khoá sửa mới cho máy này
 */
export async function saveInvite(kv: KV, payload: unknown, auth: Auth = 'open'): Promise<ApiResult> {
  if (!payload || typeof payload !== 'object') return { status: 400, body: { error: 'Dữ liệu không hợp lệ' } }
  const p = payload as Record<string, unknown>
  const now = Date.now()

  // Chủ thiệp nhập mật khẩu → mở trình tạo thiệp; có tên link thì cấp khoá sửa mới cho máy này
  if (p.action === 'login') {
    const denied = await checkPassword(auth, p.password)
    if (denied) return denied
    const rec = typeof p.slug === 'string' && SLUG_RE.test(p.slug.toLowerCase()) ? await readInvite(kv, p.slug, true) : null
    if (!rec) return { status: 200, body: { ok: true } }
    const editKey = randomKey()
    const extraKeyHashes = [...(rec.extraKeyHashes ?? []), await sha256(editKey)].slice(-5)
    await kv.set(KEY(rec.slug), JSON.stringify({ ...rec, extraKeyHashes } satisfies StoredInvite))
    return { status: 200, body: { ok: true, slug: shown(rec), editKey, invitation: rec.invitation, guests: rec.guests } }
  }

  // Chủ thiệp hỏi tên link hiện tại
  if (p.action === 'resolve') {
    if (typeof p.slug !== 'string' || typeof p.editKey !== 'string') return { status: 400, body: { error: 'Thiếu thông tin' } }
    const rec = await readInvite(kv, p.slug, true)
    if (!rec) return { status: 404, body: { error: 'Không tìm thấy thiệp' } }
    if (!(await ownsKey(rec, p.editKey))) return { status: 403, body: { error: 'Không có quyền sửa thiệp này' } }
    return { status: 200, body: { slug: shown(rec) } }
  }

  const invitation = cleanInvitation(p.invitation)
  if (typeof invitation === 'string') return { status: 400, body: { error: invitation } }

  const names = Array.isArray(p.guests) ? p.guests.filter((g): g is string => typeof g === 'string') : []
  if (names.length > 300) return { status: 400, body: { error: 'Tối đa 300 khách mời' } }
  const guests = assignGuestSlugs(names)

  // Cập nhật thiệp đã có (có thể kèm đổi tên link)
  if (typeof p.slug === 'string' && p.slug) {
    const rec = await readInvite(kv, p.slug, true)
    if (!rec) return { status: 404, body: { error: 'Không tìm thấy thiệp để cập nhật' } }
    if (!(await ownsKey(rec, p.editKey))) return { status: 403, body: { error: 'Không có quyền sửa thiệp này' } }

    let next: StoredInvite = { ...rec, invitation, guests, updatedAt: now }
    if (typeof p.newSlug === 'string' && p.newSlug.trim()) {
      const checked = checkSlug(p.newSlug)
      if (typeof checked === 'string') return { status: 400, body: { error: checked } }
      if (checked.key !== rec.slug) {
        if (await kv.get(KEY(checked.key))) return { status: 409, body: { error: 'Tên link đã có người dùng, hãy chọn tên khác' } }
        // Link cũ trỏ sang link mới → ai đã nhận link cũ vẫn mở được
        await kv.set(KEY(rec.slug), JSON.stringify({ movedTo: checked.key } satisfies Moved))
      }
      next = { ...next, slug: checked.key, display: checked.display }
    }
    await kv.set(KEY(next.slug), JSON.stringify(next))
    return { status: 200, body: { slug: shown(next), guests } }
  }

  // Tạo mới: chỉ chủ thiệp (đúng mật khẩu); tìm tên link còn trống (XuanCuong, XuanCuong-2, …)
  const denied = await checkPassword(auth, p.password)
  if (denied) return denied
  const wanted = typeof p.desiredSlug === 'string' ? checkSlug(p.desiredSlug) : null
  const base = wanted && typeof wanted !== 'string' ? wanted.display : ownerSlugFrom(String(invitation.graduateName))
  let display = ''
  for (let i = 1; i <= 60; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`
    const key = candidate.toLowerCase()
    if (RESERVED_SLUGS.has(key) || !SLUG_RE.test(key)) continue
    if (!(await kv.get(KEY(key)))) {
      display = candidate
      break
    }
  }
  if (!display) return { status: 409, body: { error: 'Tên link đã có người dùng, hãy chọn tên khác' } }

  const editKey = randomKey()
  const rec: StoredInvite = { slug: display.toLowerCase(), display, invitation, guests, keyHash: await sha256(editKey), createdAt: now, updatedAt: now }
  await kv.set(KEY(rec.slug), JSON.stringify(rec))
  return { status: 201, body: { slug: display, guests, editKey } }
}
