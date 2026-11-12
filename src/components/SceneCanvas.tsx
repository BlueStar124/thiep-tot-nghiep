import React, { useEffect, useRef, useState } from 'react'
import type { CampusScene } from '../scene/CampusScene'
import { LABEL_ANCHORS } from '../scene/anchors'
import { BUILDINGS } from '../config/campus'
import type { Invitation } from '../config/invitation'

interface Props {
  invitation: Invitation
  /** Đọc tiến trình cuộn hiện tại (số thực: chương 0 → 6) */
  getProgress: () => number
  onLabelClick: (chapter: number) => void
  /** Thẻ chữ đang ẩn → đưa sa bàn về giữa màn hình */
  cardsHidden?: boolean
}

const EXTRA: Record<string, { name: string; sub?: string; chapter: number; tone?: 'plain' | 'hall' | 'you' }> = {
  street: { name: 'Đường Lê Trọng Tấn', chapter: 1, tone: 'plain' },
  gate: { name: 'Cổng vào · Số 140', sub: 'Đi xuyên qua Khu nhà F', chapter: 1 },
  garden: { name: 'Vườn cây · Check-in', sub: 'Backdrop chụp ảnh', chapter: 4 },
  'side-gate': { name: 'Cổng phụ', chapter: 5, tone: 'plain' },
  hall: { name: 'Hội trường C · Lầu 3', sub: 'Nơi làm lễ', chapter: 5, tone: 'hall' },
  you: { name: 'Bạn', chapter: 0, tone: 'you' }
}

export const SceneCanvas: React.FC<Props> = ({ invitation, getProgress, onLabelClick, cardsHidden = false }) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<CampusScene | null>(null)
  const labelEls = useRef(new Map<string, HTMLElement>())
  const getProgressRef = useRef(getProgress)
  const [ready, setReady] = useState(false)
  getProgressRef.current = getProgress

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let scene: CampusScene | null = null
    let raf = 0
    let cancelled = false
    // Tải three.js + sa bàn ở chunk riêng (bắt đầu ngay) → chữ và thiệp hiện trước, sa bàn đến sau
    const sceneModule = import('../scene/CampusScene')
    const start = async () => {
      const { CampusScene } = await sceneModule
      if (cancelled) return
      scene = new CampusScene(host, invitation, () => labelEls.current)
      sceneRef.current = scene
      setReady(true)
      const sync = () => {
        scene?.setProgress(getProgressRef.current())
        raf = requestAnimationFrame(sync)
      }
      sync()
    }
    // Đợi font tiếng Việt để chữ trên biển hiệu đẹp (tối đa 0.8s)
    Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 800))]).then(start)
    const ro = new ResizeObserver(() => scene?.resize(host.clientWidth, host.clientHeight))
    ro.observe(host)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      scene?.dispose()
      sceneRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    sceneRef.current?.setInvitation(invitation)
  }, [invitation])

  useEffect(() => {
    sceneRef.current?.setCardsHidden(cardsHidden)
  }, [cardsHidden, ready])

  return (
    <div className="fixed inset-0 z-0">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden={!ready}>
        {LABEL_ANCHORS.map((a) => {
          const b = BUILDINGS.find((x) => x.id === a.id)
          const info = b ? { name: b.name, sub: b.sub, chapter: b.chapter, tone: undefined } : EXTRA[a.id]
          if (!info) return null
          return (
            <button
              key={a.id}
              ref={(el) => {
                if (el) labelEls.current.set(a.id, el)
                else labelEls.current.delete(a.id)
              }}
              onClick={() => onLabelClick(info.chapter)}
              className={`map-label map-label--${info.tone ?? 'building'}`}
              style={{ opacity: 0, visibility: 'hidden' }}
              tabIndex={-1}
            >
              <span className="map-label__name">{info.name}</span>
              {info.sub && <span className="map-label__sub">{info.sub}</span>}
            </button>
          )
        })}
      </div>
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 pointer-events-none ${ready ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <span className="w-5 h-5 rounded-full border-2 border-red-500 border-t-transparent animate-spin" /> Đang dựng sa bàn HUIT…
        </div>
      </div>
    </div>
  )
}
