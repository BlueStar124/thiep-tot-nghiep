import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, RefreshCw, Trash2, Users, ExternalLink } from 'lucide-react'
import { deleteWish, fetchWishes, inviteUrl, loadGuestNames, loadOwner, type Wish } from '../lib/api'
import type { Invitation } from '../config/invitation'
import { formatCeremony } from '../config/invitation'
import { FitText } from './ui/FitText'

type Filter = 'all' | 'yes' | 'no'
type Load = { status: 'loading' } | { status: 'ready'; wishes: Wish[] } | { status: 'error'; message: string }

const timeAgo = (at: number) => {
  const m = Math.round((Date.now() - at) / 60_000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = new Date(at)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Trang chủ thiệp xem lời chúc & ai sẽ đến – cùng phong cách giấy / viền đen với trang khách.
 * Chỉ máy có khoá sửa thiệp mới đọc được (máy chủ kiểm tra).
 */
export const Dashboard: React.FC<{ inv: Invitation }> = ({ inv }) => {
  const owner = loadOwner()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [filter, setFilter] = useState<Filter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const c = formatCeremony(inv)

  const refresh = useCallback(() => {
    setLoad((s) => (s.status === 'ready' ? s : { status: 'loading' }))
    fetchWishes()
      .then((wishes) => setLoad({ status: 'ready', wishes }))
      .catch((e: Error) => setLoad({ status: 'error', message: e.message }))
  }, [])

  useEffect(() => {
    if (!owner) return
    refresh()
    // Tự cập nhật mỗi 30 giây khi đang mở trang
    const id = setInterval(() => document.visibilityState === 'visible' && refresh(), 30_000)
    return () => clearInterval(id)
  }, [refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const wishes = load.status === 'ready' ? load.wishes : []
  const stats = useMemo(() => {
    const yes = wishes.filter((w) => w.attending)
    return { total: wishes.length, yes: yes.length, people: yes.reduce((n, w) => n + w.people, 0), no: wishes.length - yes.length }
  }, [wishes])

  // Khách mời có link riêng nhưng chưa phản hồi (so theo tên trên link)
  const pending = useMemo(() => {
    const replied = new Set(wishes.map((w) => w.guestName).filter(Boolean))
    return loadGuestNames().filter((n) => !replied.has(n))
  }, [wishes])
  const invited = loadGuestNames().length

  const shown = wishes.filter((w) => (filter === 'all' ? true : filter === 'yes' ? w.attending : !w.attending))

  const remove = async (w: Wish) => {
    if (!confirm(`Xoá lời chúc của ${w.name}? Không khôi phục lại được.`)) return
    setBusyId(w.id)
    try {
      await deleteWish(w.id)
      setLoad((s) => (s.status === 'ready' ? { status: 'ready', wishes: s.wishes.filter((x) => x.id !== w.id) } : s))
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="paper-bg min-h-svh">
      <div className="mx-auto w-full max-w-[1040px] px-4 sm:px-6 pt-[max(16px,env(safe-area-inset-top))] pb-[max(48px,env(safe-area-inset-bottom))]">
        {/* Thanh trên – giống trang khách */}
        <header className="flex items-center gap-2.5 h-11">
          <span className="w-10 h-10 shrink-0 rounded-full bg-[#1f5fbf] text-white text-[11px] font-extrabold flex items-center justify-center tracking-tight">HUIT</span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold tracking-wide">LỜI CHÚC</span>
          <a href="/" className="h-11 shrink-0 px-3 sm:px-3.5 rounded-xl border-2 border-[#111] bg-white flex items-center gap-1.5 text-[13px] font-bold">
            <ArrowLeft className="w-4 h-4" /> Sửa thiệp
          </a>
          <button onClick={refresh} className="zine-icon-btn" aria-label="Tải lại lời chúc">
            <RefreshCw className={`w-5 h-5 ${load.status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
        </header>

        <div className="mt-6">
          <p className="text-[13px] font-semibold tracking-[.16em] text-[#333]">LỜI CHÚC & XÁC NHẬN</p>
          {/* Tên luôn 1 hàng như trang khách */}
          <FitText as="h1" max={44} min={18} className="mt-2 font-black leading-[1.08] tracking-tight uppercase">
            {inv.graduateName}
          </FitText>
          <p className="mt-2 text-[15px] font-medium text-[#333] text-balance">
            {/* dấu · luôn ở cuối dòng trên, không rơi xuống đầu dòng dưới */}
            {`${c.time} · ${c.weekday}, ${c.date}`.replace(/ /g, ' ')}
            {' · '}
            {inv.ceremonyHall.split(',')[0].replace(/ /g, ' ')}
          </p>
          {owner && (
            <a href={inviteUrl(owner.slug)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 zine-pill">
              <ExternalLink className="w-3.5 h-3.5" /> {location.host}/{owner.slug}
            </a>
          )}
        </div>

        {!owner ? (
          <div className="zine-box mt-6 p-5">
            <p className="text-[18px] font-black uppercase">Chưa có thiệp trên máy này</p>
            <p className="mt-2 text-[15px] text-[#333] leading-relaxed">Tạo link thiệp ở trang chính trước, hoặc mở khoá bằng mật khẩu kèm tên link đã tạo để lấy lại quyền xem lời chúc.</p>
            <a href="/" className="zine-btn zine-btn--yellow mt-5">
              Về trang chính
            </a>
          </div>
        ) : (
          <>
            {/* 4 ô số liệu – giống ô đếm ngược */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  [stats.total, 'lời chúc'],
                  [stats.yes, 'sẽ đến'],
                  [stats.people, 'tổng người đi'],
                  [stats.no, 'không đến']
                ] as const
              ).map(([v, l], i) => (
                <div key={l} className={`zine-box py-3 text-center ${i === 2 ? '!bg-[#f4d23a]' : ''}`}>
                  <div className="text-[clamp(24px,7vw,32px)] font-black tabular-nums leading-none">{load.status === 'ready' ? v : '–'}</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#444]">{l}</div>
                </div>
              ))}
            </div>

            <div className="mt-7 grid grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              {/* Danh sách lời chúc */}
              <section>
                <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Lọc lời chúc">
                  {(
                    [
                      ['all', `Tất cả · ${stats.total}`],
                      ['yes', `Sẽ đến · ${stats.yes}`],
                      ['no', `Không đến · ${stats.no}`]
                    ] as const
                  ).map(([k, t]) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={filter === k}
                      onClick={() => setFilter(k)}
                      className={`h-9 px-3.5 rounded-lg border-2 border-[#111] text-[13px] font-bold ${filter === k ? 'bg-[#111] text-white' : 'bg-white'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {load.status === 'loading' && <p className="py-10 text-center text-[14px] text-[#444]">Đang tải lời chúc…</p>}
                  {load.status === 'error' && (
                    <div className="zine-box p-5">
                      <p className="text-[16px] font-black uppercase">Chưa tải được lời chúc</p>
                      <p className="mt-1.5 text-[14px] text-[#333]">{load.message}</p>
                      <button onClick={refresh} className="zine-btn zine-btn--yellow w-full mt-4">
                        Thử lại
                      </button>
                    </div>
                  )}
                  {load.status === 'ready' && shown.length === 0 && (
                    <div className="zine-box p-6 text-center">
                      <p className="text-[16px] font-black uppercase">{stats.total ? 'Không có lời chúc nào ở mục này' : 'Chưa có lời chúc nào'}</p>
                      <p className="mt-1.5 text-[14px] text-[#444]">Gửi link thiệp cho khách – lời chúc sẽ hiện ở đây.</p>
                    </div>
                  )}
                  {shown.map((w) => (
                    <article key={w.id} className="zine-box p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[17px] font-black leading-snug break-words">{w.name}</p>
                          {w.guestName && w.guestName.toLowerCase() !== w.name.toLowerCase() && (
                            <p className="text-[12px] text-[#555] mt-0.5">qua link riêng của {w.guestName}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {w.attending ? (
                              <span className="zine-pill !bg-[#f4d23a]">Sẽ đến · {w.people} người</span>
                            ) : (
                              <span className="zine-pill">Không đến được</span>
                            )}
                            <span className="text-[12px] text-[#555]">{timeAgo(w.at)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => remove(w)}
                          disabled={busyId === w.id}
                          className="w-9 h-9 shrink-0 rounded-lg border-2 border-[#111] bg-white flex items-center justify-center disabled:opacity-50"
                          aria-label={`Xoá lời chúc của ${w.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {w.message && <p className="mt-3 pt-3 border-t-2 border-dashed border-[#111]/25 text-[15px] leading-relaxed text-[#222] whitespace-pre-line break-words">“{w.message}”</p>}
                    </article>
                  ))}
                </div>
              </section>

              {/* Khách mời chưa phản hồi */}
              <aside className="zine-box p-4 sm:p-5 lg:sticky lg:top-6">
                <p className="flex items-center gap-2 text-[15px] font-black uppercase">
                  <Users className="w-5 h-5" /> Chưa phản hồi
                </p>
                {invited === 0 ? (
                  <p className="mt-2 text-[14px] text-[#444] leading-relaxed">Thêm khách mời ở trang chính để theo dõi ai đã xác nhận.</p>
                ) : (
                  <>
                    <p className="mt-1 text-[13px] text-[#444]">
                      {invited - pending.length}/{invited} khách mời đã phản hồi
                    </p>
                    <div className="mt-2 h-3 rounded-full border-2 border-[#111] bg-white overflow-hidden" aria-hidden>
                      <div className="h-full bg-[#1f5fbf]" style={{ width: `${((invited - pending.length) / invited) * 100}%` }} />
                    </div>
                    {pending.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {pending.map((n) => (
                          <span key={n} className="zine-pill">
                            {n}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-[14px] font-bold">Tất cả khách mời đã phản hồi 🎉</p>
                    )}
                  </>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
