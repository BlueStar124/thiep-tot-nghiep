import React, { useEffect, useState } from 'react'
import { X, MessageCircle, Copy, Check, Lock, ExternalLink } from 'lucide-react'
import type { Invitation } from '../config/invitation'
import { rsvpMessage } from '../lib/invite-tools'
import { publishInvite, inviteUrl } from '../lib/api'
import type { Guest } from '../lib/slug'

export const Sheet: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ open, onClose, title, children }) => {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-slate-900/40 animate-[fade_.2s_ease-out]" onClick={onClose} aria-label="Đóng" />
      <div className="relative w-full sm:max-w-md max-h-[92svh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-white shadow-2xl animate-[rise_.28s_cubic-bezier(.2,.8,.2,1)]">
        <div className="sticky top-0 bg-white/95 backdrop-blur px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="w-10 h-10 -mr-2 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export const field = 'w-full h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[15px] text-slate-900 outline-none focus:border-red-400 focus:bg-white transition'
export const label = 'block text-[13px] font-semibold text-slate-600 mb-1.5'

export const RsvpSheet: React.FC<{ open: boolean; onClose: () => void; invitation: Invitation; defaultName?: string }> = ({ open, onClose, invitation, defaultName }) => {
  const [name, setName] = useState(defaultName ?? '')
  const [going, setGoing] = useState(true)
  const [people, setPeople] = useState(1)
  const [wish, setWish] = useState('')
  const [copied, setCopied] = useState(false)
  const msg = rsvpMessage(invitation, { name: name || 'bạn của bạn', going, people, wish })
  const phone = invitation.phone.replace(/\D/g, '')

  const copyAndZalo = async () => {
    try {
      await navigator.clipboard.writeText(msg)
      setCopied(true)
    } catch {
      // trình duyệt chặn clipboard – vẫn mở Zalo
    }
    window.open(`https://zalo.me/${phone}`, '_blank', 'noopener')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Xác nhận tham dự">
      <div className="space-y-4">
        <div>
          <label className={label} htmlFor="rsvp-name">Tên của bạn</label>
          <input id="rsvp-name" className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Cô Lan, bạn Tuấn…" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              onClick={() => setGoing(v)}
              className={`h-12 rounded-2xl font-semibold text-[15px] border transition ${going === v ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-700 border-slate-200'}`}
            >
              {v ? 'Mình sẽ đến' : 'Tiếc quá, bận rồi'}
            </button>
          ))}
        </div>
        {going && (
          <div>
            <span className={label}>Số người đi cùng (tính cả bạn)</span>
            <div className="flex items-center gap-3">
              <button className="w-12 h-12 rounded-2xl bg-slate-100 text-xl font-bold" onClick={() => setPeople((n) => Math.max(1, n - 1))} aria-label="Bớt">−</button>
              <span className="w-10 text-center text-lg font-bold">{people}</span>
              <button className="w-12 h-12 rounded-2xl bg-slate-100 text-xl font-bold" onClick={() => setPeople((n) => Math.min(10, n + 1))} aria-label="Thêm">+</button>
            </div>
          </div>
        )}
        <div>
          <label className={label} htmlFor="rsvp-wish">Lời chúc</label>
          <textarea id="rsvp-wish" className={`${field} h-24 py-3 resize-none`} value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Chúc mừng tân cử nhân…" />
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-[13px] text-slate-600 leading-relaxed">{msg}</div>
        <div className="grid gap-2">
          <a href={`sms:${phone}?&body=${encodeURIComponent(msg)}`} className="h-12 rounded-2xl bg-[#e11d48] text-white font-bold flex items-center justify-center gap-2">
            <MessageCircle className="w-5 h-5" /> Gửi tin nhắn SMS
          </a>
          <button onClick={copyAndZalo} className="h-12 rounded-2xl bg-[#0068ff] text-white font-bold flex items-center justify-center gap-2">
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />} {copied ? 'Đã chép – dán vào Zalo' : 'Chép lời nhắn & mở Zalo'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

type PublishState = { status: 'saving' } | { status: 'done'; slug: string; guests: Guest[] } | { status: 'error'; message: string }

/** Lưu thiệp lên máy chủ rồi hiện link chung + link riêng từng khách */
export const PublishSheet: React.FC<{ open: boolean; onClose: () => void; invitation: Invitation; guestNames: string[]; desiredSlug: string; newSlug?: string }> = ({
  open,
  onClose,
  invitation,
  guestNames,
  desiredSlug,
  newSlug
}) => {
  const [state, setState] = useState<PublishState>({ status: 'saving' })
  const [copied, setCopied] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    let alive = true
    setState({ status: 'saving' })
    setCopied(null)
    publishInvite(invitation, guestNames, desiredSlug, newSlug)
      .then((r) => alive && setState({ status: 'done', slug: r.slug, guests: r.guests }))
      .catch((e: Error) => alive && setState({ status: 'error', message: e.message }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attempt])

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
    } catch {
      prompt('Sao chép nội dung này:', text)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Link thiệp của bạn">
      {state.status === 'saving' && (
        <p className="py-10 text-center text-[15px] text-slate-500 flex items-center justify-center gap-2">
          <span className="w-4 h-4 rounded-full border-2 border-red-500 border-t-transparent animate-spin" /> Đang lưu thiệp…
        </p>
      )}
      {state.status === 'error' && (
        <div className="space-y-4">
          <p className="rounded-2xl bg-red-50 p-4 text-[14px] text-red-800 leading-relaxed">{state.message}</p>
          <button onClick={() => setAttempt((n) => n + 1)} className="btn btn--primary w-full">
            Thử lại
          </button>
        </div>
      )}
      {state.status === 'done' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-3.5 text-[13px] text-emerald-800 leading-relaxed">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Đã lưu thiệp. Chỉ máy này sửa được. Đổi nội dung rồi bấm “Tạo link thiệp” lại, mọi link đã gửi sẽ tự cập nhật theo.</span>
          </div>

          <LinkRow label="Link chung (không ghi tên khách)" url={inviteUrl(state.slug)} copied={copied === 'main'} onCopy={() => copy(inviteUrl(state.slug), 'main')} />

          {state.guests.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={label + ' mb-0'}>Link riêng từng khách ({state.guests.length})</span>
                <button
                  onClick={() => copy(state.guests.map((g) => `${g.name}: ${inviteUrl(state.slug, g.slug)}`).join('\n'), 'all')}
                  className="text-[13px] font-bold text-red-600 inline-flex items-center gap-1"
                >
                  {copied === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied === 'all' ? 'Đã chép' : 'Chép tất cả'}
                </button>
              </div>
              <div className="space-y-2">
                {state.guests.map((g) => (
                  <LinkRow key={g.slug} label={g.name} url={inviteUrl(state.slug, g.slug)} copied={copied === g.slug} onCopy={() => copy(inviteUrl(state.slug, g.slug), g.slug)} compact />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-slate-500 leading-relaxed">Thêm tên khách ở mục “Khách mời” để có link riêng kiểu …/{state.slug}/co-lan, thiệp sẽ ghi “Kính mời Cô Lan”.</p>
          )}

          <a href={inviteUrl(state.slug)} target="_blank" rel="noopener noreferrer" className="h-12 rounded-2xl bg-slate-100 text-slate-900 font-bold flex items-center justify-center gap-2">
            <ExternalLink className="w-4 h-4" /> Mở thiệp
          </a>
        </div>
      )}
    </Sheet>
  )
}

const LinkRow: React.FC<{ label: string; url: string; copied: boolean; onCopy: () => void; compact?: boolean }> = ({ label: text, url, copied, onCopy, compact }) => {
  const short = url.replace(/^https?:\/\//, '')
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-slate-200 ${compact ? 'px-3 py-2.5' : 'p-3.5'}`}>
      <div className="min-w-0 flex-1">
        <div className={`font-bold text-slate-900 truncate ${compact ? 'text-[14px]' : 'text-[13px] text-slate-500 font-semibold'}`}>{text}</div>
        <div className={`truncate text-slate-600 ${compact ? 'text-[12px]' : 'text-[15px] font-bold text-slate-900'}`}>{short}</div>
      </div>
      <button
        onClick={onCopy}
        className={`shrink-0 h-10 px-3.5 rounded-xl font-bold text-[13px] inline-flex items-center gap-1.5 ${copied ? 'bg-emerald-600 text-white' : 'bg-[#e11d48] text-white'}`}
        aria-label={`Chép link ${text}`}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Đã chép' : 'Chép'}
      </button>
    </div>
  )
}
