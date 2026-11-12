import React, { memo } from 'react'
import type { Invitation } from '../config/invitation'
import { useCountdown } from '../lib/invite-tools'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Đếm ngược tới giờ lễ. Tách riêng + memo để mỗi giây CHỈ ô này vẽ lại,
 * không kéo theo cả trang thiệp (ảnh, thiệp collage, nút…).
 */
export const Countdown = memo(function Countdown({ inv }: { inv: Invitation }) {
  const cd = useCountdown(inv)
  if (cd.done) return null
  const cells: [string | number, string][] = [
    [cd.days, 'ngày'],
    [pad(cd.hours), 'giờ'],
    [pad(cd.minutes), 'phút'],
    [pad(cd.seconds), 'giây']
  ]
  return (
    <div className="grid grid-cols-4 gap-2" role="timer" aria-label={`Còn ${cd.days} ngày ${cd.hours} giờ ${cd.minutes} phút tới giờ lễ`}>
      {cells.map(([v, l]) => (
        <div key={l} className="zine-box py-2.5 text-center" aria-hidden>
          <div className="text-[clamp(20px,6.4vw,26px)] font-black tabular-nums leading-none">{v}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#444]">{l}</div>
        </div>
      ))}
    </div>
  )
})
