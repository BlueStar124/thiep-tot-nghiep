import React, { useEffect, useMemo, useState } from 'react'
import { Eye, GraduationCap, CalendarClock, MessageSquareHeart, Link2, RotateCcw, ImageIcon, PencilLine, Users, X, Plus, Heart } from 'lucide-react'
import { CollageInvite } from './CollageInvite'
import { PublishSheet, field, label } from './Sheets'
import { assignGuestSlugs, ownerSlugFrom, slugDisplay } from '../lib/slug'
import { loadGuestNames, loadOwner, refreshOwner, saveGuestNames } from '../lib/api'
import { DEFAULT_INVITATION, formatCeremony, type Invitation } from '../config/invitation'

interface Props {
  inv: Invitation
  onChange: (inv: Invitation) => void
  onPreview: () => void
}

/** Màn hình chính của chủ thiệp: chỉnh nội dung, xem trước trực tiếp, tạo link gửi khách */
export const Editor: React.FC<Props> = ({ inv, onChange, onPreview }) => {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [shareOpen, setShareOpen] = useState(false)
  const [guestNames, setGuestNames] = useState<string[]>(loadGuestNames)
  const [draftGuests, setDraftGuests] = useState('')
  const [owner, setOwner] = useState(loadOwner)
  // Mở trang → hỏi máy chủ tên link mới nhất (phòng khi đã đổi tên ở nơi khác)
  useEffect(() => {
    refreshOwner().then(setOwner)
  }, [])
  // Đóng bảng link → đọc lại (vừa tạo/đổi tên xong)
  useEffect(() => {
    if (!shareOpen) {
      setOwner(loadOwner())
      setRenaming(false)
    }
  }, [shareOpen])
  const [customSlug, setCustomSlug] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const renameTo = renaming && slugDisplay(renameDraft) && slugDisplay(renameDraft) !== owner?.slug ? slugDisplay(renameDraft) : undefined
  const linkSlug = owner ? renameTo ?? owner.slug : slugDisplay(customSlug) || ownerSlugFrom(inv.graduateName)
  const guests = useMemo(() => assignGuestSlugs(guestNames), [guestNames])
  const host = location.host

  const updateGuests = (names: string[]) => {
    setGuestNames(names)
    saveGuestNames(names)
  }
  const addGuests = () => {
    // Bỏ qua tên đã có (không phân biệt hoa thường) để lỡ bấm 2 lần không bị nhân đôi
    const seen = new Set(guestNames.map((n) => n.trim().toLowerCase()))
    const added = draftGuests
      .split('\n')
      .map((n) => n.trim().replace(/\s+/g, ' '))
      .filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()))
    setDraftGuests('')
    if (!added.length) return
    updateGuests([...guestNames, ...added].slice(0, 300))
    setDraftGuests('')
  }
  const set = <K extends keyof Invitation>(k: K, v: Invitation[K]) => onChange({ ...inv, [k]: v })
  const c = formatCeremony(inv)
  const valid = inv.graduateName.trim() && inv.startISO && inv.ceremonyHall.trim()

  const reset = () => {
    if (confirm('Khôi phục nội dung mẫu? Thông tin bạn đã nhập sẽ bị thay thế.')) onChange(DEFAULT_INVITATION)
  }

  return (
    <div className="editor-bg min-h-svh pb-28 lg:pb-10">
      {/* Thanh trên */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200/70">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6 h-16 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-[#1d4ed8] text-white text-[11px] font-extrabold flex items-center justify-center tracking-tight">HUIT</span>
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold text-slate-900 leading-tight truncate">Tạo thiệp tốt nghiệp</p>
            <p className="text-[12px] text-slate-500 leading-tight truncate">Tự động lưu trên máy này</p>
          </div>
          {/* Lời chúc khách gửi: trang /dashboard */}
          <a href="/dashboard" className="ml-auto btn btn--soft h-11 min-h-0 px-3.5 shrink-0" aria-label="Xem lời chúc">
            <Heart className="w-4 h-4 text-red-600" /> <span className="hidden sm:inline">Lời chúc</span>
          </a>
          <div className="hidden lg:flex items-center gap-2">
            <button onClick={onPreview} className="btn btn--soft h-11 min-h-0">
              <Eye className="w-4 h-4" /> Xem như khách
            </button>
            <button onClick={() => setShareOpen(true)} disabled={!valid} className="btn btn--primary h-11 min-h-0 disabled:opacity-50">
              <Link2 className="w-4 h-4" /> Tạo link thiệp
            </button>
          </div>
        </div>
      </header>

      {/* Chuyển tab trên điện thoại */}
      <div className="lg:hidden sticky top-16 z-20 px-4 pt-3 pb-2 bg-gradient-to-b from-[#eef2f7] to-transparent">
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-200/70">
          {(
            [
              ['edit', 'Nội dung', PencilLine],
              ['preview', 'Xem trước', Eye]
            ] as const
          ).map(([k, t, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`h-10 rounded-xl text-[14px] font-bold flex items-center justify-center gap-1.5 transition ${tab === k ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
            >
              <Icon className="w-4 h-4" /> {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1120px] px-4 sm:px-6 lg:pt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start">
        {/* Form */}
        <div className={`space-y-4 ${tab === 'edit' ? '' : 'hidden lg:block'}`}>
          <div className="hidden lg:block mb-2">
            <h1 className="font-display text-[34px] leading-tight text-slate-900">Thiệp mời của bạn</h1>
            <p className="mt-1 text-[15px] text-slate-500">Điền thông tin bên dưới, thiệp bên phải cập nhật ngay. Xong thì bấm “Tạo link thiệp” để gửi khách.</p>
          </div>

          <Group icon={<GraduationCap className="w-5 h-5" />} title="Tân cử nhân">
            <div>
              <label className={label} htmlFor="e-name">Họ và tên</label>
              <input id="e-name" className={field} value={inv.graduateName} onChange={(e) => set('graduateName', e.target.value)} placeholder="Nguyễn Văn A" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="e-degree">Danh xưng</label>
                <select id="e-degree" className={field} value={inv.degreeTitle} onChange={(e) => set('degreeTitle', e.target.value)}>
                  {['Tân Kỹ sư', 'Tân Cử nhân', 'Tân Thạc sĩ', 'Tân Tiến sĩ'].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="e-fac">Khoa / Ngành</label>
                <input id="e-fac" className={field} value={inv.faculty} onChange={(e) => set('faculty', e.target.value)} />
              </div>
            </div>
          </Group>

          <Group icon={<CalendarClock className="w-5 h-5" />} title="Thời gian & địa điểm">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="e-start">Ngày & giờ lễ</label>
                <input id="e-start" type="datetime-local" className={field} value={inv.startISO} onChange={(e) => set('startISO', e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="e-dur">Thời lượng (phút)</label>
                <input id="e-dur" type="number" min={30} step={30} className={field} value={inv.durationMin} onChange={(e) => set('durationMin', Number(e.target.value) || 120)} />
              </div>
            </div>
            <p className="text-[13px] text-slate-500 -mt-1">
              {c.weekday}, {c.date} · {c.time} – {c.endTime} · khách nên có mặt trước {c.arrive}
            </p>
            <div>
              <label className={label} htmlFor="e-hall">Địa điểm làm lễ</label>
              <input id="e-hall" className={field} value={inv.ceremonyHall} onChange={(e) => set('ceremonyHall', e.target.value)} />
            </div>
          </Group>

          <Group icon={<MessageSquareHeart className="w-5 h-5" />} title="Liên hệ & lời nhắn">
            <div>
              <label className={label} htmlFor="e-phone">Số điện thoại / Zalo</label>
              <input id="e-phone" inputMode="tel" className={field} value={inv.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="e-msg">
                Lời nhắn trong thiệp <span className="font-normal text-slate-400">({inv.message.length}/220)</span>
              </label>
              <textarea id="e-msg" maxLength={220} className={`${field} h-28 py-3 resize-none`} value={inv.message} onChange={(e) => set('message', e.target.value)} />
            </div>
          </Group>

          <Group icon={<Users className="w-5 h-5" />} title="Khách mời & đường link">
            <div>
              <label className={label} htmlFor="e-slug">Tên link thiệp</label>
              <div className="flex gap-2">
                <div className={`${field} flex-1 min-w-0 flex items-center gap-0 px-0 overflow-hidden ${owner && !renaming ? 'bg-slate-100' : ''}`}>
                  <span className="pl-4 pr-0.5 text-slate-400 text-[14px] whitespace-nowrap">{host}/</span>
                  <input
                    id="e-slug"
                    className="flex-1 min-w-0 h-full bg-transparent outline-none font-bold text-slate-900"
                    value={owner ? (renaming ? renameDraft : owner.slug) : customSlug}
                    placeholder={owner ? owner.slug : ownerSlugFrom(inv.graduateName)}
                    onChange={(e) => (owner ? setRenameDraft(e.target.value) : setCustomSlug(e.target.value))}
                    disabled={!!owner && !renaming}
                    aria-describedby="e-slug-help"
                  />
                </div>
                {owner && (
                  <button
                    onClick={() => {
                      setRenameDraft(renaming ? '' : owner.slug)
                      setRenaming(!renaming)
                    }}
                    className="btn btn--soft h-12 min-h-0 px-3.5 text-[13px] shrink-0"
                  >
                    {renaming ? 'Huỷ' : 'Đổi tên link'}
                  </button>
                )}
              </div>
              <p id="e-slug-help" className="mt-1.5 text-[12px] text-slate-500">
                {owner && renaming ? (
                  renameTo ? (
                    <>
                      Link mới: <b className="text-slate-800">{host}/{renameTo}</b>. Bấm “Tạo link thiệp” để lưu. Link cũ vẫn tự chuyển sang link mới.
                    </>
                  ) : (
                    'Gõ tên link mới: chữ không dấu, số, dấu gạch ngang. Giữ được chữ hoa, ví dụ XuanCuong.'
                  )
                ) : owner ? (
                  'Link đã tạo. Muốn đổi tên, bấm “Đổi tên link”.'
                ) : (
                  <>
                    Link sẽ là <b className="text-slate-800">{host}/{linkSlug}</b>. Để trống thì tự lấy theo tên của bạn; nếu trùng người khác sẽ tự thêm số.
                  </>
                )}
              </p>
            </div>
            <div>
              <label className={label} htmlFor="e-guests">Thêm khách mời <span className="font-normal text-slate-400">(mỗi dòng một người)</span></label>
              <textarea
                id="e-guests"
                className={`${field} h-24 py-3 resize-none`}
                value={draftGuests}
                onChange={(e) => setDraftGuests(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !draftGuests.includes('\n')) {
                    e.preventDefault()
                    addGuests()
                  }
                }}
                placeholder={'Cô Lan\nBác Hai\nAnh Tuấn'}
              />
              <button onClick={addGuests} disabled={!draftGuests.trim()} className="btn btn--soft mt-2 h-11 min-h-0 disabled:opacity-50">
                <Plus className="w-4 h-4" /> Thêm vào danh sách
              </button>
            </div>
            {guests.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 max-h-72 overflow-y-auto">
                {guests.map((g, i) => (
                  <li key={g.slug} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold text-slate-900 truncate">{g.name}</span>
                      <span className="block text-[12px] text-slate-500 truncate">
                        {host}/{linkSlug}/<b className="text-slate-700">{g.slug}</b>
                      </span>
                    </span>
                    <button onClick={() => updateGuests(guestNames.filter((_, k) => k !== i))} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700" aria-label={`Xoá ${g.name}`}>
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Group>

          <div className="flex items-start gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/60 p-4 text-[13px] text-slate-600 leading-relaxed">
            <ImageIcon className="w-5 h-5 shrink-0 text-slate-400 mt-0.5" />
            <span>
              Ảnh nền thiệp là file <code className="font-semibold text-slate-800">public/thiep-nen.webp</code>. Tên, giờ, địa điểm, số điện thoại và lời nhắn do web tự điền từ thông tin bên trên.
            </span>
          </div>

          <button onClick={reset} className="text-[13px] font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1.5 py-2">
            <RotateCcw className="w-3.5 h-3.5" /> Khôi phục nội dung mẫu
          </button>
        </div>

        {/* Xem trước */}
        <aside className={`lg:sticky lg:top-24 ${tab === 'preview' ? '' : 'hidden lg:block'}`}>
          <div className="mx-auto max-w-[440px]">
            <p className="hidden lg:flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.14em] text-slate-500 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Xem trước trực tiếp
            </p>
            <div className="rounded-[26px] bg-white p-2.5 shadow-[0_30px_70px_-30px_rgba(15,23,42,.45)]">
              <CollageInvite inv={inv} />
            </div>
            <button onClick={onPreview} className="btn btn--soft w-full mt-3 lg:hidden">
              <Eye className="w-4 h-4" /> Xem toàn bộ trang như khách
            </button>
          </div>
        </aside>
      </div>

      {/* Thanh dưới (điện thoại) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-white/90 backdrop-blur border-t border-slate-200/70">
        <button onClick={() => setShareOpen(true)} disabled={!valid} className="btn btn--primary w-full h-[52px] text-[16px] disabled:opacity-50">
          <Link2 className="w-5 h-5" /> Tạo link thiệp
        </button>
      </div>

      <PublishSheet open={shareOpen} onClose={() => setShareOpen(false)} invitation={inv} guestNames={guestNames} desiredSlug={linkSlug} newSlug={renameTo} />
    </div>
  )
}

const Group: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section className="rounded-3xl bg-white shadow-card p-5 sm:p-6">
    <h2 className="flex items-center gap-2.5 text-[15px] font-extrabold text-slate-900 mb-4">
      <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">{icon}</span>
      {title}
    </h2>
    <div className="space-y-4">{children}</div>
  </section>
)
