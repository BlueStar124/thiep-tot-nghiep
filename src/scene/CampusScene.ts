import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  BUILDINGS,
  BOARD,
  CAMPUS,
  STREET,
  MAIN_ROAD,
  SIDE_ROAD,
  GATE,
  GARDEN,
  LIB_PLAZA,
  BACKDROP,
  ROUTE,
  CHAPTERS,
  FLOOR,
  type Building
} from '../config/campus'
import type { Invitation } from '../config/invitation'
import { LABEL_ANCHORS, MINOR_LABELS } from './anchors'
import { gateLettersTexture, gateLedTexture, signTexture, backdropTexture } from '../lib/textures'

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Màu Thư viện theo ảnh thật: kính xanh đen, khung xám nhạt, ốp kim loại sáng, viền xanh HUIT */
const LIB = {
  mullion: '#b7c3cc',
  slab: '#e6eaee',
  trim: '#f4f6f8',
  panel: '#d3d9df',
  glass: '#22384a',
  blue: '#2f7ae5',
  planter: '#5fae5a'
}

const COLORS = {
  board: '#f4f2ed',
  boardSide: '#dfe3e9',
  campus: '#eceae4',
  road: '#d5d9df',
  street: '#bcc2cb',
  sidewalk: '#e5e3dd',
  line: '#ffffff',
  wall: '#fbfbf9',
  band: '#9cc8ec',
  bandDark: '#6aa7dc',
  roof: '#e9edf1',
  libGlass: '#3c5566',
  grass: '#cfe5c4',
  tree: ['#3fb39a', '#56c2a6', '#2f9f87', '#6ccbb0'],
  trunk: '#a1845f',
  red: '#e11d48',
  blue: '#1d4ed8',
  copper: '#c77b3c'
}

type Bucket = { mat: THREE.Material; geos: THREE.BufferGeometry[]; castShadow: boolean }

/** Gom hình khối tĩnh theo vật liệu → mỗi màu chỉ 1 draw call */
class StaticBuilder {
  private buckets = new Map<string, Bucket>()
  private mats = new Map<string, THREE.MeshLambertMaterial>()

  mat(color: string) {
    let m = this.mats.get(color)
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color })
      this.mats.set(color, m)
    }
    return m
  }

  add(geo: THREE.BufferGeometry, color: string, matrix: THREE.Matrix4, castShadow = true) {
    const key = color + (castShadow ? '' : '_ns')
    let b = this.buckets.get(key)
    if (!b) {
      b = { mat: this.mat(color), geos: [], castShadow }
      this.buckets.set(key, b)
    }
    const src = geo.index ? geo.toNonIndexed() : geo.clone()
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', src.getAttribute('position'))
    g.setAttribute('normal', src.getAttribute('normal'))
    g.applyMatrix4(matrix)
    b.geos.push(g)
  }

  box(color: string, x: number, y: number, z: number, w: number, h: number, d: number, castShadow = true, ry = 0) {
    this.add(UNIT_BOX, color, m4(x, y + h / 2, z, w, h, d, ry), castShadow)
  }

  build(scene: THREE.Scene) {
    for (const b of this.buckets.values()) {
      const merged = mergeGeometries(b.geos, false)
      b.geos.forEach((g) => g.dispose())
      if (!merged) continue
      const mesh = new THREE.Mesh(merged, b.mat)
      mesh.castShadow = b.castShadow
      mesh.receiveShadow = true
      mesh.matrixAutoUpdate = false
      scene.add(mesh)
    }
    this.buckets.clear()
  }
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)

function m4(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz))
}

export class CampusScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000)
  private raf = 0
  private last = performance.now()
  private elapsed = 0
  private progress = 0
  private shown = 0
  private width = 1
  private height = 1
  private isMobile: boolean
  private vehicles: { obj: THREE.Object3D; path: THREE.CurvePath<THREE.Vector3> | THREE.LineCurve3; s: number; speed: number; len: number }[] = []
  private walkers!: THREE.InstancedMesh
  private walkerState: { a: THREE.Vector3; b: THREE.Vector3; t: number; speed: number }[] = []
  private avatar = new THREE.Group()
  private avatarRing!: THREE.Mesh
  private hallPin = new THREE.Group()
  private trail!: THREE.InstancedMesh
  private trailS: number[] = []
  private trailDone = -1
  private routeCurve: THREE.CurvePath<THREE.Vector3>
  private routeLen = 0
  private waypointS: number[] = []
  private highlightMeshes = new Map<string, THREE.Mesh>()
  private backdropMat?: THREE.MeshBasicMaterial
  private labelEls: () => Map<string, HTMLElement>
  private tmp = new THREE.Vector3()
  private target = new THREE.Vector3()
  private disposed = false
  /** 1 = chừa chỗ cho thẻ chữ (lệch khung), 0 = thẻ đã ẩn → sa bàn về giữa màn hình */
  private frameOffset = 1
  private frameOffsetTarget = 1
  private frames = 0
  private frameTime = 0
  private qualityChecked = false

  constructor(container: HTMLElement, invitation: Invitation, labelEls: () => Map<string, HTMLElement>) {
    this.labelEls = labelEls
    this.isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.75 : 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.shadowMap.enabled = !this.isMobile
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.shadowMap.needsUpdate = true
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%'
    container.appendChild(this.renderer.domElement)

    // Lộ trình
    const pts = ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z))
    this.routeCurve = new THREE.CurvePath<THREE.Vector3>()
    const cum: number[] = [0]
    for (let i = 0; i < pts.length - 1; i++) {
      const seg = new THREE.LineCurve3(pts[i], pts[i + 1])
      this.routeCurve.add(seg)
      cum.push(cum[i] + pts[i].distanceTo(pts[i + 1]))
    }
    this.routeLen = cum[cum.length - 1]
    this.waypointS = cum

    this.build(invitation)
    this.resize(container.clientWidth, container.clientHeight)
    this.renderer.compile(this.scene, this.camera)
    this.loop()
  }

  // ───────────────────────── Dựng sa bàn ─────────────────────────
  private build(inv: Invitation) {
    const S = new StaticBuilder()
    const scene = this.scene

    scene.add(new THREE.HemisphereLight('#ffffff', '#cfc8bb', 1.9))
    const sun = new THREE.DirectionalLight('#fff6e8', 2.2)
    sun.position.set(-70, 110, 60)
    sun.castShadow = !this.isMobile
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 90, bottom: -90, near: 1, far: 320 })
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.4
    scene.add(sun)

    // Bệ sa bàn
    const bw = BOARD.maxX - BOARD.minX
    const bd = BOARD.maxZ - BOARD.minZ
    const board = new THREE.Mesh(new RoundedBoxGeometry(bw, 4, bd, 4, 2.5), new THREE.MeshLambertMaterial({ color: COLORS.boardSide }))
    board.position.set((BOARD.minX + BOARD.maxX) / 2, -2, (BOARD.minZ + BOARD.maxZ) / 2)
    board.receiveShadow = true
    scene.add(board)
    S.box(COLORS.board, board.position.x, -0.02, board.position.z, bw - 1.2, 0.04, bd - 1.2, false)

    // Khuôn viên, đường
    const cw = CAMPUS.maxX - CAMPUS.minX
    const cd = CAMPUS.maxZ - CAMPUS.minZ
    S.box(COLORS.campus, (CAMPUS.minX + CAMPUS.maxX) / 2, 0.02, (CAMPUS.minZ + CAMPUS.maxZ) / 2, cw, 0.04, cd, false)
    S.box(COLORS.street, STREET.x, 0.03, (BOARD.minZ + BOARD.maxZ) / 2, STREET.w, 0.05, bd - 2, false)
    S.box(COLORS.sidewalk, STREET.x + STREET.w / 2 + 0.9, 0.03, (BOARD.minZ + BOARD.maxZ) / 2, 1.8, 0.14, bd - 2, false)
    S.box(COLORS.sidewalk, STREET.x - STREET.w / 2 - 0.9, 0.03, (BOARD.minZ + BOARD.maxZ) / 2, 1.8, 0.14, bd - 2, false)
    for (let z = BOARD.minZ + 3; z < BOARD.maxZ - 3; z += 5) S.box(COLORS.line, STREET.x, 0.09, z, 0.25, 0.02, 2.4, false)
    S.box(COLORS.road, (MAIN_ROAD.minX + MAIN_ROAD.maxX) / 2, 0.05, MAIN_ROAD.z, MAIN_ROAD.maxX - MAIN_ROAD.minX, 0.05, MAIN_ROAD.d, false)
    S.box(COLORS.road, SIDE_ROAD.x, 0.05, (SIDE_ROAD.minZ + SIDE_ROAD.maxZ) / 2, SIDE_ROAD.w, 0.05, SIDE_ROAD.maxZ - SIDE_ROAD.minZ, false)
    for (let x = MAIN_ROAD.minX + 6; x < MAIN_ROAD.maxX - 6; x += 5) S.box(COLORS.line, x, 0.11, MAIN_ROAD.z, 2.4, 0.02, 0.25, false)
    // Vạch qua đường trước cổng
    for (let i = 0; i < 7; i++) S.box(COLORS.line, STREET.x, 0.09, GATE.z - 4.5 + i * 1.5, STREET.w - 1, 0.02, 0.7, false)
    // Vườn cây
    S.box(COLORS.grass, (GARDEN.minX + GARDEN.maxX) / 2, 0.06, (GARDEN.minZ + GARDEN.maxZ) / 2, GARDEN.maxX - GARDEN.minX - 2, 0.08, GARDEN.maxZ - GARDEN.minZ - 2, false)
    S.box(COLORS.campus, (GARDEN.minX + GARDEN.maxX) / 2, 0.08, -9.5, GARDEN.maxX - GARDEN.minX - 2, 0.08, 2.4, false)
    S.box(COLORS.campus, 37.5, 0.08, (GARDEN.minZ + GARDEN.maxZ) / 2, 2.4, 0.08, GARDEN.maxZ - GARDEN.minZ - 2, false)
    // Sân trước Thư viện: nền lát, lối đi thẳng vào sảnh, 2 bồn cỏ
    const P = LIB_PLAZA
    const pcx = (P.minX + P.maxX) / 2
    const pcz = (P.minZ + P.maxZ) / 2
    S.box('#f1efe9', pcx, 0.06, pcz, P.maxX - P.minX, 0.06, P.maxZ - P.minZ, false)
    S.box('#e4e1d9', -15.2, 0.09, pcz, 6, 0.06, P.maxZ - P.minZ, false)
    for (const [cx, w] of [[(P.minX - 15.2 - 3) / 2 - 0.5, -15.2 - 3 - P.minX - 5], [(P.maxX - 15.2 + 3) / 2 + 0.5, P.maxX + 15.2 - 3 - 5]] as const)
      S.box(COLORS.grass, cx, 0.1, pcz - 1, w, 0.12, P.maxZ - P.minZ - 9, false)

    // Tường rào
    const fence = '#d9dde3'
    S.box(fence, CAMPUS.minX + 0.3, 0, (CAMPUS.minZ + GATE.z - GATE.span / 2) / 2, 0.6, 1.4, GATE.z - GATE.span / 2 - CAMPUS.minZ)
    S.box(fence, CAMPUS.minX + 0.3, 0, (GATE.z + GATE.span / 2 + CAMPUS.maxZ) / 2, 0.6, 1.4, CAMPUS.maxZ - GATE.z - GATE.span / 2)
    S.box(fence, (CAMPUS.minX + SIDE_ROAD.x - SIDE_ROAD.w / 2) / 2, 0, CAMPUS.minZ + 0.3, SIDE_ROAD.x - SIDE_ROAD.w / 2 - CAMPUS.minX, 1.4, 0.6)
    S.box(fence, (SIDE_ROAD.x + SIDE_ROAD.w / 2 + CAMPUS.maxX) / 2, 0, CAMPUS.minZ + 0.3, CAMPUS.maxX - SIDE_ROAD.x - SIDE_ROAD.w / 2, 1.4, 0.6)
    S.box(fence, CAMPUS.maxX - 0.3, 0, 0, 0.6, 1.4, cd)
    S.box(fence, (CAMPUS.minX + CAMPUS.maxX) / 2, 0, CAMPUS.maxZ - 0.3, cw, 1.4, 0.6)

    // Toà nhà
    for (const b of BUILDINGS) this.addBuilding(S, b)

    // Cổng chính (theo ảnh: khung xanh, lam đồng, chữ nổi trên nóc, cổng hơi đỏ)
    const gx = GATE.x - 1.5
    const half = GATE.span / 2
    S.box(COLORS.blue, gx, 0, GATE.z - half - 0.6, 3, 11, 1.2)
    S.box(COLORS.blue, gx, 0, GATE.z + half + 0.6, 3, 11, 1.2)
    S.box(COLORS.blue, gx, 10, GATE.z, 3, 1.4, GATE.span + 2.4)
    for (let i = 0; i < 8; i++) S.box(COLORS.copper, gx - 1.6, 0.6, GATE.z - half - 4.6 + i * 0.5, 0.25, 9.8, 0.25)
    S.box('#ffffff', gx + 0.6, 0, GATE.z - half - 1.4, 2.2, 1.4, 0.6)
    const letters = new THREE.Mesh(new THREE.PlaneGeometry(GATE.span + 6, 1.7), new THREE.MeshBasicMaterial({ map: gateLettersTexture(), transparent: true }))
    letters.position.set(gx - 1.55, 12.3, GATE.z)
    letters.rotation.y = -Math.PI / 2
    scene.add(letters)
    const led = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), new THREE.MeshBasicMaterial({ map: gateLedTexture() }))
    led.position.set(gx - 1.55, 9.2, GATE.z)
    led.rotation.y = -Math.PI / 2
    scene.add(led)
    const arch = new THREE.Mesh(new THREE.TorusGeometry(half - 1.4, 0.7, 10, 40, Math.PI), new THREE.MeshLambertMaterial({ color: '#ef4444' }))
    arch.position.set(gx + 3, 0, GATE.z)
    arch.rotation.y = Math.PI / 2
    arch.castShadow = true
    scene.add(arch)

    // Cổng phụ
    S.box('#cbd5e1', SIDE_ROAD.x - SIDE_ROAD.w / 2 - 0.6, 0, CAMPUS.minZ + 0.3, 1, 4, 1)
    S.box('#cbd5e1', SIDE_ROAD.x + SIDE_ROAD.w / 2 + 0.6, 0, CAMPUS.minZ + 0.3, 1, 4, 1)

    // Backdrop check-in trong vườn
    const bd2 = new THREE.Group()
    bd2.position.set(BACKDROP.x, 0, BACKDROP.z)
    bd2.rotation.y = BACKDROP.rot
    const frame = new THREE.Mesh(new THREE.BoxGeometry(8, 4.8, 0.4), new THREE.MeshLambertMaterial({ color: '#fbbf24' }))
    frame.position.y = 3
    frame.castShadow = true
    bd2.add(frame)
    this.backdropMat = new THREE.MeshBasicMaterial({ map: backdropTexture(inv.graduateName, inv.degreeTitle, inv.faculty) })
    const bdPlane = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.3), this.backdropMat)
    bdPlane.position.set(0, 3, 0.21)
    bd2.add(bdPlane)
    const bdBack = bdPlane.clone()
    bdBack.position.z = -0.21
    bdBack.rotation.y = Math.PI
    bd2.add(bdBack)
    scene.add(bd2)
    const balloonGeo = new THREE.SphereGeometry(0.45, 14, 10)
    const balloons: THREE.Matrix4[] = []
    const balloonColors: THREE.Color[] = []
    const bp = ['#e11d48', '#ffffff', '#fbbf24', '#1d4ed8']
    for (const side of [-4.6, 4.6])
      for (let i = 0; i < 9; i++) {
        const v = new THREE.Vector3(side, 0.5 + i * 0.6, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, BACKDROP.rot)
        balloons.push(m4(BACKDROP.x + v.x, v.y, BACKDROP.z + v.z, 1, 1.15, 1))
        balloonColors.push(new THREE.Color(bp[(i + (side > 0 ? 1 : 0)) % bp.length]))
      }
    scene.add(this.instanced(balloonGeo, balloons, balloonColors))

    // Cây xanh tròn (phong cách sa bàn)
    const treeSpots: [number, number, number][] = []
    for (const x of [21.6, 32.4, 43.2, 53.4]) for (const z of [-19.8, -14, 2.4]) if (!(z === -14 && (x === 43.2 || x === 32.4))) treeSpots.push([x, z, 1.15])
    for (let x = -40; x <= 52; x += 8) {
      if (Math.abs(x + 9) > 6) treeSpots.push([x, 4.4, 0.85])
      treeSpots.push([x + 4, 23.2, 0.85])
    }
    for (let z = -44; z <= 50; z += 9) treeSpots.push([STREET.x - STREET.w / 2 - 3.2, z, 0.9])
    for (const z of [-36, -26, 26]) treeSpots.push([-64.2, z, 0.8])
    for (const x of [-36, -27, 1, 10]) for (const z of [-13, -4.5]) treeSpots.push([x, z, 0.95]) // sân trước Thư viện
    const crownGeo = new THREE.IcosahedronGeometry(1.8, 1)
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 2.2, 6)
    treeSpots.forEach(([x, z, s], i) => {
      S.add(trunkGeo, COLORS.trunk, m4(x, 1.1 * s, z, s, s, s))
      S.add(crownGeo, COLORS.tree[i % COLORS.tree.length], m4(x, 3.4 * s, z, s, s * 1.05, s, i))
    })

    S.build(scene)

    // ── Hội trường C: ghim đỏ nổi + vòng sóng ──
    const pinMat = new THREE.MeshLambertMaterial({ color: COLORS.red, emissive: '#7f1d1d', emissiveIntensity: 0.4 })
    const pinHead = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), pinMat)
    pinHead.position.y = 3.6
    const pinTip = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.8, 20), pinMat)
    pinTip.rotation.x = Math.PI
    pinTip.position.y = 1.4
    const pinDot = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    pinDot.position.y = 3.6
    pinDot.position.x = -0.95
    this.hallPin.add(pinHead, pinTip, pinDot)
    this.hallPin.position.set(71.3, 6 * FLOOR + 1.2, 3.6)
    scene.add(this.hallPin)

    // ── "Bạn" – khách mời đi theo lộ trình ──
    const youMat = new THREE.MeshLambertMaterial({ color: COLORS.red })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 1.8, 16), youMat)
    body.position.y = 0.9
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshLambertMaterial({ color: '#f6d2b0' }))
    head.position.y = 2.35
    this.avatarRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 32), new THREE.MeshBasicMaterial({ color: COLORS.red, transparent: true, opacity: 0.6, side: THREE.DoubleSide }))
    this.avatarRing.rotation.x = -Math.PI / 2
    this.avatarRing.position.y = 0.15
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.15 }))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.12
    this.avatar.add(body, head, this.avatarRing, shadow)
    this.avatar.scale.setScalar(1.25)
    scene.add(this.avatar)

    // ── Vệt đường đi (chấm tròn) ──
    const dots: THREE.Matrix4[] = []
    for (let s = 0; s <= this.routeLen; s += 2.2) {
      const p = this.routeCurve.getPointAt(s / this.routeLen)
      dots.push(m4(p.x, 0.16, p.z))
      this.trailS.push(s)
    }
    const dotColors = dots.map(() => new THREE.Color('#cbd5e1'))
    this.trail = this.instanced(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 12), dots, dotColors, false)
    scene.add(this.trail)

    // ── Xe cộ ──
    const vehicleMat = (c: string) => new THREE.MeshLambertMaterial({ color: c })
    const glass = vehicleMat('#334155')
    const makeCar = (color: string, len = 4.2, h = 1.4) => {
      const g = new THREE.Group()
      const b = new THREE.Mesh(new RoundedBoxGeometry(1.9, h, len, 2, 0.35), vehicleMat(color))
      b.position.y = h / 2 + 0.2
      const top = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.8, len * 0.55, 2, 0.25), glass)
      top.position.set(0, h + 0.55, -len * 0.05)
      g.add(b, top)
      return g
    }
    const makeBus = () => {
      const g = new THREE.Group()
      const b = new THREE.Mesh(new RoundedBoxGeometry(2.5, 2.8, 11, 2, 0.4), vehicleMat('#e11d48'))
      b.position.y = 1.7
      const w = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.8, 9.6), glass)
      w.position.y = 2.2
      g.add(b, w)
      return g
    }
    const makeBike = (color: string) => {
      const g = new THREE.Group()
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 1.7), vehicleMat(color))
      b.position.y = 0.6
      const rider = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), vehicleMat('#fde68a'))
      rider.position.y = 1.55
      g.add(b, rider)
      return g
    }
    const lane = (x: number, dir: number) => new THREE.LineCurve3(new THREE.Vector3(x, 0, dir > 0 ? BOARD.minZ + 2 : BOARD.maxZ - 2), new THREE.Vector3(x, 0, dir > 0 ? BOARD.maxZ - 2 : BOARD.minZ + 2))
    const streetCars: [THREE.Object3D, number, number, number][] = [
      [makeBus(), STREET.x + 2.2, 1, 7],
      [makeCar('#ffffff'), STREET.x - 2.2, -1, 9],
      [makeCar('#1d4ed8'), STREET.x + 2.2, 1, 10],
      [makeCar('#f59e0b'), STREET.x - 2.2, -1, 8]
    ]
    streetCars.forEach(([obj, x, dir, speed], i) => {
      const path = lane(x, dir)
      const len = path.getLength()
      this.vehicles.push({ obj, path, s: (i * 0.31 * len) % len, speed, len })
      scene.add(obj)
    })
    // Xe máy vào cổng → trục đường → nhà xe
    const bikePath = new THREE.CurvePath<THREE.Vector3>()
    const bp2 = [
      [STREET.x + 2.2, BOARD.maxZ - 2],
      [STREET.x + 2.2, MAIN_ROAD.z + 3],
      [SIDE_ROAD.x + 1.5, MAIN_ROAD.z + 3],
      [SIDE_ROAD.x + 1.5, 31]
    ].map(([x, z]) => new THREE.Vector3(x, 0, z))
    for (let i = 0; i < bp2.length - 1; i++) bikePath.add(new THREE.LineCurve3(bp2[i], bp2[i + 1]))
    const bikeLen = bikePath.getLength()
    ;['#ef4444', '#111827', '#3b82f6', '#a855f7', '#10b981'].forEach((c, i) => {
      const obj = makeBike(c)
      this.vehicles.push({ obj, path: bikePath, s: i * (bikeLen / 5), speed: 6.5, len: bikeLen })
      scene.add(obj)
    })

    // ── Người đi bộ (instanced, rất nhẹ) ──
    const walkerGeo = new THREE.CapsuleGeometry(0.42, 1.0, 4, 8)
    walkerGeo.translate(0, 0.95, 0)
    const n = this.isMobile ? 26 : 44
    const walkerColors: THREE.Color[] = []
    const palette = ['#1e293b', '#ffffff', '#f472b6', '#60a5fa', '#fbbf24', '#1e293b', '#e11d48']
    const spots: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(-58, 0, MAIN_ROAD.z - 5.8), new THREE.Vector3(55, 0, MAIN_ROAD.z - 5.8)],
      [new THREE.Vector3(55, 0, MAIN_ROAD.z + 5.8), new THREE.Vector3(-58, 0, MAIN_ROAD.z + 5.8)],
      [new THREE.Vector3(SIDE_ROAD.x - 2, 0, 30), new THREE.Vector3(SIDE_ROAD.x - 2, 0, -30)],
      [new THREE.Vector3(BACKDROP.x - 3, 0, BACKDROP.z + 3), new THREE.Vector3(BACKDROP.x + 4, 0, BACKDROP.z + 4)]
    ]
    for (let i = 0; i < n; i++) {
      const [a, b] = spots[i % spots.length]
      this.walkerState.push({ a, b, t: (i * 0.137) % 1, speed: 0.008 + (i % 5) * 0.002 })
      walkerColors.push(new THREE.Color(palette[i % palette.length]))
    }
    this.walkers = this.instanced(walkerGeo, Array.from({ length: n }, () => new THREE.Matrix4()), walkerColors)
    this.walkers.castShadow = false
    scene.add(this.walkers)
  }

  private addBuilding(S: StaticBuilder, b: Building) {
    const h = b.floors * FLOOR
    const x0 = b.x
    const z0 = b.z
    const isLib = b.kind === 'library'

    if (b.passage) {
      // Khối xây trên lối cổng xuyên qua (ví dụ Khu nhà F)
      const [p0, p1] = b.passage
      const zMin = z0 - b.d / 2
      const zMax = z0 + b.d / 2
      const pass = FLOOR * 1.35
      S.box(COLORS.wall, x0, 0, (zMin + p0) / 2, b.w, h, p0 - zMin)
      S.box(COLORS.wall, x0, 0, (p1 + zMax) / 2, b.w, h, zMax - p1)
      S.box(COLORS.wall, x0, pass, (p0 + p1) / 2, b.w, h - pass, p1 - p0)
      S.box('#e2e8f0', x0, pass - 0.25, (p0 + p1) / 2, b.w + 0.6, 0.25, p1 - p0 + 0.6)
    } else if (b.kind === 'parking') {
      for (let f = 0; f <= b.floors; f++) S.box(f === b.floors ? '#e2e8f0' : '#f1f5f9', x0, f * FLOOR, z0, b.w, 0.45, b.d)
      for (let i = 0; i <= 4; i++)
        for (const dz of [-b.d / 2 + 0.4, b.d / 2 - 0.4]) S.box('#e2e8f0', x0 - b.w / 2 + 0.4 + (i * (b.w - 0.8)) / 4, 0, z0 + dz, 0.6, h, 0.6)
      const carColors = ['#ef4444', '#1d4ed8', '#111827', '#f8fafc', '#f59e0b']
      for (let f = 0; f < b.floors; f++)
        for (let i = 0; i < 4; i++) if ((f + i) % 3 !== 0) S.box(carColors[(f * 2 + i) % carColors.length], x0 - 6 + i * 4, f * FLOOR + 0.45, z0, 1.8, 1.2, 3.6, false)
      S.box(b.accent, x0, h + 0.45, z0 - b.d / 2 + 0.2, b.w, 0.9, 0.4)
      return
    } else {
      S.box(isLib ? COLORS.libGlass : COLORS.wall, x0, 0, z0, b.w, h, b.d)
    }

    // Dải cửa sổ mỗi tầng + gờ sàn
    for (let f = 0; f < b.floors; f++) {
      const y = f * FLOOR + FLOOR * 0.38
      if (!isLib) {
        const bandColor = b.kind === 'hallC' && f === 3 ? COLORS.red : f % 2 ? COLORS.band : COLORS.bandDark
        if (b.passage) {
          const [p0, p1] = b.passage
          const zMin = z0 - b.d / 2
          const zMax = z0 + b.d / 2
          if (f > 0) S.box(bandColor, x0, y, z0, b.w + 0.12, FLOOR * 0.42, b.d + 0.12)
          else {
            S.box(bandColor, x0, y, (zMin + p0) / 2, b.w + 0.12, FLOOR * 0.42, p0 - zMin + 0.12)
            S.box(bandColor, x0, y, (p1 + zMax) / 2, b.w + 0.12, FLOOR * 0.42, zMax - p1 + 0.12)
          }
        } else S.box(bandColor, x0, y, z0, b.w + 0.12, FLOOR * 0.42, b.d + 0.12)
      }
      if (f > 0) S.box('#ffffff', x0, f * FLOOR - 0.12, z0, b.w + 0.35, 0.24, b.d + 0.35)
    }

    if (isLib) {
      // Theo ảnh thật: khối kính xanh đen, viền sàn trắng xám, mái bằng có lan can + bồn cây,
      // khối góc ốp tấm kim loại sáng màu cao hơn một chút ở đầu phía tây (hướng ra cổng).
      const xMin = x0 - b.w / 2
      const xMax = x0 + b.w / 2
      const zMin = z0 - b.d / 2
      const zMax = z0 + b.d / 2
      // Đố kính dọc (xám nhạt) trên 4 mặt
      for (let x = xMin; x <= xMax + 0.01; x += 2.4) {
        S.box(LIB.mullion, x, 0, zMax + 0.06, 0.16, h, 0.16)
        S.box(LIB.mullion, x, 0, zMin - 0.06, 0.16, h, 0.16)
      }
      for (let z = zMin; z <= zMax + 0.01; z += 2.4) {
        S.box(LIB.mullion, xMin - 0.06, 0, z, 0.16, h, 0.16)
        S.box(LIB.mullion, xMax + 0.06, 0, z, 0.16, h, 0.16)
      }
      // Mái bằng + lan can + viền xanh mép mái
      S.box(LIB.slab, x0, h, z0, b.w + 0.8, 0.5, b.d + 0.8)
      S.box(LIB.trim, x0, h + 0.5, zMax + 0.35, b.w + 0.8, 0.9, 0.18)
      S.box(LIB.trim, x0, h + 0.5, zMin - 0.35, b.w + 0.8, 0.9, 0.18)
      S.box(LIB.trim, xMin - 0.35, h + 0.5, z0, 0.18, 0.9, b.d + 0.8)
      S.box(LIB.trim, xMax + 0.35, h + 0.5, z0, 0.18, 0.9, b.d + 0.8)
      S.box(LIB.blue, x0, h + 0.38, zMax + 0.42, b.w + 0.8, 0.14, 0.06, false)
      // Bồn cây trên sân thượng + tum thang
      for (let x = xMin + 16; x <= xMax - 3; x += 4.2) S.box(LIB.planter, x, h + 0.5, zMax - 1.2, 2.6, 0.7, 1.1)
      S.box(LIB.panel, x0 + 14, h + 0.5, z0 - 2, 8, 2.6, 6)
      // Khối góc phía tây: ốp tấm kim loại sáng, kính đứng sẫm, cao hơn mái chính
      const cw = 13
      const cx = xMin + cw / 2 - 0.8
      S.box(LIB.panel, cx, 0, z0 + 0.6, cw, h + 2.2, b.d + 1.2)
      for (let i = 0; i < 5; i++) {
        const gx = xMin + 1.2 + i * 2.4
        S.box(LIB.glass, gx, 1.2, zMax + 0.66, 1.4, h - 0.6, 0.12, false)
      }
      for (let i = 0; i < 7; i++) {
        const gz = zMin + 1.6 + i * ((b.d - 2) / 6)
        S.box(LIB.glass, xMin - 1.42, 1.2, gz, 0.12, h - 0.6, 1.4, false)
      }
      // Nóc khối góc màu sáng, chỉ viền xanh mảnh ở mép (mặt nam + mặt tây) như ảnh
      S.box(LIB.trim, cx, h + 2.2, z0 + 0.6, cw + 0.3, 0.3, b.d + 1.5)
      S.box(LIB.blue, cx, h + 2.05, zMax + 1.36, cw + 0.3, 0.22, 0.06, false)
      S.box(LIB.blue, xMin - 1.46, h + 2.05, z0 + 0.6, 0.06, 0.22, b.d + 1.5, false)
      // Lối vào thư viện (mái đỏ phía nam)
      S.box(COLORS.red, x0 - 2, 3.2, z0 + b.d / 2 + 2, 16, 0.5, 4)
      S.box('#ffffff', x0 - 9.5, 0, z0 + b.d / 2 + 3.6, 0.4, 3.2, 0.4)
      S.box('#ffffff', x0 + 5.5, 0, z0 + b.d / 2 + 3.6, 0.4, 3.2, 0.4)
      this.addSign('LỐI VÀO TRUNG TÂM THƯ VIỆN', COLORS.red, x0 - 2, 4.3, z0 + b.d / 2 + 4.05, 0, 10)
    } else {
      S.box(COLORS.roof, x0, h, z0, b.w + 0.5, 0.6, b.d + 0.5)
      S.box('#f8fafc', x0, h + 0.6, z0, Math.min(6, b.w * 0.45), 2, Math.min(5, b.d * 0.3))
    }

    if (b.kind === 'hallC') {
      // Nhà C: sảnh phía tây (hướng ra đường nội bộ) + biển Hội trường C
      const fx = x0 - b.w / 2
      S.box(COLORS.red, fx - 2, 3.2, z0, 4, 0.45, 9)
      S.box('#ffffff', fx - 3.8, 0, z0 - 4.2, 0.4, 3.2, 0.4)
      S.box('#ffffff', fx - 3.8, 0, z0 + 4.2, 0.4, 3.2, 0.4)
      for (let i = 0; i < 3; i++) S.box('#c2410c', fx - 0.5 - i * 0.8, 0, z0, 0.8, 0.18 * (3 - i), 8)
      this.addSign('HỘI TRƯỜNG C · LẦU 3', COLORS.red, fx - 0.14, 3 * FLOOR + FLOOR * 0.38 + 0.7, z0, -Math.PI / 2, 14)
      this.addSign('PHÒNG KẾ HOẠCH TÀI CHÍNH', '#0f4c81', fx - 0.14, FLOOR * 1.38, z0 - 16, -Math.PI / 2, 12)
      this.addSign('PHÒNG ĐÀO TẠO', '#0f4c81', fx - 0.14, FLOOR * 1.38, z0 + 16, -Math.PI / 2, 9)
      this.addSign('KHU NHÀ C', '#0f4c81', fx - 4.1, 4.2, z0, -Math.PI / 2, 7)
    }
    if (b.id === 'F') this.addSign('KHU NHÀ F', '#0f4c81', x0 - b.w / 2 - 0.14, FLOOR * 2.38, z0 + 9.8, -Math.PI / 2, 8)
  }

  private addSign(text: string, bg: string, x: number, y: number, z: number, ry: number, w: number) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.156), new THREE.MeshBasicMaterial({ map: signTexture(text, bg), transparent: true }))
    m.position.set(x, y, z)
    m.rotation.y = ry
    this.scene.add(m)
  }

  private instanced(geo: THREE.BufferGeometry, mats: THREE.Matrix4[], colors?: THREE.Color[], shadow = true) {
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), mats.length)
    mats.forEach((m, i) => mesh.setMatrixAt(i, m))
    colors?.forEach((c, i) => mesh.setColorAt(i, c))
    mesh.castShadow = shadow
    mesh.instanceMatrix.needsUpdate = true
    return mesh
  }

  // ───────────────────────── API ─────────────────────────
  /** Thẻ chữ ẩn/hiện → trượt sa bàn về giữa hoặc lệch sang chừa chỗ */
  setCardsHidden(hidden: boolean) {
    this.frameOffsetTarget = hidden ? 0 : 1
  }

  setProgress(p: number) {
    this.progress = clamp(p, 0, CHAPTERS.length - 1)
  }

  setInvitation(inv: Invitation) {
    if (!this.backdropMat) return
    this.backdropMat.map?.dispose()
    this.backdropMat.map = backdropTexture(inv.graduateName, inv.degreeTitle, inv.faculty)
    this.backdropMat.needsUpdate = true
  }

  resize(w: number, h: number) {
    this.width = Math.max(1, w)
    this.height = Math.max(1, h)
    this.renderer.setSize(this.width, this.height, false)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
      mats.forEach((mat) => {
        ;(mat as THREE.MeshBasicMaterial).map?.dispose()
        mat.dispose()
      })
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ───────────────────────── Vòng lặp ─────────────────────────
  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    if (document.hidden) return
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.1)
    this.last = now
    this.elapsed += dt
    const t = this.elapsed

    this.shown += (this.progress - this.shown) * (1 - Math.exp(-dt * 4.5))
    if (Math.abs(this.progress - this.shown) < 0.0005) this.shown = this.progress
    const p = this.shown
    const i = Math.min(Math.floor(p), CHAPTERS.length - 2)
    const f = smooth(clamp(p - i, 0, 1))
    const A = CHAPTERS[i]
    const B = CHAPTERS[i + 1]

    // Camera isometric
    const fx = lerp(A.focus[0], B.focus[0], f)
    const fz = lerp(A.focus[1], B.focus[1], f)
    const radius = lerp(A.radius, B.radius, f)
    const idle = p < 0.3 || p > CHAPTERS.length - 1.3 ? Math.sin(t * 0.18) * 5 : 0
    const az = THREE.MathUtils.degToRad(lerp(A.azimuth, B.azimuth, f) + idle)
    const el = THREE.MathUtils.degToRad(36)
    this.target.set(fx, 0, fz)
    const dist = 260
    this.camera.position.set(fx - Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, fz + Math.cos(az) * Math.cos(el) * dist)
    this.camera.lookAt(this.target)
    const aspect = this.width / this.height
    const portrait = aspect < 1
    this.frameOffset += (this.frameOffsetTarget - this.frameOffset) * (1 - Math.exp(-dt * 5))
    // Ẩn thẻ → có thêm chỗ, phóng sa bàn to ra (điện thoại phóng nhiều hơn vì màn dọc)
    const zoomK = lerp(portrait ? 0.66 : 0.88, 1, this.frameOffset)
    const hh = (portrait ? (radius / aspect) * 0.76 : radius * 0.72) * zoomK
    const hw = hh * aspect
    // Chừa chỗ cho thẻ chữ: máy tính → lệch phải, điện thoại → lệch lên
    const shiftX = (portrait ? 0 : hw * 0.24) * this.frameOffset
    const shiftY = (portrait ? hh * 0.34 : 0) * this.frameOffset
    this.camera.left = -hw - shiftX
    this.camera.right = hw - shiftX
    this.camera.top = hh - shiftY
    this.camera.bottom = -hh - shiftY
    this.camera.updateProjectionMatrix()

    // Khách mời đi theo lộ trình
    const sA = this.waypointS[A.waypoint]
    const sB = this.waypointS[B.waypoint]
    const s = lerp(sA, sB, f)
    const u = clamp(s / this.routeLen, 0, 1)
    this.routeCurve.getPointAt(u, this.tmp)
    this.avatar.position.copy(this.tmp)
    const ahead = this.routeCurve.getPointAt(clamp(u + 0.002, 0, 1))
    if (ahead.distanceToSquared(this.tmp) > 1e-6) this.avatar.rotation.y = Math.atan2(ahead.x - this.tmp.x, ahead.z - this.tmp.z)
    const moving = Math.abs(this.progress - this.shown) > 0.01
    this.avatar.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.25 : 0
    const ring = (t * 0.9) % 1
    this.avatarRing.scale.setScalar(1 + ring * 1.6)
    ;(this.avatarRing.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - ring)

    // Vệt đường đã đi tô đỏ
    let done = 0
    while (done < this.trailS.length && this.trailS[done] <= s) done++
    if (done !== this.trailDone) {
      const red = new THREE.Color(COLORS.red)
      const grey = new THREE.Color('#cbd5e1')
      for (let k = 0; k < this.trailS.length; k++) this.trail.setColorAt(k, k < done ? red : grey)
      this.trail.instanceColor!.needsUpdate = true
      this.trailDone = done
    }

    // Ghim Hội trường C nhấp nhô
    this.hallPin.position.y = 6 * FLOOR + 1.6 + Math.sin(t * 2.2) * 0.6
    this.hallPin.rotation.y = t * 0.8

    // Xe cộ
    const crossing = Math.abs(this.avatar.position.x - STREET.x) < 6 && Math.abs(this.avatar.position.z - GATE.z) < 9
    for (const v of this.vehicles) {
      const pos = v.path.getPointAt(v.s / v.len)
      const nearGate = Math.abs(pos.z - GATE.z) < 13 && Math.abs(pos.z - GATE.z) > 6 && Math.abs(pos.x - STREET.x) < 5
      if (!(crossing && nearGate)) v.s = (v.s + v.speed * dt) % v.len
      const p2 = v.path.getPointAt(clamp((v.s + 0.5) / v.len, 0, 1))
      v.obj.position.copy(pos)
      if (p2.distanceToSquared(pos) > 1e-6) v.obj.rotation.y = Math.atan2(p2.x - pos.x, p2.z - pos.z)
    }

    // Người đi bộ
    const mtx = new THREE.Matrix4()
    this.walkerState.forEach((w, k) => {
      w.t += w.speed * dt * 10
      if (w.t > 1) w.t -= 1
      const tt = w.t < 0.5 ? w.t * 2 : 2 - w.t * 2
      this.tmp.lerpVectors(w.a, w.b, tt)
      const bob = Math.abs(Math.sin(t * 8 + k)) * 0.12
      mtx.makeTranslation(this.tmp.x + (k % 3) * 0.9, bob, this.tmp.z + ((k * 7) % 5) * 0.4)
      this.walkers.setMatrixAt(k, mtx)
    })
    this.walkers.instanceMatrix.needsUpdate = true

    if (!this.qualityChecked) {
      this.frames++
      this.frameTime += dt
      if (this.frames >= 90) {
        this.qualityChecked = true
        if (this.frameTime / this.frames > 1 / 40 && this.renderer.getPixelRatio() > 1) {
          this.renderer.setPixelRatio(1)
          this.renderer.setSize(this.width, this.height, false)
        }
      }
    }

    this.renderer.render(this.scene, this.camera)
    this.updateLabels(fx, fz, radius, B.highlight && f > 0.5 ? B.highlight : A.highlight)
  }

  private labelCache = new Map<string, { tr: string; o: string; vis: boolean; active: string }>()

  private updateLabels(fx: number, fz: number, radius: number, highlight?: string) {
    const els = this.labelEls()
    for (const a of LABEL_ANCHORS) {
      const el = els.get(a.id)
      if (!el) continue
      if (a.id === 'you') this.tmp.copy(this.avatar.position).setY(4.2)
      else this.tmp.set(a.x, a.y, a.z)
      const d = Math.hypot(this.tmp.x - fx, this.tmp.z - fz)
      this.tmp.project(this.camera)
      const onScreen = this.tmp.x > -1.1 && this.tmp.x < 1.1 && this.tmp.y > -1.1 && this.tmp.y < 1.1
      let o = a.always ? 1 : clamp(1.6 - d / radius, 0, 1)
      if (radius > 55 && !a.always) o = MINOR_LABELS.has(a.id) && this.width < 640 ? 0 : a.building ? 0.92 : 0.7
      if (!onScreen) o = 0

      // Chỉ ghi DOM khi giá trị đổi → tránh tính lại style mỗi khung hình
      let c = this.labelCache.get(a.id)
      if (!c) {
        c = { tr: '', o: '', vis: false, active: '' }
        this.labelCache.set(a.id, c)
      }
      const vis = o > 0.02
      if (vis !== c.vis) {
        el.style.visibility = vis ? 'visible' : 'hidden'
        c.vis = vis
      }
      if (!vis) continue
      const sx = Math.round((this.tmp.x * 0.5 + 0.5) * this.width)
      const sy = Math.round((-this.tmp.y * 0.5 + 0.5) * this.height)
      const tr = `translate3d(${sx}px,${sy}px,0) translate(-50%,-100%)`
      if (tr !== c.tr) {
        el.style.transform = tr
        c.tr = tr
      }
      const os = o.toFixed(1)
      if (os !== c.o) {
        el.style.opacity = os
        c.o = os
      }
      const active = a.building && a.building === highlight ? '1' : '0'
      if (active !== c.active) {
        el.dataset.active = active
        c.active = active
      }
    }
  }
}
