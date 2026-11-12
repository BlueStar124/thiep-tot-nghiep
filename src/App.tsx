import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { InvitePage } from './components/InvitePage'
import { DEFAULT_INVITATION, loadInvitation, saveInvitation, type Invitation } from './config/invitation'
import { invitationFromUrl } from './lib/invite-tools'

// Tải chậm: khách mở link chỉ cần trang thiệp; trình tạo thiệp và bản đồ 3D tải khi dùng tới
const Editor = lazy(() => import('./components/Editor').then((m) => ({ default: m.Editor })))
const MapTour = lazy(() => import('./components/MapTour').then((m) => ({ default: m.MapTour })))
const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })))
const LockScreen = lazy(() => import('./components/LockScreen').then((m) => ({ default: m.LockScreen })))
import { fetchInvite, isUnlocked } from './lib/api'

/**
 * - /minh/co-lan → thiệp của Minh gửi riêng Cô Lan (đọc từ database)
 * - /minh        → thiệp chung, không ghi tên khách
 * - ?t=…         → link kiểu cũ (nội dung nằm trong link), vẫn mở được
 * - /            → trình tạo thiệp của chủ thiệp
 * - /dashboard   → chủ thiệp xem lời chúc & ai sẽ đến
 */
function parseRoute() {
  const segs = location.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s).toLowerCase())
  return { slug: segs[0] ?? '', guestSlug: segs[1] ?? '' }
}

type GuestState = { status: 'loading' } | { status: 'ready'; inv: Invitation; guestName?: string; slug?: string; guestSlug?: string } | { status: 'missing' } | { status: 'error'; message: string }

export const App: React.FC = () => {
  const route = useRef(parseRoute())
  const legacy = useRef(invitationFromUrl())
  const isDashboard = route.current.slug === 'dashboard'
  const isGuest = (!!route.current.slug && !isDashboard) || !!legacy.current

  const [inv, setInv] = useState<Invitation>(() => (legacy.current ? { ...DEFAULT_INVITATION, ...legacy.current } : loadInvitation()))
  const [guest, setGuest] = useState<GuestState>(() => (legacy.current ? { status: 'ready', inv: { ...DEFAULT_INVITATION, ...legacy.current } } : { status: 'loading' }))
  const [preview, setPreview] = useState(false)
  // Trang chính (trình tạo thiệp) chỉ dành cho chủ thiệp: cần mật khẩu hoặc khoá sửa đã lưu trên máy
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [mapOpen, setMapOpen] = useState(false)

  // Khách mở link /ten-thiep/ten-khach → tải thiệp từ máy chủ
  useEffect(() => {
    const { slug, guestSlug } = route.current
    if (!slug || legacy.current) return
    let alive = true
    fetchInvite(slug, guestSlug)
      .then((data) => {
        if (!alive) return
        const invitation = { ...DEFAULT_INVITATION, ...data.invitation }
        const guestName = data.guests.find((g) => g.slug === guestSlug)?.name
        // Link đã đổi tên (hoặc gõ khác hoa/thường) → hiện đúng tên link mới trên thanh địa chỉ
        const wanted = `/${data.slug}${guestSlug ? `/${guestSlug}` : ''}`
        if (location.pathname !== wanted) history.replaceState(null, '', wanted + location.search)
        setInv(invitation)
        setGuest({ status: 'ready', inv: invitation, guestName, slug: data.slug, guestSlug: guestName ? guestSlug : undefined })
        document.title = guestName ? `${guestName} ơi, mời bạn dự lễ tốt nghiệp của ${invitation.graduateName}` : `Thiệp mời lễ tốt nghiệp của ${invitation.graduateName}`
      })
      .catch((err: Error & { status?: number }) => {
        if (!alive) return
        setGuest(err.status === 404 || err.status === 400 ? { status: 'missing' } : { status: 'error', message: err.message })
      })
    return () => {
      alive = false
    }
  }, [])

  const change = (next: Invitation) => {
    setInv(next)
    saveInvitation(next)
  }
  const openMap = useCallback(() => setMapOpen(true), [])
  const closeMap = useCallback(() => setMapOpen(false), [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [preview, mapOpen])

  if (mapOpen)
    return (
      <Suspense fallback={<Loading text="Đang mở bản đồ…" />}>
        <MapTour inv={inv} onClose={closeMap} />
      </Suspense>
    )

  if (isGuest) {
    if (guest.status === 'ready') return <InvitePage inv={guest.inv} guestName={guest.guestName} onOpenMap={openMap} slug={guest.slug} guestSlug={guest.guestSlug} />
    return <GuestStatus state={guest} />
  }

  if (!unlocked)
    return (
      <Suspense fallback={<Loading text="Đang mở…" />}>
        <LockScreen
          graduateName={inv.graduateName}
          onUnlock={(loaded) => {
            if (loaded) change({ ...DEFAULT_INVITATION, ...loaded })
            setUnlocked(true)
          }}
        />
      </Suspense>
    )

  if (isDashboard)
    return (
      <Suspense fallback={<Loading text="Đang mở bảng theo dõi…" />}>
        <Dashboard inv={inv} />
      </Suspense>
    )

  if (preview)
    return (
      <>
        <InvitePage inv={inv} guestName="Cô Lan" onOpenMap={openMap} celebrate={false} bottomSpace />
        <button
          onClick={() => setPreview(false)}
          className="fixed left-1/2 -translate-x-1/2 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 h-12 pl-4 pr-5 rounded-full bg-slate-900 text-white text-[14px] font-bold shadow-card flex items-center gap-2 whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4" /> Đang xem trước · Quay lại chỉnh sửa
        </button>
      </>
    )
  return (
    <Suspense fallback={<Loading text="Đang mở trình tạo thiệp…" />}>
      <Editor inv={inv} onChange={change} onPreview={() => setPreview(true)} />
    </Suspense>
  )
}

/** Màn chờ trong lúc tải phần code chưa có */
const Loading: React.FC<{ text: string }> = ({ text }) => (
  <div className="paper-bg min-h-svh flex items-center justify-center">
    <p className="text-[14px] text-[#444] flex items-center gap-2">
      <Spinner /> {text}
    </p>
  </div>
)

/** Màn hình chờ / không tìm thấy thiệp cho khách */
const GuestStatus: React.FC<{ state: Exclude<GuestState, { status: 'ready' }> }> = ({ state }) => (
  <div className="paper-bg min-h-svh flex items-center justify-center px-6 text-center">
    <div className="max-w-sm">
      <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-[#1f5fbf] text-white text-[14px] font-extrabold flex items-center justify-center">HUIT</div>
      {state.status === 'loading' ? (
        // Giống hệt màn chào trong index.html → chuyển cảnh không bị nháy
        <>
          <p className="text-[13px] font-semibold tracking-[.16em] text-[#333]">TRÂN TRỌNG KÍNH MỜI</p>
          <p className="mt-2.5 text-[30px] font-black leading-[1.1] tracking-tight">LỄ TỐT NGHIỆP 2026</p>
          <p className="mt-2 text-[14px] text-[#444]">Trường Đại học Công Thương TP. Hồ Chí Minh</p>
          <p className="mt-6 text-[14px] text-[#444] flex items-center justify-center gap-2">
            <Spinner /> Đang mở thiệp…
          </p>
        </>
      ) : state.status === 'missing' ? (
        <>
          <p className="text-[24px] font-black leading-tight uppercase">Không tìm thấy thiệp</p>
          <p className="mt-3 text-[15px] text-[#333] leading-relaxed">Đường link có thể bị gõ sai. Bạn kiểm tra lại link được gửi, hoặc nhắn người mời gửi lại giúp nhé.</p>
        </>
      ) : (
        <>
          <p className="text-[24px] font-black leading-tight uppercase">Chưa mở được thiệp</p>
          <p className="mt-3 text-[15px] text-[#333] leading-relaxed">{state.message}</p>
          <button onClick={() => location.reload()} className="zine-btn zine-btn--yellow w-full mt-6">
            Thử lại
          </button>
        </>
      )}
    </div>
  </div>
)

/** Vòng xoay đen, dùng chung cho các màn chờ */
const Spinner = () => <span className="w-4 h-4 rounded-full border-2 border-[#111] border-t-transparent animate-spin" aria-hidden />

export default App
