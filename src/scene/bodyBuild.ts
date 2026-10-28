import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { SYSTEM_IDS } from '../data/systems'
import type { SystemId } from '../types'
import { ANATOMY_BASE } from './anatomy'

/**
 * Corpo humano a partir da camada de pele do Z-Anatomy (regiões nomeadas, rosto, orelhas, cabelo).
 * Aqui o atlas vira um personagem: pele de uma cor só, cabelo, roupa e traje feitos como cascas
 * infladas das próprias regiões, e um id de sistema por vértice para clicar, destacar e dissolver.
 */

export const SYS_INDEX = Object.fromEntries(SYSTEM_IDS.map((s, i) => [s, i + 1])) as Record<SystemId, number>
export const SYS_BY_INDEX: (SystemId | null)[] = [null, ...SYSTEM_IDS]

export type Cloth = 'none' | 'torso' | 'arm' | 'leg' | 'foot' | 'wrist' | 'hand' | 'neck'
const CLOTH_ID: Record<Cloth, number> = { none: 0, torso: 1, arm: 2, leg: 3, foot: 4, wrist: 5, hand: 6, neck: 7 }
const CLOTH_BY_ID = Object.keys(CLOTH_ID) as Cloth[]

interface Rule { re: RegExp; sys: SystemId; cloth: Cloth; /** Conta para o sistema (clique, brilho), mas não dissolve ao abrir a região */ soft?: boolean }

// A primeira regra que casa vence. Nomes normalizados: minúsculos, sem _ nem sufixo L/R.
const RULES: Rule[] = [
  { re: /orbital region|infra orbital region|^eyebrow/, sys: 'neuro_ocular', cloth: 'none' },
  { re: /\(foot\)|\bfoot\b|ankle|malleol|retromalleolar|heel|hallucial|metatarsal|^sole|plantar/, sys: 'muscular', cloth: 'foot' },
  { re: /\bhand\b|^palm|palmar|^nail plate$/, sys: 'muscular', cloth: 'hand' },
  { re: /region of wrist|radial foveola/, sys: 'muscular', cloth: 'wrist' },
  { re: /deltoid|region of arm|bicipital|cubital|region of elbow|forearm/, sys: 'muscular', cloth: 'arm' },
  { re: /scapular|interscapular|infrascapular|lumbar|sacral|vertebral|auscultation|hip region|gluteal|anal region|urogenital|hypogastric/, sys: 'skeletal', cloth: 'torso' },
  { re: /region of thigh|region of knee|popliteal|region of leg/, sys: 'muscular', cloth: 'leg' },
  { re: /carotid|muscular triangle|submandibular|submental|supraclavicular|region of neck|sternocleidomastoid/, sys: 'immune', cloth: 'neck' },
  { re: /infraclavicular|deltopectoral|inguinal|femoral triangle/, sys: 'immune', cloth: 'torso' },
  { re: /pectoral|mammary|presternal|lateral region of thorax/, sys: 'cardiovascular', cloth: 'torso' },
  { re: /epigastric|hypochondriac|umbilic|lateral region of abdomen/, sys: 'nutrition', cloth: 'torso' },
  { re: /frontal|parietal|occipital|temporal|mastoid/, sys: 'behavior', cloth: 'none' },
  {
    re: /auric|helix|tragus|lobule|concha|scapha|cymba|crura|eminentia|intertragic|apex|buccal|mental|nasal|oral region|mouth|labial|philtrum|lip|nasolabial|zygomatic|parotid|notch|groove|tubercle|triangular|fossa/,
    sys: 'behavior',
    cloth: 'none',
    soft: true,
  },
]

const TINTS: { re: RegExp; rgb: [number, number, number] }[] = [
  { re: /oral region|labial|philtrum|upper lip|angle of mouth/, rgb: [1, 0.84, 0.82] },
  { re: /orbital region/, rgb: [0.96, 0.86, 0.84] },
  { re: /auric|helix|tragus|concha|lobule|scapha|cymba|crura|eminentia|intertragic|apex|triangular fossa/, rgb: [1, 0.9, 0.88] },
  { re: /buccal|zygomatic/, rgb: [1, 0.93, 0.92] },
]

export function normName(raw: string) {
  return raw.replace(/_/g, ' ').toLowerCase().replace(/\s+[lr](\s+\d+)?$/, '').replace(/\s+\d+$/, '').trim()
}

interface Part {
  pos: Float32Array
  nor: Float32Array
  idx: Uint32Array
}

export interface BaseBody {
  pos: Float32Array
  idx: Uint32Array
  vSys: Float32Array
  vCloth: Uint8Array
  vTint: Float32Array
  /** 1 nos vértices da região urogenital (suavizada, o personagem é sempre vestido) */
  vGroin: Uint8Array
  hair: Part
  brows: Part
  lashes: Part
  /** Altura da pele com cabelo e escala para 1.80 m */
  height: number
  scale: number
  unmatched: string[]
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
let basePromise: Promise<BaseBody> | null = null

function bakePart(meshes: THREE.Mesh[]): Part {
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  const v = new THREE.Vector3()
  for (const m of meshes) {
    const g = m.geometry
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    const nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld)
    const base = pos.length / 3
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)
      pos.push(v.x, v.y, v.z)
      if (n) v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize()
      else v.set(0, 1, 0)
      nor.push(v.x, v.y, v.z)
    }
    const flip = m.matrixWorld.determinant() < 0
    const count = g.index ? g.index.count : p.count
    for (let i = 0; i < count; i += 3) {
      const a = g.index ? g.index.getX(i) : i
      const b = g.index ? g.index.getX(i + 1) : i + 1
      const c = g.index ? g.index.getX(i + 2) : i + 2
      if (flip) idx.push(base + a, base + c, base + b)
      else idx.push(base + a, base + b, base + c)
    }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint32Array(idx) }
}

export function loadBase(): Promise<BaseBody> {
  basePromise ??= loader.loadAsync(`${ANATOMY_BASE}skin.glb`).then((gltf) => {
    const root = gltf.scene
    root.updateMatrixWorld(true)
    const head: THREE.Mesh[] = []
    const brows: THREE.Mesh[] = []
    const lashes: THREE.Mesh[] = []
    const regionMeshes: THREE.Mesh[] = []
    const unmatched = new Set<string>()
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (/^Hairs_of_head/.test(m.name)) head.push(m)
      else if (/^Hairs_of_eyebrow/.test(m.name)) brows.push(m)
      else if (/^Eyelashes/.test(m.name)) lashes.push(m)
      else if (/^Pubic/.test(m.name)) return
      else regionMeshes.push(m)
    })

    const pos: number[] = []
    const idx: number[] = []
    const vSys: number[] = []
    const vCloth: number[] = []
    const vTint: number[] = []
    const vGroin: number[] = []
    const v = new THREE.Vector3()
    const box = new THREE.Box3()
    for (const m of regionMeshes) {
      const g = m.geometry
      const p = g.getAttribute('position')
      const parent = m.parent && m.parent.name && m.parent.name !== 'Scene' ? m.parent.name : m.name
      const name = normName(parent)
      const rule = RULES.find((r) => r.re.test(name))
      if (!rule) unmatched.add(name)
      const sys = rule ? SYS_INDEX[rule.sys] + (rule.soft ? 0.25 : 0) : 0
      const cloth = rule ? CLOTH_ID[rule.cloth] : 0
      const tint = TINTS.find((t) => t.re.test(name))?.rgb ?? [1, 1, 1]
      const groin = /urogenital/.test(name) ? 1 : 0
      const baseIndex = pos.length / 3
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)
        pos.push(v.x, v.y, v.z)
        vSys.push(sys)
        vCloth.push(cloth)
        vTint.push(tint[0], tint[1], tint[2])
        vGroin.push(groin)
        box.expandByPoint(v)
      }
      const flip = m.matrixWorld.determinant() < 0
      const count = g.index ? g.index.count : p.count
      for (let i = 0; i < count; i += 3) {
        const a = g.index ? g.index.getX(i) : i
        const b = g.index ? g.index.getX(i + 1) : i + 1
        const c = g.index ? g.index.getX(i + 2) : i + 2
        if (flip) idx.push(baseIndex + a, baseIndex + c, baseIndex + b)
        else idx.push(baseIndex + a, baseIndex + b, baseIndex + c)
      }
    }
    const hairPart = bakePart(head)
    const hairBox = new THREE.Box3()
    for (let i = 0; i < hairPart.pos.length; i += 3) hairBox.expandByPoint(v.set(hairPart.pos[i], hairPart.pos[i + 1], hairPart.pos[i + 2]))
    box.union(hairBox)
    const height = box.max.y - box.min.y

    // Libera as malhas originais
    root.traverse((o) => {
      const mm = o as THREE.Mesh
      if (mm.isMesh) mm.geometry.dispose()
    })
    if (unmatched.size) console.warn('[body] regions without a rule', [...unmatched])
    console.info(`[body] skin baked: ${regionMeshes.length} regions, ${Math.round(idx.length / 3000)}k triangles, height ${height.toFixed(3)} m`)
    return {
      pos: new Float32Array(pos),
      idx: new Uint32Array(idx),
      vSys: new Float32Array(vSys),
      vCloth: new Uint8Array(vCloth),
      vTint: new Float32Array(vTint),
      vGroin: new Uint8Array(vGroin),
      hair: hairPart,
      brows: bakePart(brows),
      lashes: bakePart(lashes),
      height,
      scale: 1.8 / height,
      unmatched: [...unmatched],
    }
  })
  basePromise.catch(() => {
    basePromise = null
  })
  return basePromise
}

// ---------- Proporções ----------

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const bump = (x: number, c: number, w: number) => Math.exp(-((x - c) ** 2) / (2 * w * w))

export type Build = 'male' | 'female'

/** O atlas é masculino. 'female' estreita ombros e cabeça, alarga o quadril e modela o tórax. */
export function warp(p: THREE.Vector3, build: Build): THREE.Vector3 {
  if (build === 'male') return p
  const { y } = p
  let sx = 1 + 0.07 * bump(y, 0.86, 0.1) - 0.03 * bump(y, 1.08, 0.07) - 0.085 * smooth(1.2, 1.38, y)
  if (y > 1.45) sx = 0.935 // pescoço e cabeça
  p.x *= sx
  if (y > 1.4 && y < 1.56) p.z = -0.012 + (p.z + 0.012) * 0.95
  // Tórax: acréscimo suave na frente
  if (p.z > 0.035 && y > 1.2 && y < 1.4) {
    const side = Math.abs(p.x)
    p.z += 0.016 * bump(side, 0.075, 0.035) * bump(y, 1.295, 0.04)
  }
  return p
}

// ---------- Normais soldadas ----------

function weldedNormals(pos: Float32Array, idx: Uint32Array): Float32Array {
  const n = pos.length / 3
  const groups = new Map<string, number>()
  const gid = new Int32Array(n)
  let g = 0
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[3 * i] * 1e4)},${Math.round(pos[3 * i + 1] * 1e4)},${Math.round(pos[3 * i + 2] * 1e4)}`
    let id = groups.get(k)
    if (id === undefined) {
      id = g++
      groups.set(k, id)
    }
    gid[i] = id
  }
  const acc = new Float32Array(g * 3)
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2]
    const ax = pos[3 * a], ay = pos[3 * a + 1], az = pos[3 * a + 2]
    const ux = pos[3 * b] - ax, uy = pos[3 * b + 1] - ay, uz = pos[3 * b + 2] - az
    const vx = pos[3 * c] - ax, vy = pos[3 * c + 1] - ay, vz = pos[3 * c + 2] - az
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    for (const k of [a, b, c]) {
      acc[3 * gid[k]] += nx
      acc[3 * gid[k] + 1] += ny
      acc[3 * gid[k] + 2] += nz
    }
  }
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const x = acc[3 * gid[i]], y = acc[3 * gid[i] + 1], z = acc[3 * gid[i] + 2]
    const l = Math.hypot(x, y, z) || 1
    out[3 * i] = x / l
    out[3 * i + 1] = y / l
    out[3 * i + 2] = z / l
  }
  return out
}

// ---------- Cascas ----------

const COVER_OFFSET: Partial<Record<Cloth, number>> = { torso: 0.016, arm: 0.016, leg: 0.016, foot: 0.018 }
const SUIT_OFFSET: Partial<Record<Cloth, number>> = { torso: 0.034, arm: 0.034, leg: 0.034, foot: 0.038, neck: 0.026, wrist: 0.02, hand: 0.016 }

const hex = (h: string) => new THREE.Color(h)
const COVER_COLOR: Partial<Record<Cloth, THREE.Color>> = {
  torso: hex('#26385c'), arm: hex('#26385c'), leg: hex('#26385c'), foot: hex('#161a24'),
}
const SUIT_COLOR: Partial<Record<Cloth, THREE.Color>> = {
  torso: hex('#dde1e9'), arm: hex('#dde1e9'), leg: hex('#dde1e9'), neck: hex('#cfd5df'),
  wrist: hex('#9aa3b3'), hand: hex('#cfd5df'), foot: hex('#b6bdc9'),
}

interface Source {
  pos: Float32Array
  nor: Float32Array
  idx: Uint32Array
  base: BaseBody
}

/** Geometria só com os vértices das regiões escolhidas. `offset` infla ao longo da normal soldada. */
function extract(
  src: Source,
  pick: (cloth: Cloth) => boolean,
  offset: Partial<Record<Cloth, number>> | null,
  color: ((cloth: Cloth, tint: [number, number, number]) => THREE.Color) | null,
): THREE.BufferGeometry {
  const { pos, nor, idx, base } = src
  const n = pos.length / 3
  const remap = new Int32Array(n).fill(-1)
  let count = 0
  for (let i = 0; i < n; i++) if (pick(CLOTH_BY_ID[base.vCloth[i]])) remap[i] = count++
  const P = new Float32Array(count * 3)
  const B = new Float32Array(count * 3)
  const N = new Float32Array(count * 3)
  const S = new Float32Array(count)
  const C = new Float32Array(count * 3)
  for (let i = 0; i < n; i++) {
    const j = remap[i]
    if (j < 0) continue
    const cloth = CLOTH_BY_ID[base.vCloth[i]]
    const o = offset ? offset[cloth] ?? 0 : 0
    for (let k = 0; k < 3; k++) {
      B[3 * j + k] = pos[3 * i + k]
      P[3 * j + k] = pos[3 * i + k] + nor[3 * i + k] * o
      N[3 * j + k] = nor[3 * i + k]
    }
    S[j] = base.vSys[i]
    const tint: [number, number, number] = [base.vTint[3 * i], base.vTint[3 * i + 1], base.vTint[3 * i + 2]]
    const col = color ? color(cloth, tint) : new THREE.Color(tint[0], tint[1], tint[2])
    C[3 * j] = col.r
    C[3 * j + 1] = col.g
    C[3 * j + 2] = col.b
  }
  const I: number[] = []
  for (let t = 0; t < idx.length; t += 3) {
    const a = remap[idx[t]], b = remap[idx[t + 1]], c = remap[idx[t + 2]]
    if (a >= 0 && b >= 0 && c >= 0) I.push(a, b, c)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3))
  g.setAttribute('aBase', new THREE.BufferAttribute(B, 3))
  g.setAttribute('aSys', new THREE.BufferAttribute(S, 1))
  g.setAttribute('color', new THREE.BufferAttribute(C, 3))
  g.setIndex(new THREE.BufferAttribute(count > 65535 ? new Uint32Array(I) : new Uint32Array(I), 1))
  g.computeBoundingSphere()
  return g
}

function partGeometry(part: Part, build: Build, sys: number): THREE.BufferGeometry {
  const n = part.pos.length / 3
  const P = new Float32Array(part.pos)
  const v = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    v.set(P[3 * i], P[3 * i + 1], P[3 * i + 2])
    warp(v, build)
    P[3 * i] = v.x
    P[3 * i + 1] = v.y
    P[3 * i + 2] = v.z
  }
  const S = new Float32Array(n).fill(sys)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(part.nor), 3))
  g.setAttribute('aBase', new THREE.BufferAttribute(new Float32Array(P), 3))
  g.setAttribute('aSys', new THREE.BufferAttribute(S, 1))
  g.setIndex(new THREE.BufferAttribute(part.idx, 1))
  g.computeBoundingSphere()
  return g
}

export interface BodyVariant {
  /** Pele exposta: cabeça, pescoço, pulsos e mãos */
  skin: THREE.BufferGeometry
  cover: THREE.BufferGeometry
  suit: THREE.BufferGeometry
  /** Corpo inteiro, invisível, só para o clique */
  pick: THREE.BufferGeometry
  hair: THREE.BufferGeometry
  brows: THREE.BufferGeometry
  lashes: THREE.BufferGeometry
  build: Build
}

const variants = new Map<Build, Promise<BodyVariant>>()

export function getVariant(build: Build): Promise<BodyVariant> {
  let p = variants.get(build)
  if (!p) {
    p = loadBase().then((base) => {
      const t0 = performance.now()
      const pos = new Float32Array(base.pos)
      const v = new THREE.Vector3()
      const n = pos.length / 3
      for (let i = 0; i < n; i++) {
        v.set(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2])
        warp(v, build)
        pos[3 * i] = v.x
        pos[3 * i + 1] = v.y
        pos[3 * i + 2] = v.z
      }
      relaxGroin(pos, base)
      const nor = weldedNormals(pos, base.idx)
      const src: Source = { pos, nor, idx: base.idx, base }
      const skin = extract(src, (c) => c === 'none' || c === 'neck' || c === 'wrist' || c === 'hand', null, null)
      const cover = extract(src, (c) => c in COVER_OFFSET, COVER_OFFSET, (c) => COVER_COLOR[c] ?? new THREE.Color(1, 1, 1))
      const suit = extract(src, (c) => c in SUIT_OFFSET, SUIT_OFFSET, (c) => SUIT_COLOR[c] ?? new THREE.Color(1, 1, 1))
      const pick = extract(src, () => true, null, null)
      const out: BodyVariant = {
        skin, cover, suit, pick, build,
        hair: partGeometry(base.hair, build, SYS_INDEX.behavior),
        brows: partGeometry(base.brows, build, SYS_INDEX.neuro_ocular),
        lashes: partGeometry(base.lashes, build, SYS_INDEX.neuro_ocular),
      }
      console.info(`[body] ${build} variant built in ${Math.round(performance.now() - t0)} ms (skin ${skin.index!.count / 3000 | 0}k, coverall ${cover.index!.count / 3000 | 0}k, suit ${suit.index!.count / 3000 | 0}k triangles)`)
      return out
    })
    p.catch(() => variants.delete(build))
    variants.set(build, p)
  }
  return p
}

/**
 * Relaxa a região urogenital: os vértices livres viram a média dos vizinhos e os da borda
 * (compartilhados com outras regiões) ficam fixos. O resultado é uma membrana lisa entre o
 * abdômen e as coxas. O personagem é sempre vestido.
 */
function relaxGroin(pos: Float32Array, base: BaseBody) {
  const n = pos.length / 3
  const gmap = new Map<string, number>()
  const gid = new Int32Array(n)
  let g = 0
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[3 * i] * 1e4)},${Math.round(pos[3 * i + 1] * 1e4)},${Math.round(pos[3 * i + 2] * 1e4)}`
    let id = gmap.get(k)
    if (id === undefined) {
      id = g++
      gmap.set(k, id)
    }
    gid[i] = id
  }
  const free = new Uint8Array(g).fill(1)
  const any = new Uint8Array(g)
  for (let i = 0; i < n; i++) {
    any[gid[i]] = 1
    if (!base.vGroin[i]) free[gid[i]] = 0
  }
  const nb: Set<number>[] = Array.from({ length: g }, () => new Set<number>())
  const gp = new Float32Array(g * 3)
  for (let i = 0; i < n; i++) {
    gp[3 * gid[i]] = pos[3 * i]
    gp[3 * gid[i] + 1] = pos[3 * i + 1]
    gp[3 * gid[i] + 2] = pos[3 * i + 2]
  }
  const idx = base.idx
  for (let t = 0; t < idx.length; t += 3) {
    const a = gid[idx[t]], b = gid[idx[t + 1]], c = gid[idx[t + 2]]
    if (free[a]) { nb[a].add(b); nb[a].add(c) }
    if (free[b]) { nb[b].add(a); nb[b].add(c) }
    if (free[c]) { nb[c].add(a); nb[c].add(b) }
  }
  const freeList: number[] = []
  for (let k = 0; k < g; k++) if (free[k] && any[k] && nb[k].size) freeList.push(k)
  for (let it = 0; it < 700; it++) {
    for (const k of freeList) {
      let x = 0, y = 0, z = 0
      for (const j of nb[k]) {
        x += gp[3 * j]; y += gp[3 * j + 1]; z += gp[3 * j + 2]
      }
      const m = nb[k].size
      gp[3 * k] = x / m; gp[3 * k + 1] = y / m; gp[3 * k + 2] = z / m
    }
  }
  for (let i = 0; i < n; i++) {
    if (!free[gid[i]]) continue
    pos[3 * i] = gp[3 * gid[i]]
    pos[3 * i + 1] = gp[3 * gid[i] + 1]
    pos[3 * i + 2] = gp[3 * gid[i] + 2]
  }
}

// ---------- Posições do corpo no espaço do modelo (m), antes da deformação ----------

export const BODY_POINTS = {
  eyeL: new THREE.Vector3(0.031, 1.591, 0.0635),
  eyeR: new THREE.Vector3(-0.031, 1.591, 0.0635),
  eyeRadius: 0.0128,
  head: new THREE.Vector3(-0.003, 1.634, -0.018),
  neck: new THREE.Vector3(0, 1.45, -0.02),
  chest: new THREE.Vector3(0, 1.3, 0.04),
  waist: new THREE.Vector3(0, 1.03, 0),
  shoulderL: new THREE.Vector3(0.2, 1.395, -0.02),
  shoulderR: new THREE.Vector3(-0.2, 1.395, -0.02),
  elbowL: new THREE.Vector3(0.219, 1.125, -0.006),
  elbowR: new THREE.Vector3(-0.219, 1.125, -0.006),
  wristL: new THREE.Vector3(0.27, 0.846, 0.036),
  wristR: new THREE.Vector3(-0.27, 0.846, 0.036),
  kneeL: new THREE.Vector3(0.082, 0.443, 0.006),
  kneeR: new THREE.Vector3(-0.082, 0.443, 0.006),
  ankleL: new THREE.Vector3(0.081, 0.091, -0.039),
  ankleR: new THREE.Vector3(-0.081, 0.091, -0.039),
}
