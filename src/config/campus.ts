/**
 * Sa bàn HUIT – 140 Lê Trọng Tấn, dựng theo "Sơ đồ & quy trình nhập học" của trường:
 *  - Đường Lê Trọng Tấn chạy dọc bên trái, Cổng vào số 140 xuyên qua Khu nhà F.
 *  - Trục đường chính chạy ngang giữa trường tới dãy Khu nhà C ở mép phải.
 *  - Phía bắc trục đường: TT Tuyển sinh & Truyền thông, Trung tâm Thư viện (sân phía trước), Nhà D, vườn cây.
 *  - Phía nam: Khu nhà AB; góc dưới phải: Khu nhà xe 6 tầng. Cổng phụ ở góc trên phải.
 * Trục toạ độ: x → Đông (phải sơ đồ), z → Nam (dưới sơ đồ). Đơn vị ~ mét.
 */

export type BuildingKind = 'block' | 'library' | 'parking' | 'hallC'

export interface Building {
  id: string
  name: string
  sub?: string
  x: number
  z: number
  w: number
  d: number
  floors: number
  kind: BuildingKind
  /** Màu nhấn (dải cửa sổ / viền) */
  accent: string
  /** Chương liên quan – bấm nhãn để cuộn tới */
  chapter: number
  /** Không vẽ tầng trệt trong khoảng z này (lối cổng xuyên qua) */
  passage?: [number, number]
}

export const FLOOR = 3.4

export const BOARD = { minX: -82, maxX: 82, minZ: -50, maxZ: 54 }
export const CAMPUS = { minX: -67, maxX: 77, minZ: -42, maxZ: 42 }
export const STREET = { x: -71.6, w: 9 }
export const MAIN_ROAD = { minX: -67, maxX: 65.4, z: 13.8, d: 15.6 }
export const SIDE_ROAD = { x: 61.8, w: 7.2, minZ: -42, maxZ: 42 }
export const GATE = { x: -64, z: 13.8, span: 15.6 }
export const GARDEN = { minX: 17, maxX: 58, minZ: -25.8, maxZ: 6 }
/** Sân trước Thư viện (giữa Thư viện và trục đường chính) */
export const LIB_PLAZA = { minX: -42, maxX: 15.6, minZ: -20, maxZ: 4.5 }
export const BACKDROP = { x: 46, z: -4, rot: -0.5 }

export const BUILDINGS: Building[] = [
  { id: 'TS', name: 'TT Tuyển sinh & Truyền thông', sub: 'Phòng Y tế · Cầu thang', x: -52.8, z: -19.2, w: 14.4, d: 44.4, floors: 4, kind: 'block', accent: '#7db7e8', chapter: 2 },
  { id: 'F', name: 'Khu nhà F', sub: 'Cổng vào số 140 đi xuyên qua', x: -52.8, z: 16.8, w: 14.4, d: 27.6, floors: 5, kind: 'block', accent: '#7db7e8', chapter: 1, passage: [5.6, 22] },
  { id: 'TV', name: 'Trung tâm Thư viện', sub: 'Khu vực ngồi chờ · Thang máy', x: -13.2, z: -30.7, w: 57.6, d: 21.4, floors: 4, kind: 'library', accent: '#5fb3a1', chapter: 2 },
  { id: 'AB', name: 'Khu nhà AB', sub: 'Giảng đường', x: -1.8, z: 34.8, w: 87.6, d: 9, floors: 5, kind: 'block', accent: '#7db7e8', chapter: 2 },
  { id: 'D', name: 'Nhà D', x: 37.6, z: -34.2, w: 41.2, d: 14.4, floors: 3, kind: 'block', accent: '#7db7e8', chapter: 4 },
  { id: 'C', name: 'Khu nhà C', sub: 'Hội trường C · Lầu 3', x: 71.3, z: 3.6, w: 11, d: 52.8, floors: 6, kind: 'hallC', accent: '#e11d48', chapter: 5 },
  { id: 'XE', name: 'Khu nhà xe 6 tầng', x: 67.2, z: 35, w: 18, d: 9, floors: 6, kind: 'parking', accent: '#f59e0b', chapter: 3 }
]

/** Lộ trình khách đi (mặt đất) */
export const ROUTE: [number, number][] = [
  [-74.5, 50], // 0 vỉa hè Lê Trọng Tấn
  [-74.5, 13.8], // 1
  [-64, 13.8], // 2 Cổng số 140
  [-20, 13.8], // 3 ngang Thư viện
  [30, 13.8], // 4
  [SIDE_ROAD.x, 13.8], // 5 ngã ba cuối trục
  [SIDE_ROAD.x, 29.5], // 6 Khu nhà xe 6 tầng
  [SIDE_ROAD.x, 11], // 7 đi bộ trở lại
  [BACKDROP.x + 3, -0.5], // 8 khu check-in vườn cây
  [SIDE_ROAD.x + 1.2, 3.6] // 9 sảnh Khu nhà C
]

export interface Chapter {
  id: string
  kicker: string
  title: string
  body: string
  /** Điểm trên lộ trình mà "khách" đứng ở chương này */
  waypoint: number
  /** Tâm camera (x, z) và bán kính khung hình (m) */
  focus: [number, number]
  radius: number
  /** Góc camera (độ): ~90 = đứng phía đường Lê Trọng Tấn nhìn vào, trục đường chạy dọc màn hình */
  azimuth: number
  highlight?: string
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'mo-dau',
    kicker: 'Trân trọng kính mời',
    title: '',
    body: '',
    waypoint: 0,
    focus: [0, 2],
    radius: 104,
    azimuth: 78
  },
  {
    id: 'cong',
    kicker: '01 · Đến trường',
    title: 'Cổng vào số 140',
    body: 'Cổng chính nằm trên đường Lê Trọng Tấn và đi xuyên qua Khu nhà F. Có bảo vệ trực hướng dẫn.',
    waypoint: 2,
    focus: [-60, 12],
    radius: 24,
    azimuth: 68,
    highlight: 'F'
  },
  {
    id: 'truc-duong',
    kicker: '02 · Đi vào trong',
    title: 'Trục đường chính',
    body: 'Đi thẳng theo trục đường. Bên trái là TT Tuyển sinh & Truyền thông và Trung tâm Thư viện, bên phải là Khu nhà AB.',
    waypoint: 3,
    focus: [-6, 11],
    radius: 54,
    azimuth: 80,
    highlight: 'TV'
  },
  {
    id: 'nha-xe',
    kicker: '03 · Gửi xe',
    title: 'Khu nhà xe 6 tầng',
    body: 'Cuối trục đường rẽ phải là Khu nhà xe 6 tầng, gửi được cả xe máy và ô tô. Đi bộ quay lại khoảng 1 phút.',
    waypoint: 6,
    focus: [62, 28],
    radius: 24,
    azimuth: 62,
    highlight: 'XE'
  },
  {
    id: 'check-in',
    kicker: '04 · Chụp ảnh',
    title: 'Vườn cây & khu check-in',
    body: 'Sân vườn cây xanh trước Nhà D là nơi đặt backdrop. Hãy chụp cùng tân cử nhân trước giờ lễ nhé!',
    waypoint: 8,
    focus: [42, -10],
    radius: 26,
    azimuth: 86
  },
  {
    id: 'hoi-truong',
    kicker: '05 · Vào lễ',
    title: 'Hội trường C – Lầu 3',
    body: 'Dãy nhà dọc mép phải gồm Phòng Kế hoạch Tài chính, Khu nhà C và Phòng Đào tạo. Vào sảnh Khu nhà C, đi thang máy hoặc thang bộ lên Lầu 3.',
    waypoint: 9,
    focus: [66, 4],
    radius: 26,
    azimuth: 72,
    highlight: 'C'
  },
  {
    id: 'thiep',
    kicker: 'Hẹn gặp bạn',
    title: '',
    body: '',
    waypoint: 9,
    focus: [4, 0],
    radius: 98,
    azimuth: 80
  }
]
