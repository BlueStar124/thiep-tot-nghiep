import type { Invitation } from '../config/invitation'
import type { Guest } from './slug'

export interface PublishedInvite {
  slug: string
  invitation: Invitation
  guests: Guest[]
}

/** Thông tin chủ thiệp lưu trên máy này: tên link + khoá sửa (không gửi cho khách) */
export interface Owner {
  slug: string
  editKey: string
}

const OWNER_KEY = 'huit_owner_v1'
const GUESTS_KEY = 'huit_guests_v1'
/** Mật khẩu chủ thiệp – chỉ giữ trong phiên (đóng tab là quên), dùng khi tạo thiệp mới */
const ADMIN_KEY = 'huit_admin_v1'

function adminPassword(): string | undefined {
  try {
    return sessionStorage.getItem(ADMIN_KEY) ?? undefined
  } catch {
    return undefined
  }
}

/** Máy này được vào trình tạo thiệp chưa: đã có khoá sửa thiệp, hoặc vừa nhập đúng mật khẩu */
export function isUnlocked() {
  return !!loadOwner() || !!adminPassword()
}

export function loadOwner(): Owner | null {
  try {
    const raw = localStorage.getItem(OWNER_KEY)
    return raw ? (JSON.parse(raw) as Owner) : null
  } catch {
    return null
  }
}

function saveOwner(owner: Owner) {
  try {
    localStorage.setItem(OWNER_KEY, JSON.stringify(owner))
  } catch {
    // bỏ qua
  }
}

export function loadGuestNames(): string[] {
  try {
    const raw = localStorage.getItem(GUESTS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveGuestNames(names: string[]) {
  try {
    localStorage.setItem(GUESTS_KEY, JSON.stringify(names))
  } catch {
    // bỏ qua
  }
}

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(input, init)
  } catch {
    throw new Error('Không kết nối được máy chủ, kiểm tra mạng rồi thử lại')
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw Object.assign(new Error(body.error ?? `Lỗi ${res.status}`), { status: res.status })
  return body as T
}

/** Khách mở link: chỉ hỏi đúng tên mình, máy chủ không trả cả danh sách khách */
export function fetchInvite(slug: string, guestSlug?: string) {
  const q = `slug=${encodeURIComponent(slug)}${guestSlug ? `&guest=${encodeURIComponent(guestSlug)}` : ''}`
  return call<PublishedInvite>(`/api/invite?${q}`)
}

/**
 * Chủ thiệp nhập mật khẩu. Nếu đã có thiệp ở tên link này → máy này được cấp quyền sửa,
 * nội dung thiệp + danh sách khách được tải về để sửa tiếp.
 */
export async function login(password: string, slug?: string): Promise<{ invitation?: Partial<Invitation> }> {
  const res = await call<{ ok: true; slug?: string; editKey?: string; invitation?: Partial<Invitation>; guests?: Guest[] }>('/api/invite', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'login', password, slug: slug || undefined })
  })
  try {
    sessionStorage.setItem(ADMIN_KEY, password)
  } catch {
    // bỏ qua
  }
  if (res.slug && res.editKey) {
    saveOwner({ slug: res.slug, editKey: res.editKey })
    saveGuestNames((res.guests ?? []).map((g) => g.name))
  }
  return { invitation: res.invitation }
}

/** Bản đã lưu lên máy chủ gần nhất – để biết còn thay đổi nào chưa lưu */
const SAVED_KEY = 'huit_saved_v1'
const snapshot = (invitation: Invitation, guestNames: string[]) => JSON.stringify({ invitation, guestNames })

function markSaved(invitation: Invitation, guestNames: string[]) {
  try {
    localStorage.setItem(SAVED_KEY, snapshot(invitation, guestNames))
  } catch {
    // bỏ qua
  }
}

/** Nội dung/danh sách khách trên máy này có khác bản đã lưu lên máy chủ không */
export function hasUnsaved(invitation: Invitation, guestNames: string[]) {
  try {
    return localStorage.getItem(SAVED_KEY) !== snapshot(invitation, guestNames)
  } catch {
    return true
  }
}

/** Lưu thiệp lên máy chủ: lần đầu tạo link mới, các lần sau cập nhật đúng link cũ */
export async function publishInvite(invitation: Invitation, guestNames: string[], desiredSlug?: string, newSlug?: string): Promise<{ slug: string; guests: Guest[] }> {
  const owner = loadOwner()
  const post = (body: object) =>
    call<{ slug: string; guests: Guest[]; editKey?: string }>('/api/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  let res
  try {
    res = owner
      ? await post({ slug: owner.slug, editKey: owner.editKey, invitation, guests: guestNames, newSlug })
      : await post({ desiredSlug, invitation, guests: guestNames, password: adminPassword() })
  } catch (err) {
    // Thiệp cũ không còn trên máy chủ → tạo link mới, giữ tên link cũ nếu còn trống
    if (owner && (err as { status?: number }).status === 404) {
      forgetOwner()
      res = await post({ desiredSlug: owner.slug, invitation, guests: guestNames, password: adminPassword() })
    } else throw err
  }
  markSaved(invitation, guestNames)
  if (res.editKey) saveOwner({ slug: res.slug, editKey: res.editKey })
  else if (owner && res.slug !== owner.slug) saveOwner({ slug: res.slug, editKey: owner.editKey }) // đã đổi tên link
  return res
}

/** Hỏi máy chủ tên link hiện tại của thiệp (khi đã đổi tên ở nơi khác) và cập nhật lại trên máy này */
export async function refreshOwner(): Promise<Owner | null> {
  const owner = loadOwner()
  if (!owner) return null
  try {
    const res = await call<{ slug: string }>('/api/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', slug: owner.slug, editKey: owner.editKey })
    })
    if (res.slug !== owner.slug) {
      const next = { ...owner, slug: res.slug }
      saveOwner(next)
      return next
    }
  } catch {
    // mất mạng hoặc chưa bật database → giữ nguyên
  }
  return owner
}

function forgetOwner() {
  try {
    localStorage.removeItem(OWNER_KEY)
  } catch {
    // bỏ qua
  }
}

export const inviteUrl = (slug: string, guestSlug?: string) => `${location.origin}/${slug}${guestSlug ? `/${guestSlug}` : ''}`

/** Một lời chúc (giống server/invite-store.ts) */
export interface Wish {
  id: string
  name: string
  guestName?: string
  attending: boolean
  people: number
  message: string
  at: number
}

const postJson = <T>(body: object) =>
  call<T>('/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

/** Khách gửi lời chúc: lưu thẳng vào database của thiệp */
export function sendWish(slug: string, guestSlug: string | undefined, data: { name: string; attending: boolean; people: number; message: string; website?: string }) {
  return postJson<{ ok: true }>({ action: 'wish', slug, guest: guestSlug, ...data })
}

/** Chủ thiệp đọc lời chúc (mới nhất trước) – cần khoá sửa trên máy này */
export async function fetchWishes(): Promise<Wish[]> {
  const owner = loadOwner()
  if (!owner) throw Object.assign(new Error('Máy này chưa có quyền chủ thiệp'), { status: 403 })
  const res = await postJson<{ wishes: Wish[] }>({ action: 'wishes', slug: owner.slug, editKey: owner.editKey })
  return res.wishes
}

export async function deleteWish(id: string) {
  const owner = loadOwner()
  if (!owner) throw new Error('Máy này chưa có quyền chủ thiệp')
  await postJson({ action: 'deleteWish', slug: owner.slug, editKey: owner.editKey, id })
}
