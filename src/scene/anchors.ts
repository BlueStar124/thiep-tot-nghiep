/** Vị trí nhãn trên sa bàn – tách riêng để giao diện không phải tải three.js */
import { BUILDINGS, STREET, GATE, GARDEN, SIDE_ROAD, FLOOR } from '../config/campus'

export interface LabelAnchor {
  id: string
  x: number
  y: number
  z: number
  /** Toà nhà liên quan (để làm nổi bật) */
  building?: string
  /** Luôn hiện, không mờ theo khoảng cách */
  always?: boolean
}

export const LABEL_ANCHORS: LabelAnchor[] = [
  ...BUILDINGS.map((b) => ({ id: b.id, x: b.x, y: b.floors * FLOOR + (b.kind === 'library' ? 4.5 : 2.5), z: b.z, building: b.id })),
  { id: 'street', x: STREET.x, y: 1, z: -30 },
  { id: 'gate', x: GATE.x - 2, y: 12.5, z: GATE.z, building: 'F' },
  { id: 'garden', x: (GARDEN.minX + GARDEN.maxX) / 2, y: 7, z: GARDEN.minZ + 6 },
  { id: 'side-gate', x: SIDE_ROAD.x, y: 4, z: -41 },
  { id: 'hall', x: 66, y: 6 * FLOOR + 6, z: 3.6, building: 'C', always: true },
  { id: 'you', x: 0, y: 0, z: 0, always: true }
]

/** Nhãn phụ – ẩn ở cảnh toàn trường trên màn hình hẹp để khỏi chồng chữ */
export const MINOR_LABELS = new Set(['D', 'side-gate', 'garden', 'street', 'TS', 'XE'])

