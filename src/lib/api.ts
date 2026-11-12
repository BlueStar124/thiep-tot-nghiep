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

export function fetchInvite(slug: string) {
  return call<PublishedInvite>(`/api/invite?slug=${encodeURIComponent(slug)}`)
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
    res = owner ? await post({ slug: owner.slug, editKey: owner.editKey, invitation, guests: guestNames, newSlug }) : await post({ desiredSlug, invitation, guests: guestNames })
  } catch (err) {
    // Thiệp cũ không còn trên máy chủ → tạo link mới, giữ tên link cũ nếu còn trống
    if (owner && (err as { status?: number }).status === 404) {
      forgetOwner()
      res = await post({ desiredSlug: owner.slug, invitation, guests: guestNames })
    } else throw err
  }
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
