import React, { useEffect, useRef, useState } from 'react'
import { Map as MapIcon, Navigation, Send, Volume2, VolumeX, ArrowUpDown, ChevronRight } from 'lucide-react'
import { CollageInvite } from './CollageInvite'
import { Countdown } from './Countdown'
import { FitText } from './ui/FitText'
import { RsvpSheet } from './Sheets'
import { SCHOOL, formatCeremony, type Invitation } from '../config/invitation'
import { soundEngine } from '../lib/music'

interface Props {
  inv: Invitation
  guestName?: string
  onOpenMap: () => void
  celebrate?: boolean
  /** Chừa chỗ dưới cùng (khi có nút nổi "Quay lại chỉnh sửa") */
  bottomSpace?: boolean
}

/** Pháo giấy: thư viện chỉ tải khi cần, không nằm trong lần tải đầu của trang */
function useCelebrate(enabled: boolean) {
  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let alive = true
    const id = setTimeout(async () => {
      const { default: confetti } = await import('canvas-confetti')
      if (alive) confetti({ particleCount: 110, spread: 75, origin: { y: 0.4 }, colors: ['#f4d23a', '#1f5fbf', '#111111', '#ffffff'] })
    }, 500)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [enabled])
}

/** Nút loa: tự phát nhạc ở lần chạm đầu, nhấp nháy mời bật khi chưa có nhạc */
function MusicButton() {
  const [playing, setPlaying] = useState(() => soundEngine.getPlaying())
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => soundEngine.subscribe(setPlaying), [])
  useEffect(() => soundEngine.armAutoplay((t) => !!btn.current && t instanceof Node && btn.current.contains(t)), [])
  return (
    <button
      ref={btn}
      onClick={() => soundEngine.toggle()}
      className={`zine-icon-btn ${!playing && !soundEngine.wasTouched() ? 'music-invite' : ''}`}
      aria-label={playing ? 'Tắt nhạc' : 'Bật nhạc'}
    >
      {playing ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
    </button>
  )
}

/** Trang khách mở link – cùng phong cách với thiệp collage: giấy xám, viền đen, nhãn pill */
export const InvitePage: React.FC<Props> = ({ inv, guestName, onOpenMap, celebrate = true, bottomSpace = false }) => {
  const [rsvpOpen, setRsvpOpen] = useState(false)
  const c = formatCeremony(inv)
  const phone = inv.phone.replace(/(\d{4})(\d{3})(\d+)/, '$1 $2 $3')
  useCelebrate(celebrate)

  return (
    <div className="paper-bg min-h-svh">
      <div className={`mx-auto w-full max-w-[1040px] px-4 sm:px-6 pt-[max(16px,env(safe-area-inset-top))] ${bottomSpace ? 'pb-28' : 'pb-[max(48px,env(safe-area-inset-bottom))]'}`}>
        {/* Thanh trên */}
        <header className="flex items-center gap-2.5 h-11">
          <span className="w-10 h-10 shrink-0 rounded-full bg-[#1f5fbf] text-white text-[11px] font-extrabold flex items-center justify-center tracking-tight">HUIT</span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold tracking-wide">LỄ TỐT NGHIỆP {c.year}</span>
          <button onClick={onOpenMap} className="h-11 shrink-0 px-3 sm:px-3.5 rounded-xl border-2 border-[#111] bg-white flex items-center gap-1.5 text-[13px] font-bold">
            <MapIcon className="w-4 h-4" /> Bản đồ
          </button>
          <MusicButton />
        </header>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-12 lg:items-start justify-center">
          {/* Thiệp */}
          <div className="w-full max-w-[460px] mx-auto animate-[rise_.6s_cubic-bezier(.2,.8,.2,1)]">
            <div className="rounded-[20px] border-2 border-[#111] overflow-hidden bg-white">
              <CollageInvite inv={inv} guestName={guestName} />
            </div>
          </div>

          {/* Thông tin & hành động */}
          <div className="w-full max-w-[460px] mx-auto lg:mx-0 lg:sticky lg:top-6 space-y-5 animate-[rise_.7s_.1s_cubic-bezier(.2,.8,.2,1)_both]">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-[.16em] text-[#333]">TRÂN TRỌNG KÍNH MỜI</p>
              {guestName && (
                <div className="mt-3">
                  <span className="name-tag max-w-full">
                    <span className="break-words">{guestName}</span>
                  </span>
                  <p className="mt-3 text-[15px] text-[#333]">đến dự Lễ Tốt nghiệp của</p>
                </div>
              )}
              {/* Tên luôn nằm trên 1 hàng: tự thu nhỏ theo độ dài tên và bề rộng màn hình */}
              <FitText as="h1" max={40} min={18} className="mt-2 font-black leading-[1.08] tracking-tight uppercase">
                {inv.graduateName}
              </FitText>
              <p className="mt-2 text-[15px] font-medium text-[#333]">
                {inv.degreeTitle} · {inv.faculty}
              </p>
            </div>

            <Countdown inv={inv} />

            {/* 3 dòng thông tin, giống 3 cột trên thiệp */}
            <div className="zine-box divide-y-2 divide-[#111]">
              <InfoRow label="Thời gian" title={`${c.time} · ${c.weekday}, ${c.date}`} sub={`Vui lòng có mặt trước ${c.arrive}`} />
              <InfoRow label="Địa điểm" title={inv.ceremonyHall} sub={SCHOOL.address} />
              <InfoRow label="Liên hệ" title={phone} sub="Gọi điện hoặc nhắn Zalo" href={`tel:${inv.phone.replace(/\D/g, '')}`} />
            </div>

            {/* Mở bản đồ – kiểu biển chỉ đường */}
            <button onClick={onOpenMap} className="zine-sign">
              <span className="w-12 h-9 shrink-0 rounded-lg border-2 border-white flex items-center justify-center" aria-hidden>
                <ArrowUpDown className="w-5 h-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[clamp(15px,4.4vw,17px)] font-black tracking-wide">MỞ BẢN ĐỒ ĐƯỜNG ĐI</span>
                <span className="block text-[13px] text-white/85 text-balance">{'Sa bàn 3D từ cổng trường tới Hội\u00a0trường\u00a0C'}</span>
              </span>
              <ChevronRight className="w-5 h-5 shrink-0" />
            </button>

            <div className="space-y-3 pt-1">
              <button onClick={() => setRsvpOpen(true)} className="zine-btn zine-btn--yellow w-full text-[clamp(14px,4.2vw,16px)]">
                <Send className="w-5 h-5 shrink-0" /> Xác nhận tham dự & gửi lời chúc
              </button>
              <a href={SCHOOL.mapsUrl} target="_blank" rel="noopener noreferrer" className="zine-btn w-full text-[15px]">
                <Navigation className="w-4 h-4" /> Chỉ đường Google Maps
              </a>
            </div>

            <p className="pt-1 text-center text-[13px] italic text-[#444] leading-relaxed text-pretty">“{inv.message}”</p>
          </div>
        </div>
      </div>

      <RsvpSheet open={rsvpOpen} onClose={() => setRsvpOpen(false)} invitation={inv} defaultName={guestName} />
    </div>
  )
}

/**
 * Chỉ cho xuống dòng ở dấu phẩy / gạch nối: "TP. Hồ Chí Minh" không bị tách thành "TP. Hồ / Chí Minh".
 * Cụm quá dài (>22 ký tự) vẫn được ngắt bình thường để không tràn trên máy hẹp.
 */
const keepPhrases = (text: string) =>
  text
    .split(/(, | – )/)
    .map((s, i) => (i % 2 === 1 || s.length > 22 ? s : s.replace(/ /g, ' ')))
    .join('')

const InfoRow: React.FC<{ label: string; title: string; sub: string; href?: string }> = ({ label, title, sub, href }) => {
  const body = (
    <>
      <span className="zine-pill w-[78px] justify-center shrink-0 mt-0.5">{label}</span>
      <span className="min-w-0">
        <span className="block text-[15px] font-extrabold leading-snug break-words text-balance">{keepPhrases(title)}</span>
        {/* text-balance: các dòng dài gần bằng nhau, không còn 1–2 chữ lẻ loi ở dòng cuối */}
        <span className="block text-[13px] text-[#444] leading-snug mt-0.5 text-balance">{keepPhrases(sub)}</span>
      </span>
    </>
  )
  return href ? (
    <a href={href} className="flex items-start gap-3 px-4 py-3.5 hover:bg-[#fafaf7] first:rounded-t-[12px] last:rounded-b-[12px]">
      {body}
    </a>
  ) : (
    <div className="flex items-start gap-3 px-4 py-3.5">{body}</div>
  )
}
