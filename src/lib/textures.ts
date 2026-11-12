import * as THREE from 'three'

const SANS = '"Be Vietnam Pro", "Segoe UI", system-ui, sans-serif'
const SERIF = '"Playfair Display", Georgia, serif'

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, ctx: c.getContext('2d')! }
}

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function fit(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, font: (s: number) => string, size: number) {
  let s = size
  do {
    ctx.font = font(s)
    if (ctx.measureText(text).width <= maxW) break
    s -= 2
  } while (s > 10)
  ctx.fillText(text, x, y)
}

/** Chữ nổi trên nóc cổng (như ảnh thực tế) */
export function gateLettersTexture() {
  const { c, ctx } = canvas(2048, 160)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(15,23,42,0.35)'
  ctx.shadowBlur = 8
  fit(ctx, 'TRƯỜNG ĐẠI HỌC CÔNG THƯƠNG TP. HỒ CHÍ MINH', 1024, 84, 1980, (s) => `800 ${s}px ${SANS}`, 104)
  return tex(c)
}

/** Bảng LED dưới dầm cổng */
export function gateLedTexture() {
  const { c, ctx } = canvas(1024, 160)
  const g = ctx.createLinearGradient(0, 0, 1024, 0)
  g.addColorStop(0, '#1d4ed8')
  g.addColorStop(1, '#2563eb')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1024, 160)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  fit(ctx, 'LỄ TỐT NGHIỆP 2026 · CHÀO MỪNG QUÝ KHÁCH', 512, 84, 960, (s) => `800 ${s}px ${SANS}`, 62)
  return tex(c)
}

/** Biển một dòng */
export function signTexture(text: string, bg: string, fg = '#ffffff') {
  const { c, ctx } = canvas(1024, 160)
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(0, 0, 1024, 160, 28)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  fit(ctx, text, 512, 84, 940, (s) => `800 ${s}px ${SANS}`, 76)
  return tex(c)
}

/** Backdrop check-in mang tên tân cử nhân */
export function backdropTexture(name: string, degree: string, faculty: string) {
  const { c, ctx } = canvas(1024, 576)
  const g = ctx.createLinearGradient(0, 0, 1024, 576)
  g.addColorStop(0, '#0b2a6f')
  g.addColorStop(1, '#1d4ed8')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1024, 576)
  ctx.strokeStyle = '#fbbf24'
  ctx.lineWidth = 14
  ctx.strokeRect(22, 22, 980, 532)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fde68a'
  fit(ctx, 'HUIT · LỄ TỐT NGHIỆP 2026', 512, 110, 880, (s) => `700 ${s}px ${SANS}`, 40)
  ctx.fillStyle = '#ffffff'
  fit(ctx, `Chúc mừng ${degree}`, 512, 220, 880, (s) => `italic 600 ${s}px ${SERIF}`, 64)
  ctx.fillStyle = '#fef3c7'
  fit(ctx, name, 512, 340, 900, (s) => `700 ${s}px ${SERIF}`, 104)
  ctx.fillStyle = '#bfdbfe'
  fit(ctx, faculty, 512, 440, 880, (s) => `600 ${s}px ${SANS}`, 38)
  return tex(c)
}
