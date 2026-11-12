import React, { memo, useEffect, useRef, useState } from 'react'
import { FitText } from './ui/FitText'
import type { Invitation } from '../config/invitation'
import { formatCeremony } from '../config/invitation'

/**
 * Thiệp mời: ảnh nền thiết kế sẵn (public/thiep-nen.webp) + chữ tự điền vào 4 chỗ đã xoá trên ảnh:
 * bảng tên vàng, dòng trên "BUỔI LỄ TỐT NGHIỆP", 3 cột thông tin và lời nhắn.
 * Ảnh nền xuất từ Canva (1080×1440, đã xoá các chữ cần điền). Toạ độ theo khung 720×960 (= Canva × 2/3).
 */
const W = 720
const H = 960
const BG = '/thiep-nen.webp'

/** Một hộp chữ đặt tuyệt đối trên ảnh, căn giữa theo tâm (cx) */
const Slot: React.FC<{ cx: number; top: number; width: number; rotate?: number; children: React.ReactNode }> = ({ cx, top, width, rotate, children }) => (
  <div style={{ position: 'absolute', left: cx - width / 2, top, width, transform: rotate ? `rotate(${rotate}deg)` : undefined, textAlign: 'center' }}>{children}</div>
)

const INFO_TEXT: React.CSSProperties = { fontWeight: 600, lineHeight: 1.5, color: '#1b1b1b' }

/** memo: chỉ vẽ lại khi nội dung thiệp hoặc tên khách đổi */
export const CollageInvite = memo(function CollageInvite({ inv, guestName }: { inv: Invitation; guestName?: string }) {
  const c = formatCeremony(inv)
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // "Hội trường C – Lầu 3, Khu nhà C" → chỉ lấy phần trước dấu phẩy cho vừa thiệp
  const hall = inv.ceremonyHall.split(',')[0].trim()
  const phone = inv.phone.replace(/(\d{4})(\d{3})(\d+)/, '$1 $2 $3')

  return (
    <div
      ref={box}
      style={{ width: '100%', height: H * scale, position: 'relative' }}
      role="img"
      aria-label={`Thiệp mời ${guestName ? `${guestName} ` : ''}dự Lễ tốt nghiệp của ${inv.degreeTitle} ${inv.graduateName}, ${c.time} ${c.weekday} ${c.date}, ${inv.ceremonyHall}`}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: W,
          height: H,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          overflow: 'hidden',
          fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
          color: '#111'
        }}
      >
        <img src={BG} alt="" width={W} height={H} decoding="async" fetchPriority="high" style={{ position: 'absolute', inset: 0, width: W, height: H, display: 'block' }} />

        {/* Bảng tên vàng – nửa trái bị ảnh người che (như thiết kế Canva) nên chỉ ghi tên trên phần bảng lộ ra, nghiêng 3,75° */}
        <Slot cx={594} top={496} width={148} rotate={3.75}>
          <FitText max={16} min={8} style={{ fontWeight: 800, color: '#000', lineHeight: 1.2 }}>
            {inv.graduateName.toUpperCase()}
          </FitText>
        </Slot>

        {/* Dòng trên tiêu đề: "THƯ MỜI THAM DỰ" hoặc "KÍNH MỜI CÔ LAN" khi gửi riêng */}
        <Slot cx={360} top={641} width={430}>
          <FitText max={22} min={12} style={{ fontWeight: 800, letterSpacing: '.01em', color: guestName ? '#b91c1c' : '#000', lineHeight: 1.2 }}>
            {guestName ? `KÍNH MỜI ${guestName.toUpperCase()}` : 'THƯ MỜI THAM DỰ'}
          </FitText>
        </Slot>

        {/* 3 cột thông tin (nhãn & vạch ngăn có sẵn trên ảnh) */}
        <Slot cx={114} top={843.5} width={122}>
          <FitText max={13.7} min={9} style={INFO_TEXT}>{`${c.time} – ${c.weekday}`}</FitText>
          <FitText max={13.7} min={9} style={INFO_TEXT}>{`Ngày ${c.date}`}</FitText>
        </Slot>
        <Slot cx={362.7} top={843.5} width={330}>
          <FitText max={13.7} min={9} style={INFO_TEXT}>{`${hall}, ĐH Công Thương TP.HCM`}</FitText>
          <FitText max={13.7} min={9} style={INFO_TEXT}>140 Lê Trọng Tấn, Tân Phú</FitText>
        </Slot>
        <Slot cx={609.6} top={843.5} width={112}>
          <FitText max={14.3} min={9} style={INFO_TEXT}>{phone}</FitText>
        </Slot>

        {/* Lời nhắn: tự thu nhỏ cho vừa khung dưới cùng */}
        <div style={{ position: 'absolute', left: 80, width: 560, top: 901, height: 54 }}>
          <FitText as="p" mode="box" max={13.9} min={7.5} maxHeight={54} style={{ margin: 0, textAlign: 'center', fontStyle: 'italic', fontWeight: 600, lineHeight: 1.4, color: '#1b1b1b' }}>
            {inv.message}
          </FitText>
        </div>
      </div>
    </div>
  )
})
