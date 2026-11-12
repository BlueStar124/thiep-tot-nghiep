import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ChevronDown, ChevronUp, Clock, MapPin, Navigation, Smartphone, X, PanelBottomOpen } from 'lucide-react'
import { SceneCanvas } from './SceneCanvas'
import { CHAPTERS } from '../config/campus'
import { SCHOOL, formatCeremony, type Invitation } from '../config/invitation'

const LAST = CHAPTERS.length - 1

/** Sa bàn 3D + các chặng đường đi — chỉ dựng khi khách bấm "Mở bản đồ" */
export const MapTour: React.FC<{ inv: Invitation; onClose: () => void }> = ({ inv, onClose }) => {
  const [active, setActive] = useState(0)
  // Ẩn thẻ chữ để xem sa bàn cho thoáng; lúc ẩn thì điều hướng bằng mũi tên lên/xuống
  const [cardsHidden, setCardsHidden] = useState(false)
  const sections = useRef<(HTMLElement | null)[]>([])
  const progress = useRef(0)
  const c = formatCeremony(inv)

  // Cuộn theo chặng chỉ khi đang xem bản đồ
  useEffect(() => {
    const html = document.documentElement
    html.classList.add('snap')
    window.scrollTo(0, 0)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      html.classList.remove('snap')
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Tiến trình cuộn (số thực theo vị trí các chương) — đọc mỗi khung hình bởi cảnh 3D
  const getProgress = useCallback(() => progress.current, [])
  useEffect(() => {
    let tops: number[] = []
    const measure = () => {
      tops = sections.current.map((s) => s?.offsetTop ?? 0)
    }
    const update = () => {
      const y = window.scrollY
      if (!tops.length) measure()
      let i = 0
      while (i < tops.length - 1 && y >= tops[i + 1]) i++
      const span = i < tops.length - 1 ? tops[i + 1] - tops[i] : 1
      const p = i >= tops.length - 1 ? LAST : i + Math.min(1, Math.max(0, (y - tops[i]) / span))
      progress.current = p
      const a = Math.round(p)
      setActive((prev) => (prev === a ? prev : a))
    }
    const onResize = () => {
      measure()
      update()
    }
    onResize()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Chặng vừa được chọn (trong lúc camera còn đang bay tới) – để bấm liên tiếp vẫn đi đúng từng chặng
  const [pending, setPending] = useState<number | null>(null)
  useEffect(() => {
    if (pending !== null && active === pending) setPending(null)
  }, [active, pending])
  // Khách tự cuộn/vuốt → bỏ chặng đang chờ, theo đúng vị trí đang đứng
  useEffect(() => {
    const clear = () => setPending(null)
    window.addEventListener('wheel', clear, { passive: true })
    window.addEventListener('touchstart', clear, { passive: true })
    return () => {
      window.removeEventListener('wheel', clear)
      window.removeEventListener('touchstart', clear)
    }
  }, [])
  const goTo = (i: number) => {
    const n = Math.max(0, Math.min(LAST, i))
    setPending(n)
    sections.current[n]?.scrollIntoView({ behavior: 'smooth' })
  }
  const current = pending ?? active
  const hideCards = () => setCardsHidden(true)
  const cardClass = `card relative ${cardsHidden ? 'invisible' : ''}`
  const stepLabel = current === 0 ? 'Toàn cảnh' : current === LAST ? 'Đã tới nơi' : CHAPTERS[current].title

  // Phím mũi tên lên/xuống để chuyển chặng
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        goTo(current + (e.key === 'ArrowDown' ? 1 : -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="animate-[fade_.35s_ease-out]">
      <SceneCanvas invitation={inv} getProgress={getProgress} onLabelClick={goTo} cardsHidden={cardsHidden} />

      <header className="fixed top-0 inset-x-0 z-40 px-4 sm:px-6 pt-4 flex items-center gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-white/90 backdrop-blur shadow-card pl-1.5 pr-4 h-11">
          <span className="w-8 h-8 rounded-full bg-[#1d4ed8] text-white text-[11px] font-extrabold flex items-center justify-center tracking-tight">HUIT</span>
          <span className="text-[13px] font-bold text-slate-900 whitespace-nowrap">Đường tới hội trường</span>
        </div>
        <button onClick={onClose} className="pointer-events-auto ml-auto h-11 pl-3 pr-4 rounded-full bg-slate-900 text-white text-[13px] font-bold shadow-card flex items-center gap-1.5 whitespace-nowrap">
          <X className="w-4 h-4" /> Về thiệp
        </button>
      </header>

      <nav className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-30 flex-col gap-3" aria-label="Các chặng">
        {CHAPTERS.map((ch, i) => (
          <button key={ch.id} onClick={() => goTo(i)} className="group flex items-center justify-end gap-3" aria-current={active === i}>
            <span className={`text-[12px] font-semibold transition-opacity ${active === i ? 'opacity-100 text-slate-900' : 'opacity-0 group-hover:opacity-100 text-slate-500'}`}>
              {i === 0 ? 'Toàn cảnh' : i === LAST ? 'Đã tới nơi' : ch.title}
            </span>
            <span className={`rounded-full transition-all ${active === i ? 'w-3 h-3 bg-red-600' : 'w-2 h-2 bg-slate-400/70'}`} />
          </button>
        ))}
      </nav>

      <main className="relative z-20">
        {CHAPTERS.map((ch, i) => (
          <section
            key={ch.id}
            ref={(el) => {
              sections.current[i] = el
            }}
            className="chapter"
          >
            {i === 0 ? (
              <div className={cardClass} data-show={active === 0}>
                <CloseCard onClick={hideCards} />
                <p className="kicker pr-10">Sa bàn HUIT · 140 Lê Trọng Tấn</p>
                <h2 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-slate-900 mt-1.5 leading-tight">Đường tới Hội trường C</h2>
                <p className="mt-2.5 text-[15px] text-slate-600 leading-relaxed">5 chặng ngắn từ cổng trường tới nơi làm lễ. Bấm vào tên toà nhà để nhảy tới chặng đó.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="chip"><Clock className="w-4 h-4" /> Có mặt trước {c.arrive}</span>
                  <span className="chip"><MapPin className="w-4 h-4" /> Lầu 3, Khu nhà C</span>
                </div>
                <button onClick={() => goTo(1)} className="btn btn--primary w-full mt-5">
                  Bắt đầu đi <ArrowDown className="w-4 h-4" />
                </button>
                <p className="mt-3 text-[12px] text-slate-400 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" /> Vuốt lên hoặc lăn chuột để đi theo lộ trình
                </p>
              </div>
            ) : i === LAST ? (
              <div className={cardClass} data-show={active === LAST}>
                <CloseCard onClick={hideCards} />
                <p className="kicker pr-10">{ch.kicker}</p>
                <h2 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-slate-900 mt-1.5 leading-tight">Bạn đã tới nơi!</h2>
                <p className="mt-2.5 text-[15px] text-slate-600 leading-relaxed">
                  Lễ bắt đầu lúc <b className="text-slate-900">{c.time} · {c.weekday}, {c.date}</b> tại {inv.ceremonyHall}.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button onClick={() => goTo(1)} className="btn btn--ghost">Xem lại</button>
                  <button onClick={onClose} className="btn btn--primary">Về thiệp</button>
                </div>
              </div>
            ) : (
              <div className={cardClass} data-show={active === i}>
                <CloseCard onClick={hideCards} />
                <p className="kicker pr-10">{ch.kicker}</p>
                <h2 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-slate-900 mt-1.5 leading-tight">{ch.title}</h2>
                <p className="mt-2.5 text-[15px] text-slate-600 leading-relaxed">
                  {ch.body}
                  {ch.id === 'hoi-truong' && <b className="text-slate-900"> Vui lòng có mặt trước {c.arrive}.</b>}
                </p>
                {ch.id === 'cong' && (
                  <a href={SCHOOL.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn--ghost mt-4 w-full">
                    <Navigation className="w-4 h-4 text-red-600" /> Chỉ đường bằng Google Maps
                  </a>
                )}
                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="flex gap-1.5" aria-hidden>
                    {CHAPTERS.slice(1, LAST).map((_, k) => (
                      <span key={k} className={`h-1.5 rounded-full transition-all ${k + 1 === i ? 'w-6 bg-red-600' : 'w-1.5 bg-slate-300'}`} />
                    ))}
                  </div>
                  <button onClick={() => goTo(i + 1)} className="btn btn--primary">
                    {i + 1 === LAST ? 'Tới nơi' : CHAPTERS[i + 1].title} <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        ))}
      </main>

      {/* Khi ẩn thẻ: thanh điều hướng nhỏ ↑ ↓ */}
      {cardsHidden && (
        <div className="fixed z-30 left-1/2 -translate-x-1/2 bottom-[max(16px,env(safe-area-inset-bottom))] flex items-center gap-1.5 rounded-2xl bg-white/95 shadow-card p-1.5 animate-[rise_.25s_ease-out]">
          <button onClick={() => goTo(current - 1)} disabled={current === 0} className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center disabled:opacity-35" aria-label="Chặng trước">
            <ChevronUp className="w-5 h-5" />
          </button>
          <div className="min-w-[132px] max-w-[46vw] px-2 text-center">
            <div className="text-[11px] font-semibold text-slate-500 leading-tight">
              {current + 1}/{LAST + 1}
            </div>
            <div className="text-[13px] font-bold text-slate-900 leading-tight truncate">{stepLabel}</div>
          </div>
          <button onClick={() => goTo(current + 1)} disabled={current === LAST} className="w-11 h-11 rounded-xl bg-[#e11d48] text-white flex items-center justify-center disabled:opacity-35" aria-label="Chặng sau">
            <ChevronDown className="w-5 h-5" />
          </button>
          <button onClick={() => setCardsHidden(false)} className="h-11 px-3 rounded-xl bg-slate-900 text-white text-[13px] font-bold flex items-center gap-1.5 whitespace-nowrap" aria-label="Hiện thẻ thông tin">
            <PanelBottomOpen className="w-4 h-4" /> Hiện thẻ
          </button>
        </div>
      )}
    </div>
  )
}

/** Nút ✕ ẩn thẻ chữ */
const CloseCard: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="absolute top-3 right-3 sm:top-4 sm:right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
    aria-label="Ẩn thẻ để xem bản đồ"
    title="Ẩn thẻ để xem bản đồ"
  >
    <X className="w-4 h-4" />
  </button>
)
