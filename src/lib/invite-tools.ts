import { useEffect, useState } from 'react'
import { SCHOOL, ceremonyTime, formatCeremony, type Invitation } from '../config/invitation'

const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function googleCalendarUrl(inv: Invitation) {
  const start = ceremonyTime(inv)
  const end = start + inv.durationMin * 60_000
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Lễ tốt nghiệp của ${inv.graduateName} – HUIT`,
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    details: `${inv.ceremonyHall}. Vui lòng có mặt trước 30 phút.`,
    location: SCHOOL.address
  })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

export function downloadIcs(inv: Invitation) {
  const start = ceremonyTime(inv)
  const end = start + inv.durationMin * 60_000
  const esc = (s: string) => s.replace(/([,;])/g, '\\$1')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HUIT//Thiep tot nghiep//VI',
    'BEGIN:VEVENT',
    `UID:${start}-huit@thiep`,
    `DTSTAMP:${utcStamp(Date.now())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${esc(`Lễ tốt nghiệp của ${inv.graduateName} – HUIT`)}`,
    `LOCATION:${esc(`${inv.ceremonyHall}, ${SCHOOL.address}`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Sắp tới giờ dự lễ tốt nghiệp',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'le-tot-nghiep-huit.ics'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Đọc link kiểu cũ ?t=… (nội dung nằm trong link) – giữ lại để link đã gửi trước đây vẫn mở được */
export function invitationFromUrl(): Partial<Invitation> | null {
  try {
    const t = new URLSearchParams(location.search).get('t')
    if (!t) return null
    const bin = atob(t.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
  } catch {
    return null
  }
}

export function useCountdown(inv: Invitation) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const diff = Math.max(0, ceremonyTime(inv) - now)
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    done: diff === 0
  }
}

export function rsvpMessage(inv: Invitation, r: { name: string; going: boolean; people: number; wish: string }) {
  const c = formatCeremony(inv)
  return r.going
    ? `Chúc mừng ${inv.graduateName}! Mình là ${r.name}, sẽ đến dự lễ tốt nghiệp lúc ${c.time} ${c.weekday} ${c.date} (${r.people} người). ${r.wish}`.trim()
    : `Chúc mừng ${inv.graduateName}! Mình là ${r.name}, tiếc là không đến dự được. ${r.wish}`.trim()
}
