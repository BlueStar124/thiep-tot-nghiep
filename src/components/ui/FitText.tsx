import React, { useLayoutEffect, useRef } from 'react'

type Props = {
  children: React.ReactNode
  /** Cỡ chữ lớn nhất / nhỏ nhất (px) */
  max: number
  min: number
  /**
   * 'line': ép một hàng, thu nhỏ tới khi vừa bề ngang
   * 'box' : nhiều dòng, thu nhỏ tới khi vừa chiều cao maxHeight
   */
  mode?: 'line' | 'box'
  maxHeight?: number
  as?: 'h1' | 'h2' | 'p' | 'span' | 'div'
  className?: string
  style?: React.CSSProperties
}

/**
 * Chữ tự co cho vừa khung: đo kích thước thật trên màn hình rồi tìm cỡ chữ lớn nhất còn vừa (tìm nhị phân).
 * Đo lại khi khung đổi kích thước (xoay máy, đổi cửa sổ) và khi font web tải xong.
 */
export const FitText: React.FC<Props> = ({ children, max, min, mode = 'line', maxHeight, as: Tag = 'span', className, style }) => {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fits = () => (mode === 'line' ? el.scrollWidth <= el.clientWidth + 0.5 : el.scrollHeight <= (maxHeight ?? Infinity) + 0.5)
    const fit = () => {
      let lo = min
      let hi = max
      el.style.fontSize = `${hi}px`
      if (fits()) return
      // Tìm nhị phân tới độ chính xác 0.25px
      while (hi - lo > 0.25) {
        const mid = (lo + hi) / 2
        el.style.fontSize = `${mid}px`
        if (fits()) lo = mid
        else hi = mid
      }
      el.style.fontSize = `${lo}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el.parentElement ?? el)
    let alive = true
    document.fonts?.ready.then(() => alive && fit())
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [children, max, min, mode, maxHeight])

  const base: React.CSSProperties = mode === 'line' ? { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden' } : { overflow: 'hidden' }
  // Không đặt fontSize qua React (mỗi lần vẽ lại sẽ bị đè về max) – cỡ chữ do bộ đo ở trên tự đặt
  return React.createElement(Tag, { ref, className, style: { ...base, ...style } }, children)
}
