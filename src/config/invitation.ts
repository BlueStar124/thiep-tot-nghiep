export interface Invitation {
  graduateName: string
  degreeTitle: string // "Tân Kỹ sư" | "Tân Cử nhân"...
  faculty: string
  /** Ngày giờ bắt đầu lễ, dạng ISO giờ Việt Nam: 2026-11-15T07:30 */
  startISO: string
  /** Thời lượng dự kiến (phút) */
  durationMin: number
  ceremonyHall: string
  phone: string
  message: string
}

export const DEFAULT_INVITATION: Invitation = {
  graduateName: 'Nguyễn Xuân Cường',
  degreeTitle: 'Tân Cử nhân',
  faculty: 'Khoa Công nghệ Thông tin',
  startISO: '2026-11-18T16:00',
  durationMin: 240,
  ceremonyHall: 'Hội trường C – Lầu 3, Khu nhà C',
  phone: '0706608882',
  message:
    'Bốn năm thanh xuân dưới mái trường HUIT đã đến ngày hái quả ngọt. Sự có mặt của bạn là niềm vui và vinh dự lớn nhất trong ngày đặc biệt này!'
}

export const SCHOOL = {
  name: 'Trường Đại học Công Thương TP. Hồ Chí Minh',
  short: 'HUIT',
  address: '140 Lê Trọng Tấn, P. Tây Thạnh, Q. Tân Phú, TP. Hồ Chí Minh',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Tr%C6%B0%E1%BB%9Dng+%C4%90%E1%BA%A1i+h%E1%BB%8Dc+C%C3%B4ng+Th%C6%B0%C6%A1ng+TP.HCM+140+L%C3%AA+Tr%E1%BB%8Dng+T%E1%BA%A5n'
}

const KEY = 'huit_invitation_v3'

export function loadInvitation(): Invitation {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_INVITATION, ...JSON.parse(raw) }
  } catch {
    // bỏ qua
  }
  return DEFAULT_INVITATION
}

export function saveInvitation(inv: Invitation) {
  try {
    localStorage.setItem(KEY, JSON.stringify(inv))
  } catch {
    // bỏ qua
  }
}

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

/** Ngày giờ lễ hiển thị tiếng Việt (tính đúng thứ trong tuần) */
export function formatCeremony(inv: Invitation) {
  const [d, t] = inv.startISO.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = (t ?? '07:30').split(':').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]
  const end = hh * 60 + mm + inv.durationMin
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    weekday,
    date: `${pad(day)}/${pad(m)}/${y}`,
    day,
    month: m,
    year: y,
    time: `${pad(hh)}:${pad(mm)}`,
    endTime: `${pad(Math.floor(end / 60) % 24)}:${pad(end % 60)}`,
    arrive: `${pad(Math.floor((hh * 60 + mm - 30) / 60))}:${pad((hh * 60 + mm - 30 + 60) % 60)}`
  }
}

/** Mốc thời gian (ms) của giờ bắt đầu theo giờ Việt Nam (UTC+7) */
export function ceremonyTime(inv: Invitation) {
  return new Date(`${inv.startISO}:00+07:00`).getTime()
}
