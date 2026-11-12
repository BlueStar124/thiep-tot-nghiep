/** Dùng chung cho web và API: đổi tên tiếng Việt thành đoạn link không dấu, ví dụ "Cô Lan" → "co-lan" */
export function slugify(input: string, max = 40): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
}

/** Như slugify nhưng GIỮ chữ hoa – để link hiển thị đẹp, ví dụ "Xuân Cường" → "Xuan-Cuong", "XuanCuong" → "XuanCuong" */
export function slugDisplay(input: string, max = 40): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
}

/** Gợi ý tên link thiệp từ họ tên: lấy tên gọi (chữ cuối), ví dụ "Nguyễn Văn Minh" → "minh" */
export function ownerSlugFrom(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  return slugify(words[words.length - 1] ?? '') || 'thiep'
}

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

/** Những đường dẫn không được dùng làm tên thiệp */
export const RESERVED_SLUGS = new Set(['api', 'assets', 'index', 'index-html', 'admin', 'favicon-svg', 'anh-chinh-png', 'anh-phu-png'])

export interface Guest {
  slug: string
  name: string
}

/** Gán link cho từng khách, trùng tên thì thêm số: co-lan, co-lan-2… */
export function assignGuestSlugs(names: string[]): Guest[] {
  const used = new Set<string>()
  const out: Guest[] = []
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, 60)
    if (!name) continue
    const base = slugify(name) || 'khach'
    let slug = base
    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`
    used.add(slug)
    out.push({ slug, name })
  }
  return out
}
