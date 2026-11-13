import React from 'react'

/** Logo Trường ĐH Công Thương TP.HCM (public/logo-huit.png) – ô tròn, kích thước theo className */
export const HuitLogo: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <img src="/logo-huit.png" alt="HUIT" width={148} height={148} decoding="async" className={`${className} shrink-0 rounded-full bg-white object-contain`} />
)
