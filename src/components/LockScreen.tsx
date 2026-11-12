import React, { useState } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { login } from '../lib/api'
import { ownerSlugFrom } from '../lib/slug'
import type { Invitation } from '../config/invitation'

/**
 * Màn khoá trang chính: chỉ chủ thiệp (biết mật khẩu ADMIN_PASSWORD) mới vào được trình tạo thiệp.
 * Ghi kèm tên link đã tạo → máy này được cấp quyền sửa và tải lại nội dung thiệp + danh sách khách.
 */
export const LockScreen: React.FC<{ graduateName: string; onUnlock: (loaded?: Partial<Invitation>) => void }> = ({ graduateName, onUnlock }) => {
  const [password, setPassword] = useState('')
  const [slug, setSlug] = useState(() => ownerSlugFrom(graduateName))
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError('')
    try {
      const { invitation } = await login(password, slug.trim())
      onUnlock(invitation)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const input = 'w-full h-12 px-4 rounded-xl border-2 border-[#111] bg-white text-[16px] font-semibold outline-none focus:shadow-[3px_3px_0_#111]'

  return (
    <div className="paper-bg min-h-svh flex items-center justify-center px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="text-center">
          <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-[#1f5fbf] text-white text-[14px] font-extrabold flex items-center justify-center">HUIT</div>
          <p className="text-[13px] font-semibold tracking-[.16em] text-[#333]">TRANG CỦA CHỦ THIỆP</p>
          <h1 className="mt-2 text-[28px] font-black leading-[1.1] tracking-tight">NHẬP MẬT KHẨU</h1>
          <p className="mt-2 text-[14px] text-[#444]">Khách mời mở thiệp bằng link riêng được gửi, không cần vào trang này.</p>
        </div>

        <div className="zine-box mt-7 p-5 space-y-4">
          <div>
            <label htmlFor="lock-pass" className="block text-[13px] font-bold mb-1.5">Mật khẩu</label>
            <div className="relative">
              <input
                id="lock-pass"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus
                className={`${input} pr-12`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#444]"
                aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="lock-slug" className="block text-[13px] font-bold mb-1.5">Tên link thiệp đã tạo</label>
            <div className={`${input} flex items-center gap-0.5 px-0 overflow-hidden`}>
              <span className="pl-4 text-[14px] font-medium text-[#777] whitespace-nowrap">{location.host}/</span>
              <input id="lock-slug" className="flex-1 min-w-0 h-full bg-transparent outline-none font-bold" value={slug} onChange={(e) => setSlug(e.target.value)} autoCapitalize="off" spellCheck={false} />
            </div>
            <p className="mt-1.5 text-[12px] text-[#555] leading-snug">Để sửa tiếp thiệp đã tạo trên máy này. Chưa tạo thiệp thì để trống.</p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border-2 border-[#b91c1c] bg-[#fdecec] px-3 py-2 text-[14px] font-semibold text-[#b91c1c]">
              {error}
            </p>
          )}

          <button type="submit" disabled={!password || busy} className="zine-btn zine-btn--yellow w-full disabled:opacity-60">
            <LockKeyhole className="w-5 h-5" /> {busy ? 'Đang kiểm tra…' : 'Mở khoá'}
          </button>
        </div>
      </form>
    </div>
  )
}
