import React, { memo, useEffect, useRef, useState } from 'react'
import { FitText } from './ui/FitText'
import type { Invitation } from '../config/invitation'
import { formatCeremony } from '../config/invitation'

/**
 * Thiệp mời: ảnh nền thiết kế sẵn (public/thiep-nen.webp) + chữ tự điền vào 4 chỗ đã xoá trên ảnh:
 * bảng tên vàng, dòng trên "BUỔI LỄ TỐT NGHIỆP", 3 cột thông tin và lời nhắn.
 * Toạ độ theo khung gốc 720×960 (= ảnh 450×600 × 1,6), thu phóng cho vừa bề rộng khung chứa.
 */
const W = 720
const H = 960
const BG = '/thiep-nen.webp'

/** Một hộp chữ đặt tuyệt đối trên ảnh, căn giữa theo tâm (cx) */
const Slot: React.FC<{ cx: number; top: number; width: number; rotate?: number; children: React.ReactNode }> = ({ cx, top, width, rotate, children }) => (
  <div style={{ position: 'absolute', left: cx - width / 2, top, width, transform: rotate ? `rotate(${rotate}deg)` : undefined, textAlign: 'center' }}>{children}</div>
)

const INFO_TEXT: React.CSSProperties = { fontWeight: 600, lineHeight: 1.35, color: '#1a1a1a' }

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

  const phone = inv.phone.replace(/(\d{4})(\d{3})(\d+)/, '$1 $2 $3')
  const hall = inv.ceremonyHall.split(',')[0].trim()

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

        {/* Bảng tên vàng – nghiêng 3,3° theo đúng mép tấm bảng (đo từ ảnh nền) */}
        <Slot cx={544} top={490} width={232} rotate={3.3}>
          <FitText max={18} min={9} style={{ fontWeight: 800, letterSpacing: '.01em', color: '#1d1d0f', lineHeight: 1.45 }}>
            {`${inv.degreeTitle} ${inv.graduateName}`.toUpperCase()}
          </FitText>
        </Slot>

        {/* Dòng trên tiêu đề: "THƯ MỜI THAM DỰ" hoặc "KÍNH MỜI CÔ LAN" khi gửi riêng */}
        <Slot cx={360} top={642} width={440}>
          <FitText max={19} min={11} style={{ fontWeight: guestName ? 800 : 700, letterSpacing: '.03em', color: guestName ? '#b91c1c' : '#111', lineHeight: 1.45 }}>
            {guestName ? `KÍNH MỜI ${guestName.toUpperCase()}` : 'THƯ MỜI THAM DỰ'}
          </FitText>
        </Slot>

        {/* 3 cột thông tin (nhãn & đường kẻ có sẵn trên ảnh) */}
        <Slot cx={119} top={840} width={136}>
          <FitText max={15.5} min={10} style={INFO_TEXT}>{`${c.time} – ${c.weekday}`}</FitText>
          <FitText max={15.5} min={10} style={INFO_TEXT}>{`Ngày ${c.date}`}</FitText>
        </Slot>
        <Slot cx={367} top={840} width={326}>
          <FitText max={15.5} min={10} style={INFO_TEXT}>{`${hall}, ĐH Công Thương TP.HCM`}</FitText>
          <FitText max={15.5} min={10} style={INFO_TEXT}>140 Lê Trọng Tấn, Tân Phú</FitText>
        </Slot>
        <Slot cx={616} top={840} width={132}>
          <FitText max={15.5} min={10} style={INFO_TEXT}>{phone}</FitText>
        </Slot>

        {/* Lời nhắn: tự thu nhỏ cho vừa khung dưới cùng */}
        <div style={{ position: 'absolute', left: 40, right: 40, top: 894, height: 56 }}>
          <FitText as="p" mode="box" max={15} min={9} maxHeight={56} style={{ margin: 0, textAlign: 'center', fontStyle: 'italic', fontWeight: 500, lineHeight: 1.45, color: '#222' }}>
            {inv.message}
          </FitText>
        </div>
      </div>
    </div>
  )
})
