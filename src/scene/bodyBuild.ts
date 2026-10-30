import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { SYSTEM_IDS } from '../data/systems'
import type { SystemId } from '../types'
import { ANATOMY_BASE } from './anatomy'
import { collarPlane, extractCollarLoop, type CollarLoop } from './collar'
import { cavityAO } from './meshAO'
import { ATLAS_ARM, makeArmPose, poseSym } from './pose'

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
  { re: /oral region|labial|philtrum|upper lip|angle of mouth/, rgb: [1, 0.93, 0.91] },
  { re: /orbital region/, rgb: [0.985, 0.94, 0.93] },
  { re: /auric|helix|tragus|concha|lobule|scapha|cymba|crura|eminentia|intertragic|apex|triangular fossa/, rgb: [1, 0.9, 0.88] },
  { re: /buccal|zygomatic/, rgb: [1, 0.975, 0.97] },
]

export function normName(raw: string) {
  return raw.replace(/_/g, ' ').toLowerCase().replace(/\s+[lr](\s+\d+)?$/, '').replace(/\s+\d+$/, '').trim()
}

interface Part {
  pos: Float32Array
  nor: Float32Array
  idx: Uint32Array
}

/** Vértices coincidentes (bordas entre regiões) formam um grupo; `start`/`adj` guardam os vizinhos de cada grupo. */
export interface Welds {
  gid: Int32Array
  count: number
  start: Int32Array
  adj: Int32Array
}

export interface BaseBody {
  pos: Float32Array
  idx: Uint32Array
  vSys: Float32Array
  vCloth: Uint8Array
  vTint: Float32Array
  /** 1 nos vértices da região urogenital (suavizada, o personagem é sempre vestido) */
  vGroin: Uint8Array
  /** 1 nos vértices da pele do rosto e da cabeça (sem as órbitas e as orelhas): recebem uma suavização leve */
  vFace: Uint8Array
  welds: Welds
  hair: Part
  brows: Part
  lashes: Part
  /** Altura da pele com cabelo e escala para 1.80 m */
  height: number
  scale: number
  unmatched: string[]
}

/**
 * Fecha buracos pequenos da cabeça. O atlas junta regiões por vértices coincidentes e deixa, aqui e ali, furinhos de um
 * ou dois vértices; por eles se via o interior escuro (um pontinho na testa, frestas nos lábios). Acha as bordas abertas
 * (arestas de um triângulo só), monta os laços e preenche com um leque até o centro os que têm menos de 12 mm de perímetro.
 * Os atributos por vértice (`attrs`, um valor por vértice, e `tint`, três) vêm do primeiro vértice do laço.
 */
function fillSmallHoles(pos: number[], idx: number[], attrs: number[][], tint: number[]): number {
  const n = pos.length / 3
  const gmap = new Map<string, number>()
  const gid = new Int32Array(n)
  const rep: number[] = []
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[3 * i] * 1e4)},${Math.round(pos[3 * i + 1] * 1e4)},${Math.round(pos[3 * i + 2] * 1e4)}`
    let g = gmap.get(k)
    if (g === undefined) {
      g = rep.length
      gmap.set(k, g)
      rep.push(i)
    }
    gid[i] = g
  }
  const G = rep.length
  const count = new Map<number, number>()
  const directed: [number, number][] = []
  for (let t = 0; t < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = gid[idx[t + e]], b = gid[idx[t + (e + 1) % 3]]
      if (a === b) continue
      const key = a < b ? a * G + b : b * G + a
      count.set(key, (count.get(key) ?? 0) + 1)
      directed.push([a, b])
    }
  }
  // Arestas de borda: usadas por um triângulo só; só as da cabeça (acima do pescoço)
  const next = new Map<number, number[]>()
  for (const [a, b] of directed) {
    if (count.get(a < b ? a * G + b : b * G + a) !== 1) continue
    const y = pos[3 * rep[a] + 1]
    if (y < 1.47) continue
    const list = next.get(a)
    if (list) list.push(b)
    else next.set(a, [b])
  }
  let filled = 0
  const used = new Set<number>()
  for (const [start, outs] of next) {
    for (const first of outs) {
      const loop = [start]
      let cur = first
      let ok = true
      while (cur !== start) {
        if (loop.length > 10 || used.has(cur)) {
          ok = false
          break
        }
        loop.push(cur)
        const nx = next.get(cur)
        if (!nx || nx.length !== 1) {
          ok = false
          break
        }
        cur = nx[0]
      }
      if (!ok || loop.length < 3) continue
      let per = 0
      for (let k = 0; k < loop.length; k++) {
        const a = rep[loop[k]], b = rep[loop[(k + 1) % loop.length]]
        per += Math.hypot(pos[3 * a] - pos[3 * b], pos[3 * a + 1] - pos[3 * b + 1], pos[3 * a + 2] - pos[3 * b + 2])
      }
      if (per > 0.012) continue
      // Leque até o centro do laço, com o sentido contrário ao das arestas existentes
      let cx = 0, cy = 0, cz = 0
      for (const g of loop) {
        cx += pos[3 * rep[g]]
        cy += pos[3 * rep[g] + 1]
        cz += pos[3 * rep[g] + 2]
      }
      const src = rep[loop[0]]
      const nv = pos.length / 3
      pos.push(cx / loop.length, cy / loop.length, cz / loop.length)
      for (const a of attrs) a.push(a[src])
      tint.push(tint[3 * src], tint[3 * src + 1], tint[3 * src + 2])
      for (let k = 0; k < loop.length; k++) idx.push(rep[loop[(k + 1) % loop.length]], rep[loop[k]], nv)
      for (const g of loop) used.add(g)
      filled++
    }
  }
  return filled
}

/**
 * Tira os triângulos que olham para dentro da cabeça na região da boca e do nariz (paredes internas de lábios e narinas).
 * Um triângulo "olha para dentro" se a normal pelo sentido dos vértices aponta contra o raio que sai do centro da cabeça.
 */
function dropInnerFaces(pos: number[], idx: number[]): number {
  const keep: number[] = []
  let dropped = 0
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2]
    const ax = pos[3 * a], ay = pos[3 * a + 1], az = pos[3 * a + 2]
    const cx = (ax + pos[3 * b] + pos[3 * c]) / 3, cy = (ay + pos[3 * b + 1] + pos[3 * c + 1]) / 3, cz = (az + pos[3 * b + 2] + pos[3 * c + 2]) / 3
    if (Math.abs(cx) < 0.078 && cy > 1.495 && cy < 1.575 && cz > 0.03) {
      const ux = pos[3 * b] - ax, uy = pos[3 * b + 1] - ay, uz = pos[3 * b + 2] - az
      const vx = pos[3 * c] - ax, vy = pos[3 * c + 1] - ay, vz = pos[3 * c + 2] - az
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      const rx = cx, ry = Math.max(-0.04, Math.min(0.04, cy - 1.585)), rz = cz + 0.005
      const nl = Math.hypot(nx, ny, nz) * Math.hypot(rx, ry, rz)
      if (nl > 0 && (nx * rx + ny * ry + nz * rz) / nl < -0.35) {
        dropped++
        continue
      }
    }
    keep.push(a, b, c)
  }
  idx.length = 0
  for (const k of keep) idx.push(k)
  return dropped
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
let basePromise: Promise<BaseBody> | null = null

/** O atlas deixa um tufo solto entre as sobrancelhas, que aparecia como um pontinho na testa: tira os triângulos do centro. */
function withoutCentre(part: Part): Part {
  const keep: number[] = []
  for (let t = 0; t < part.idx.length; t += 3) {
    let cx = 0
    for (let k = 0; k < 3; k++) cx += part.pos[3 * part.idx[t + k]]
    if (Math.abs(cx / 3) >= 0.011) keep.push(part.idx[t], part.idx[t + 1], part.idx[t + 2])
  }
  return { pos: part.pos, nor: part.nor, idx: Uint32Array.from(keep) }
}

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
    const vFace: number[] = []
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
      const face = /^(frontal|parietal|temporal|occipital|mastoid|buccal|mental|nasal|oral|zygomatic|parotid|nasolabial)|labial|philtrum|lip|carotid|submandibular|submental|region of neck|sternocleidomastoid|muscular triangle/.test(name) ? 1 : 0
      const baseIndex = pos.length / 3
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)
        pos.push(v.x, v.y, v.z)
        vSys.push(sys)
        vCloth.push(cloth)
        vTint.push(tint[0], tint[1], tint[2])
        vGroin.push(groin)
        vFace.push(face)
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

    // Boca e nariz: o atlas modela lábios e narinas como folhas fechadas; as paredes de dentro furavam a superfície em pontinhos
    // (cantos da boca, queixo, bochechas). Sem elas, o que se vê por uma abertura é o fundo da cabeça, que o shader escurece.
    const dropped = dropInnerFaces(pos, idx)
    if (dropped) console.info(`[body] ${dropped} inner mouth and nose triangles removed`)
    // Fecha os furinhos da cabeça (um vértice solto onde as duas metades do rosto se encontram, entre as sobrancelhas)
    const holes = fillSmallHoles(pos, idx, [vSys, vCloth, vGroin, vFace], vTint)
    if (holes) console.info(`[body] ${holes} small holes closed on the head`)

    // Libera as malhas originais
    root.traverse((o) => {
      const mm = o as THREE.Mesh
      if (mm.isMesh) mm.geometry.dispose()
    })
    if (unmatched.size) console.warn('[body] regions without a rule', [...unmatched])
    console.info(`[body] skin baked: ${regionMeshes.length} regions, ${Math.round(idx.length / 3000)}k triangles, height ${height.toFixed(3)} m`)
    const posF = new Float32Array(pos)
    const idxU = new Uint32Array(idx)
    const tintF = new Float32Array(vTint)
    const welds = buildWelds(posF, idxU)
    smoothTint(tintF, welds, 16)
    return {
      pos: posF,
      idx: idxU,
      vSys: new Float32Array(vSys),
      vCloth: new Uint8Array(vCloth),
      vTint: tintF,
      vGroin: new Uint8Array(vGroin),
      vFace: new Uint8Array(vFace),
      welds,
      hair: hairPart,
      brows: withoutCentre(bakePart(brows)),
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

/**
 * O atlas é masculino. 'female' estreita ombros, pescoço e cabeça, marca a cintura, alarga o quadril
 * e modela busto e glúteos. Só depende da posição, para valer também para pontos soltos (olhos, juntas).
 */
export function warp(p: THREE.Vector3, build: Build): THREE.Vector3 {
  if (build === 'male') return p
  const y = p.y
  const ax = Math.abs(p.x)
  const head = smooth(1.4, 1.46, y)
  // Largura por altura: ombros estreitos, cintura marcada, quadril e coxa alta largos (o braço fica de fora)
  const body =
    1 -
    0.13 * smooth(1.18, 1.4, y) -
    0.075 * bump(y, 1.08, 0.065) +
    0.115 * bump(y, 0.9, 0.085) * (1 - smooth(0.14, 0.21, ax))
  const neck = 1 - 0.08 * bump(y, 1.47, 0.04)
  p.x *= (body + (0.93 - body) * head) * neck
  // Cabeça menor: escala suave a partir do pescoço
  const hb = smooth(1.44, 1.52, y)
  const hs = 1 - 0.045 * hb
  p.y = 1.5 + (p.y - 1.5) * hs
  p.z = -0.02 + (p.z + 0.02) * (1 - 0.06 * smooth(1.4, 1.5, y))
  // Busto: acréscimo suave na frente do tórax
  if (p.z > 0.02 && y > 1.14 && y < 1.4) {
    p.z += 0.03 * bump(ax, 0.085, 0.042) * bump(y, 1.27, 0.052) * smooth(0.02, 0.07, p.z)
  }
  // Glúteos: um pouco mais para trás
  if (p.z < -0.02 && y > 0.78 && y < 1.06) {
    p.z -= 0.024 * bump(y, 0.92, 0.07) * (1 - smooth(0.1, 0.17, ax))
  }
  return p
}

// ---------- Soldagem e normais soldadas ----------

/** Agrupa vértices coincidentes (precisão de 0,1 mm) e liga cada grupo aos vizinhos de malha. */
export function buildWelds(pos: Float32Array, idx: Uint32Array): Welds {
  const n = pos.length / 3
  const map = new Map<number, number>()
  const gid = new Int32Array(n)
  let g = 0
  for (let i = 0; i < n; i++) {
    const k =
      ((Math.round(pos[3 * i] * 1e4) + 32768) * 65536 + (Math.round(pos[3 * i + 1] * 1e4) + 32768)) * 65536 +
      (Math.round(pos[3 * i + 2] * 1e4) + 32768)
    let id = map.get(k)
    if (id === undefined) {
      id = g++
      map.set(k, id)
    }
    gid[i] = id
  }
  const keys = new Float64Array((idx.length / 3) * 6)
  let m = 0
  for (let t = 0; t < idx.length; t += 3) {
    const a = gid[idx[t]], b = gid[idx[t + 1]], c = gid[idx[t + 2]]
    if (a !== b) { keys[m++] = a * g + b; keys[m++] = b * g + a }
    if (b !== c) { keys[m++] = b * g + c; keys[m++] = c * g + b }
    if (c !== a) { keys[m++] = c * g + a; keys[m++] = a * g + c }
  }
  const sorted = keys.subarray(0, m).sort()
  const start = new Int32Array(g + 1)
  const adj = new Int32Array(m)
  let e = 0
  let prev = -1
  for (let i = 0; i < m; i++) {
    const k = sorted[i]
    if (k === prev) continue
    prev = k
    const a = Math.floor(k / g)
    adj[e++] = k - a * g
    start[a + 1]++
  }
  for (let k = 0; k < g; k++) start[k + 1] += start[k]
  return { gid, count: g, start, adj: adj.slice(0, e) }
}

/**
 * Cada região do atlas tem um tom fixo (lábios, pálpebras, nariz). Misturar o tom com o dos vizinhos tira a
 * borda dura entre regiões, que na pele escura parecia maquiagem em blocos.
 */
function smoothTint(t: Float32Array, welds: Welds, iterations: number) {
  const { gid, count: G, start, adj } = welds
  const n = gid.length
  const g = new Float32Array(G * 3)
  const cnt = new Float32Array(G)
  for (let i = 0; i < n; i++) {
    const k = gid[i]
    g[3 * k] += t[3 * i]
    g[3 * k + 1] += t[3 * i + 1]
    g[3 * k + 2] += t[3 * i + 2]
    cnt[k]++
  }
  for (let k = 0; k < G; k++) {
    const c = cnt[k] || 1
    g[3 * k] /= c
    g[3 * k + 1] /= c
    g[3 * k + 2] /= c
  }
  const tmp = new Float32Array(g.length)
  for (let it = 0; it < iterations; it++) {
    for (let k = 0; k < G; k++) {
      const s0 = start[k], e0 = start[k + 1]
      if (e0 === s0) {
        tmp[3 * k] = g[3 * k]; tmp[3 * k + 1] = g[3 * k + 1]; tmp[3 * k + 2] = g[3 * k + 2]
        continue
      }
      let r = 0, gg = 0, b = 0
      for (let j = s0; j < e0; j++) {
        const q = adj[j] * 3
        r += g[q]; gg += g[q + 1]; b += g[q + 2]
      }
      const m = e0 - s0
      tmp[3 * k] = 0.4 * g[3 * k] + 0.6 * (r / m)
      tmp[3 * k + 1] = 0.4 * g[3 * k + 1] + 0.6 * (gg / m)
      tmp[3 * k + 2] = 0.4 * g[3 * k + 2] + 0.6 * (b / m)
    }
    g.set(tmp)
  }
  for (let i = 0; i < n; i++) {
    const k = gid[i]
    t[3 * i] = g[3 * k]
    t[3 * i + 1] = g[3 * k + 1]
    t[3 * i + 2] = g[3 * k + 2]
  }
}

/** Centro da cabeça no atlas (m), para separar a superfície de fora das paredes de dentro (boca, narinas, pálpebras). */
const HEAD_CENTER = new THREE.Vector3(0, 1.585, -0.005)
const HEAD_MIN_Y = 1.49

/**
 * Normais por grupo de vértices soldados. Na cabeça o atlas traz lábios, narinas e pálpebras como folhas fechadas: as faces de
 * dentro dividem os vértices com as de fora, e a média das duas dá uma normal torta (pontinhos claros nos lábios e no queixo).
 * Por isso, acima de `HEAD_MIN_Y`, só contam as faces que olham para fora da cabeça; as de dentro entram só se o vértice não
 * tem nenhuma de fora.
 */
export function weldedNormals(pos: Float32Array, idx: Uint32Array, welds: Welds, outward = false): Float32Array {
  const n = pos.length / 3
  const { gid, count: g } = welds
  const acc = new Float32Array(g * 3)
  const inner = outward ? new Float32Array(g * 3) : null
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2]
    const ax = pos[3 * a], ay = pos[3 * a + 1], az = pos[3 * a + 2]
    const ux = pos[3 * b] - ax, uy = pos[3 * b + 1] - ay, uz = pos[3 * b + 2] - az
    const vx = pos[3 * c] - ax, vy = pos[3 * c + 1] - ay, vz = pos[3 * c + 2] - az
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    let target = acc
    if (inner) {
      const cy = (ay + pos[3 * b + 1] + pos[3 * c + 1]) / 3
      if (cy > HEAD_MIN_Y) {
        const cx = (ax + pos[3 * b] + pos[3 * c]) / 3, cz = (az + pos[3 * b + 2] + pos[3 * c + 2]) / 3
        // raio a partir do centro da cabeça, com a parte vertical limitada: no pescoço e no alto do crânio a normal fica lateral
        const rx = cx - HEAD_CENTER.x, ry = Math.max(-0.04, Math.min(0.04, cy - HEAD_CENTER.y)), rz = cz - HEAD_CENTER.z
        if (nx * rx + ny * ry + nz * rz < 0) target = inner
      }
    }
    for (const k of [a, b, c]) {
      target[3 * gid[k]] += nx
      target[3 * gid[k] + 1] += ny
      target[3 * gid[k] + 2] += nz
    }
  }
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const k = gid[i]
    let x = acc[3 * k], y = acc[3 * k + 1], z = acc[3 * k + 2]
    if (inner && x * x + y * y + z * z < 1e-20) {
      x = inner[3 * k]; y = inner[3 * k + 1]; z = inner[3 * k + 2]
    }
    const l = Math.hypot(x, y, z) || 1
    out[3 * i] = x / l
    out[3 * i + 1] = y / l
    out[3 * i + 2] = z / l
  }
  return out
}

// ---------- Cascas ----------

// O pescoço e o punho entram no macacão para a gola e os punhos terem um corte limpo (ver `coverCut`)
const COVER_OFFSET: Partial<Record<Cloth, number>> = { torso: 0.016, arm: 0.016, leg: 0.016, foot: 0.018, neck: 0.016, wrist: 0.014 }
const SUIT_OFFSET: Partial<Record<Cloth, number>> = { torso: 0.034, arm: 0.034, leg: 0.034, foot: 0.038, neck: 0.026, wrist: 0.02, hand: 0.016 }

const hex = (h: string) => new THREE.Color(h)
const COVER_COLOR: Partial<Record<Cloth, THREE.Color>> = {
  torso: hex('#223452'), arm: hex('#223452'), leg: hex('#223452'), foot: hex('#161a24'), neck: hex('#223452'), wrist: hex('#223452'),
}

/** Onde a gola termina: um plano um pouco inclinado (mais baixo na frente), a ~5 cm da base do pescoço. */
export const COLLAR_Y = 1.452
export const COLLAR_SLOPE = 0.12
/** O punho termina a 1,2 cm depois do pulso, no eixo do antebraço. */
const CUFF_T = 0.012

/**
 * Distância com sinal (m) até o plano de corte da gola e dos punhos; positiva = removido.
 * Nulo onde o macacão não é cortado. A mesma conta vira o atributo `aCut`, e o shader descarta o que passa de zero.
 */
export function coverCut(build: Build) {
  const P = BODY_POINTS
  const pose = makeArmPose(warp(P.shoulderL.clone(), build), warp(P.elbowL.clone(), build), warp(P.wristL.clone(), build))
  const wrist = pose.wrist // o punho segue o antebraço na postura de repouso
  const dir = pose.foreAxis
  return (cloth: Cloth, x: number, y: number, z: number): number | null => {
    // O macacão é cortado num plano limpo acima do ombro; dali sobe a gola, feita à parte (collar.ts)
    // (o topo do ombro também é "arm" no atlas: sem cortá-lo ficavam dentes em volta da gola)
    if (cloth === 'neck' || cloth === 'torso' || cloth === 'arm') return Math.abs(x) < 0.3 ? y - collarPlane(x) : null
    if (cloth === 'wrist') return (Math.abs(x) - wrist.x) * dir.x + (y - wrist.y) * dir.y + (z - wrist.z) * dir.z - CUFF_T
    return null
  }
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
  morph: Morph
  /** Oclusão ambiente por vértice (0 a 1), das concavidades do corpo */
  ao: Float32Array
}

/**
 * Geometria só com os vértices das regiões escolhidas. `offset` infla ao longo da normal soldada.
 * `cut` (opcional) dá a distância (m) de cada ponto ao plano de corte, positiva do lado que sai: os triângulos que cruzam o
 * plano são recortados nele (os vértices novos nascem exatamente no plano) e o que passa dele é descartado. A borda fica
 * reta, sem descarte por pixel. `aCut` guarda a distância à borda (0 na borda), para o shader desenhar a costura.
 */
function extract(
  src: Source,
  pick: (cloth: Cloth) => boolean,
  offset: Partial<Record<Cloth, number>> | null,
  color: ((cloth: Cloth, tint: [number, number, number]) => THREE.Color) | null,
  cut: ((cloth: Cloth, x: number, y: number, z: number) => number | null) | null = null,
): THREE.BufferGeometry {
  const { pos, nor, idx, base, morph } = src
  const n = pos.length / 3
  const map = new Int32Array(n).fill(-1)
  // Atributos por vértice, em listas que crescem: o recorte cria vértices novos
  const P: number[] = [], B: number[] = [], N: number[] = [], S: number[] = [], C: number[] = []
  const D: number[] = [], W: number[] = [], K: number[] = [], O: number[] = []
  // Distância ao plano de corte de cada vértice (medida na posição inflada, a desenhada); -1 onde não há corte
  const dist = new Float32Array(n).fill(-1)
  const picked = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const cloth = CLOTH_BY_ID[base.vCloth[i]]
    if (!pick(cloth)) continue
    picked[i] = 1
    if (!cut) continue
    const o = offset ? offset[cloth] ?? 0 : 0
    const d = cut(cloth, pos[3 * i] + nor[3 * i] * o, pos[3 * i + 1] + nor[3 * i + 1] * o, pos[3 * i + 2] + nor[3 * i + 2] * o)
    if (d !== null) dist[i] = d
  }
  const addVertex = (i: number): number => {
    if (map[i] >= 0) return map[i]
    const cloth = CLOTH_BY_ID[base.vCloth[i]]
    const o = offset ? offset[cloth] ?? 0 : 0
    const j = P.length / 3
    for (let k = 0; k < 3; k++) {
      B.push(pos[3 * i + k])
      P.push(pos[3 * i + k] + nor[3 * i + k] * o)
      N.push(nor[3 * i + k])
      D.push(morph.dir[3 * i + k])
    }
    W.push(morph.w[2 * i], morph.w[2 * i + 1])
    S.push(base.vSys[i])
    const tint: [number, number, number] = [base.vTint[3 * i], base.vTint[3 * i + 1], base.vTint[3 * i + 2]]
    const col = color ? color(cloth, tint) : new THREE.Color(tint[0], tint[1], tint[2])
    C.push(col.r, col.g, col.b)
    K.push(dist[i])
    O.push(src.ao[i])
    map[i] = j
    return j
  }
  /** Vértice novo no ponto `t` (0 a 1) da aresta i→j: todos os atributos interpolados, e a distância ao corte é 0 */
  const lerpVertex = (i: number, j: number, t: number): number => {
    const a = addVertex(i)
    const b = addVertex(j)
    const v = P.length / 3
    const mix = (list: number[], stride: number) => {
      for (let k = 0; k < stride; k++) list.push(list[a * stride + k] + (list[b * stride + k] - list[a * stride + k]) * t)
    }
    mix(P, 3); mix(B, 3); mix(D, 3); mix(W, 2); mix(C, 3)
    const nx = N[3 * a] + (N[3 * b] - N[3 * a]) * t, ny = N[3 * a + 1] + (N[3 * b + 1] - N[3 * a + 1]) * t, nz = N[3 * a + 2] + (N[3 * b + 2] - N[3 * a + 2]) * t
    const l = Math.hypot(nx, ny, nz) || 1
    N.push(nx / l, ny / l, nz / l)
    S.push(S[a])
    K.push(0)
    O.push(O[a] + (O[b] - O[a]) * t)
    return v
  }
  const I: number[] = []
  for (let t = 0; t < idx.length; t += 3) {
    const ia = idx[t], ib = idx[t + 1], ic = idx[t + 2]
    if (!picked[ia] || !picked[ib] || !picked[ic]) continue
    const d0 = dist[ia], d1 = dist[ib], d2 = dist[ic]
    if (d0 <= 0 && d1 <= 0 && d2 <= 0) {
      I.push(addVertex(ia), addVertex(ib), addVertex(ic))
      continue
    }
    if (d0 > 0 && d1 > 0 && d2 > 0) continue
    // Cruza o plano: recorta o triângulo (Sutherland–Hodgman contra um semiespaço), o que dá um triângulo ou um quadrilátero
    const vs = [ia, ib, ic]
    const poly: number[] = []
    for (let e = 0; e < 3; e++) {
      const i = vs[e], j = vs[(e + 1) % 3]
      const di = dist[i], dj = dist[j]
      if (di <= 0) poly.push(addVertex(i))
      if (di <= 0 !== dj <= 0) poly.push(lerpVertex(i, j, di / (di - dj)))
    }
    for (let k = 1; k + 1 < poly.length; k++) I.push(poly[0], poly[k], poly[k + 1])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  g.setAttribute('aBase', new THREE.Float32BufferAttribute(B, 3))
  g.setAttribute('aSys', new THREE.Float32BufferAttribute(S, 1))
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(D, 3))
  g.setAttribute('aW', new THREE.Float32BufferAttribute(W, 2))
  g.setAttribute('aCut', new THREE.Float32BufferAttribute(K, 1))
  g.setAttribute('aAO', new THREE.Float32BufferAttribute(O, 1))
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(I), 1))
  g.computeBoundingSphere()
  return g
}

/** Suaviza uma malha por Taubin (λ|μ); `welds` liga os vértices coincidentes. */
function taubinPart(P: Float32Array, welds: Welds, iterations: number) {
  const { gid, count: G, start, adj } = welds
  const n = P.length / 3
  const gp = new Float32Array(G * 3)
  for (let i = 0; i < n; i++) {
    gp[3 * gid[i]] = P[3 * i]
    gp[3 * gid[i] + 1] = P[3 * i + 1]
    gp[3 * gid[i] + 2] = P[3 * i + 2]
  }
  const tmp = new Float32Array(G * 3)
  for (let it = 0; it < iterations; it++) {
    for (const f of [0.5, -0.53]) {
      for (let g = 0; g < G; g++) {
        const s = start[g], e = start[g + 1]
        if (e === s) {
          tmp[3 * g] = gp[3 * g]; tmp[3 * g + 1] = gp[3 * g + 1]; tmp[3 * g + 2] = gp[3 * g + 2]
          continue
        }
        let x = 0, y = 0, z = 0
        for (let j = s; j < e; j++) {
          const q = adj[j] * 3
          x += gp[q]; y += gp[q + 1]; z += gp[q + 2]
        }
        const m = e - s
        tmp[3 * g] = gp[3 * g] + f * (x / m - gp[3 * g])
        tmp[3 * g + 1] = gp[3 * g + 1] + f * (y / m - gp[3 * g + 1])
        tmp[3 * g + 2] = gp[3 * g + 2] + f * (z / m - gp[3 * g + 2])
      }
      gp.set(tmp)
    }
  }
  for (let i = 0; i < n; i++) {
    P[3 * i] = gp[3 * gid[i]]
    P[3 * i + 1] = gp[3 * gid[i] + 1]
    P[3 * i + 2] = gp[3 * gid[i] + 2]
  }
}

/** Suaviza um valor por vértice pela média dos vizinhos soldados; `only` (por vértice) limita onde mexe. Tira picos de um vértice só. */
function smoothScalar(V: Float32Array, welds: Welds, iterations: number, only: Uint8Array) {
  const { gid, count: G, start, adj } = welds
  const n = gid.length
  const g = new Float32Array(G)
  const on = new Uint8Array(G)
  for (let i = 0; i < n; i++) {
    g[gid[i]] = V[i]
    if (only[i]) on[gid[i]] = 1
  }
  const tmp = new Float32Array(G)
  for (let it = 0; it < iterations; it++) {
    for (let k = 0; k < G; k++) {
      if (!on[k]) {
        tmp[k] = g[k]
        continue
      }
      let sum = g[k]
      for (let j = start[k]; j < start[k + 1]; j++) sum += g[adj[j]]
      tmp[k] = sum / (1 + start[k + 1] - start[k])
    }
    g.set(tmp)
  }
  for (let i = 0; i < n; i++) if (on[gid[i]]) V[i] = g[gid[i]]
}

/** Suaviza vetores por vértice (normais) pela média dos vizinhos soldados e renormaliza. `mask` (por grupo soldado) limita onde mexe. */
function smoothVectors(V: Float32Array, welds: Welds, iterations: number, mask?: Uint8Array) {
  const { gid, count: G, start, adj } = welds
  const n = gid.length
  const g = new Float32Array(G * 3)
  for (let i = 0; i < n; i++) {
    const k = gid[i]
    g[3 * k] = V[3 * i]
    g[3 * k + 1] = V[3 * i + 1]
    g[3 * k + 2] = V[3 * i + 2]
  }
  const tmp = new Float32Array(G * 3)
  for (let it = 0; it < iterations; it++) {
    for (let k = 0; k < G; k++) {
      if (mask && !mask[k]) {
        tmp[3 * k] = g[3 * k]; tmp[3 * k + 1] = g[3 * k + 1]; tmp[3 * k + 2] = g[3 * k + 2]
        continue
      }
      const s0 = start[k], e0 = start[k + 1]
      let x = g[3 * k], y = g[3 * k + 1], z = g[3 * k + 2]
      for (let j = s0; j < e0; j++) {
        const q = adj[j] * 3
        x += g[q]; y += g[q + 1]; z += g[q + 2]
      }
      const l = Math.hypot(x, y, z) || 1
      tmp[3 * k] = x / l; tmp[3 * k + 1] = y / l; tmp[3 * k + 2] = z / l
    }
    g.set(tmp)
  }
  for (let i = 0; i < n; i++) {
    const k = gid[i]
    V[3 * i] = g[3 * k]; V[3 * i + 1] = g[3 * k + 1]; V[3 * i + 2] = g[3 * k + 2]
  }
}

/** `sleek` alisa o corte do atlas (cabelo curto e bagunçado) para um cabelo preso. */
function partGeometry(part: Part, build: Build, sys: number, sleek = false, thinY = 1, smoothNormals = 0): THREE.BufferGeometry {
  const n = part.pos.length / 3
  const P = new Float32Array(part.pos)
  const v = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    v.set(P[3 * i], P[3 * i + 1], P[3 * i + 2])
    if (thinY !== 1) v.y = 1.622 + (v.y - 1.622) * thinY // sobrancelha mais fina
    warp(v, build)
    P[3 * i] = v.x
    P[3 * i + 1] = v.y
    P[3 * i + 2] = v.z
  }
  let N: Float32Array<ArrayBufferLike> = new Float32Array(part.nor)
  if (sleek) {
    const welds = buildWelds(P, part.idx)
    taubinPart(P, welds, 14)
    N = weldedNormals(P, part.idx, welds)
  } else if (smoothNormals > 0) {
    // As mechas do atlas têm normais por faceta; normais soldadas e suavizadas dão brilho contínuo em vez de manchas
    const welds = buildWelds(P, part.idx)
    N = weldedNormals(P, part.idx, welds)
    smoothVectors(N, welds, smoothNormals)
  }
  const S = new Float32Array(n).fill(sys)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3))
  g.setAttribute('aBase', new THREE.BufferAttribute(new Float32Array(P), 3))
  g.setAttribute('aSys', new THREE.BufferAttribute(S, 1))
  g.setIndex(new THREE.BufferAttribute(part.idx, 1))
  g.computeBoundingSphere()
  return g
}

const prng = (seed: number) => {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Raiz do rabo de cavalo, atrás da cabeça (espaço do modelo, antes da deformação). */
export const PONYTAIL_ROOT = new THREE.Vector3(0, 1.646, -0.113)

/**
 * Rabo de cavalo: um feixe de fios afunilados que, sem gravidade, flutua para trás e um pouco para cima.
 * `aT` (0 na raiz, 1 na ponta) e `aPh` (fase) alimentam a oscilação no shader; a cor varia por fio.
 */
function ponytailGeometry(build: Build): THREE.BufferGeometry {
  const rnd = prng(41)
  const root = warp(PONYTAIL_ROOT.clone(), build)
  const STRANDS = 70
  const SEG = 28
  const SIDES = 5
  const pos: number[] = []
  const nor: number[] = []
  const aT: number[] = []
  const aPh: number[] = []
  const col: number[] = []
  const idx: number[] = []
  // Eixo comum do feixe: sai da cabeça para trás e cai pelas costas, com uma ondulação suave. O cabelo pende (há gravidade na baia).
  const spine = (t: number) => new THREE.Vector3(0, -0.245 * t + 0.01 * Math.sin(t * 4.4 + 0.6), -0.016 - 0.045 * t - 0.03 * Math.sin(Math.min(t, 0.5) * Math.PI))
  // Mechas: os fios se agrupam em poucas mechas que flutuam cada uma para um lado, em vez de um leque rígido
  const LOCKS = 6
  const locks = Array.from({ length: LOCKS }, (_, i) => ({
    a: (i / LOCKS) * Math.PI * 2 + rnd() * 0.8,
    r: 0.016 + rnd() * 0.018,
    ph: rnd() * Math.PI * 2,
    wob: 0.014 + rnd() * 0.02,
  }))
  for (let s = 0; s < STRANDS; s++) {
    const lock = locks[s % LOCKS]
    const a = rnd() * Math.PI * 2
    const rho = 0.016 * Math.sqrt(rnd())
    const len = 1.06 + rnd() * 0.3
    const wob = 0.006 + rnd() * 0.01
    const ph = rnd() * Math.PI * 2
    const ctrl = [0, 0.12, 0.3, 0.55, 0.8, 1].map((t) => {
      const c = spine(t * len)
      // preso no elástico (t = 0) e aberto até a ponta; a mecha desloca o fio como um todo
      const spread = 0.34 + 0.9 * t
      const lx = Math.cos(lock.a) * lock.r * t * 1.5 + Math.sin(t * 3.1 + lock.ph) * lock.wob * t
      const ly = Math.sin(lock.a) * lock.r * t * 1.3 + Math.cos(t * 2.5 + lock.ph) * lock.wob * 0.8 * t
      return new THREE.Vector3(
        root.x + c.x + lx + Math.cos(a) * rho * spread + Math.sin(t * 3.4 + ph) * wob * t,
        root.y + c.y + ly + Math.sin(a) * rho * spread * 0.9 + Math.cos(t * 2.7 + ph * 1.3) * wob * 0.8 * t,
        root.z + c.z,
      )
    })
    const curve = new THREE.CatmullRomCurve3(ctrl)
    const frames = curve.computeFrenetFrames(SEG, false)
    const shade = 0.9 + rnd() * 0.3
    const base = pos.length / 3
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG
      const c = curve.getPoint(t)
      const r = 0.0135 * Math.pow(1 - t, 0.7) + 0.0035
      for (let j = 0; j < SIDES; j++) {
        const th = (j / SIDES) * Math.PI * 2
        const nx = Math.cos(th) * frames.normals[k].x + Math.sin(th) * frames.binormals[k].x
        const ny = Math.cos(th) * frames.normals[k].y + Math.sin(th) * frames.binormals[k].y
        const nz = Math.cos(th) * frames.normals[k].z + Math.sin(th) * frames.binormals[k].z
        pos.push(c.x + nx * r, c.y + ny * r, c.z + nz * r)
        nor.push(nx, ny, nz)
        aT.push(t)
        aPh.push(ph)
        const sh = shade * (0.9 + 0.14 * t)
        col.push(sh, sh, sh)
      }
    }
    for (let k = 0; k < SEG; k++) {
      for (let j = 0; j < SIDES; j++) {
        const a0 = base + k * SIDES + j
        const a1 = base + k * SIDES + ((j + 1) % SIDES)
        const b0 = a0 + SIDES
        const b1 = a1 + SIDES
        idx.push(a0, b0, a1, a1, b0, b1)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1))
  g.setAttribute('aPh', new THREE.Float32BufferAttribute(aPh, 1))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

export interface BodyVariant {
  /** Pele exposta do corpo: pulsos e mãos (a cabeça e o pescoço vêm de headModel.ts) */
  skin: THREE.BufferGeometry
  /**
   * Cabeça e pescoço do atlas, com o cabelo, as sobrancelhas, os cílios e (no corpo feminino) o rabo de cavalo logo abaixo.
   * Só aparecem enquanto o GLB da cabeça fotográfica carrega, ou se ele falhar.
   */
  head: THREE.BufferGeometry
  cover: THREE.BufferGeometry
  /** Laço do corte do macacão em volta do pescoço: de onde sai a gola de cada astronauta (collar.ts) */
  collarLoop: CollarLoop | null
  suit: THREE.BufferGeometry
  /** Corpo inteiro, invisível, só para o clique */
  pick: THREE.BufferGeometry
  hair: THREE.BufferGeometry
  /** Rabo de cavalo (só no corpo feminino); flutua sem gravidade */
  tail: THREE.BufferGeometry | null
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
      const { pos, morph } = shapeBody(base, build)
      const nor = weldedNormals(pos, base.idx, base.welds, true)
      const ao = cavityAO(pos, nor, base.welds)
      // Na pele do rosto a oclusão por cavidade lia os caroços de voxel do atlas como covinhas e manchava tudo (pedra de calçada):
      // ali ela vale só um quarto; as órbitas, as orelhas, o pescoço e o corpo mantêm a oclusão inteira
      for (let i = 0; i < ao.length; i++) if (base.vFace[i]) ao[i] = 1 - 0.25 * (1 - ao[i])
      smoothScalar(ao, base.welds, 4, base.vFace)
      const src: Source = { pos, nor, idx: base.idx, base, morph, ao }
      // Lábios e pálpebras um pouco mais coloridos no corpo feminino
      const skinTint = build === 'female'
        ? (_c: Cloth, t: [number, number, number]) => (t[1] < 0.86 ? new THREE.Color(t[0], t[1] * 0.9, t[2] * 0.92) : new THREE.Color(t[0], t[1], t[2]))
        : null
      const skin = extract(src, (c) => c === 'wrist' || c === 'hand', null, skinTint)
      const head = extract(src, (c) => c === 'none' || c === 'neck', null, skinTint)
      // Normais da cabeça tiradas de uma versão bem suavizada da malha: a luz deixa de revelar os caroços de voxel do atlas
      // (a geometria da pele fica a mesma, só o sombreamento é calmo; sobra um pouco do detalhe original)
      {
        const sp = head.getAttribute('position') as THREE.BufferAttribute
        const sn = head.getAttribute('normal') as THREE.BufferAttribute
        const ss = head.getAttribute('aSys') as THREE.BufferAttribute
        const ix = head.index!.array as Uint32Array
        const P2 = new Float32Array(sp.array as Float32Array)
        const w2 = buildWelds(P2, ix)
        taubinPart(P2, w2, 40)
        const N2 = weldedNormals(P2, ix, w2, true)
        const N = sn.array as Float32Array
        const B = SYS_INDEX.behavior
        for (let i = 0; i < sn.count; i++) {
          const s = ss.getX(i)
          if (!(s === B || s === B + 0.25 || s === SYS_INDEX.neuro_ocular)) continue
          const x = N[3 * i] * 0.04 + N2[3 * i] * 0.96, y = N[3 * i + 1] * 0.04 + N2[3 * i + 1] * 0.96, z = N[3 * i + 2] * 0.04 + N2[3 * i + 2] * 0.96
          const l = Math.hypot(x, y, z) || 1
          N[3 * i] = x / l; N[3 * i + 1] = y / l; N[3 * i + 2] = z / l
        }
        sn.needsUpdate = true
      }

      const cover = extract(src, (c) => c in COVER_OFFSET, COVER_OFFSET, (c) => COVER_COLOR[c] ?? new THREE.Color(1, 1, 1), coverCut(build))
      const collarLoop = extractCollarLoop(cover)
      {
        // O corte do pescoço não é mais uma borda de tecido (a gola é outra peça): sem costura nem borda enrolada ali
        const cp = cover.getAttribute('position') as THREE.BufferAttribute
        const ck = cover.getAttribute('aCut') as THREE.BufferAttribute
        for (let i = 0; i < ck.count; i++) if (cp.getY(i) > 1.35 && Math.abs(cp.getX(i)) < 0.3) ck.setX(i, -1)
        ck.needsUpdate = true
      }
      const suit = extract(src, (c) => c in SUIT_OFFSET, SUIT_OFFSET, (c) => SUIT_COLOR[c] ?? new THREE.Color(1, 1, 1))
      const pick = extract(src, () => true, null, null)
      const out: BodyVariant = {
        skin, head, cover, collarLoop, suit, pick, build,
        hair: partGeometry(base.hair, build, SYS_INDEX.behavior, build === 'female', 1, 5),
        tail: build === 'female' ? ponytailGeometry(build) : null,
        brows: partGeometry(base.brows, build, SYS_INDEX.neuro_ocular, false, build === 'female' ? 0.7 : 1),
        lashes: partGeometry(base.lashes, build, SYS_INDEX.neuro_ocular),
      }
      console.info(`[body] ${build} variant built in ${Math.round(performance.now() - t0)} ms (skin ${(skin.index!.count + head.index!.count) / 3000 | 0}k, coverall ${cover.index!.count / 3000 | 0}k, suit ${suit.index!.count / 3000 | 0}k triangles)`)
      return out
    })
    p.catch(() => variants.delete(build))
    variants.set(build, p)
  }
  return p
}

// ---------- Forma do corpo: proporções, magreza, suavização e atributos de variação ----------

/** Por vértice: direção radial e deslocamento por unidade de atrofia (x) e de massa (y), em metros. */
interface Morph {
  dir: Float32Array
  w: Float32Array
}

/** Cabeça do fêmur (o atlas não marca o quadril); eixo da coxa no espaço do modelo. */
const HIP = new THREE.Vector3(0.088, 0.915, 0)

/**
 * O atlas tem o corpo de um halterofilista. Aqui cada membro e o tronco ganham um fator radial
 * (1 = como o atlas) para chegar a um atleta magro. O corpo feminino é um pouco mais fino nos braços.
 */
const LEAN: Record<Build, { upper: number; fore: number; thigh: number; calf: number; chestX: number; chestZ: number; waistZ: number }> = {
  male: { upper: 0.82, fore: 0.88, thigh: 0.86, calf: 0.9, chestX: 0.94, chestZ: 0.9, waistZ: 0.94 },
  female: { upper: 0.8, fore: 0.86, thigh: 0.9, calf: 0.88, chestX: 0.97, chestZ: 0.94, waistZ: 0.96 },
}

/** Quanto o corpo muda no extremo: atrofia total encolhe até 14% do raio; ±8% de massa mexe até 13%. */
const ATROPHY_GAIN = 0.14
const MASS_GAIN = 1.6

type Knots = [number, number][]
const knots = (k: Knots, u: number) => {
  if (u <= k[0][0]) return k[0][1]
  for (let i = 1; i < k.length; i++) {
    if (u <= k[i][0]) return k[i - 1][1] + ((k[i][1] - k[i - 1][1]) * (u - k[i - 1][0])) / (k[i][0] - k[i - 1][0])
  }
  return k[k.length - 1][1]
}

const ARM_MUSCLE: Knots = [[0, 0.2], [0.2, 1], [0.85, 1], [1.1, 0.8], [1.4, 0.8], [1.9, 0.3], [2, 0]]
const ARM_FAT: Knots = [[0, 0.3], [0.2, 0.5], [0.9, 0.5], [1.2, 0.15], [2, 0]]
const LEG_MUSCLE: Knots = [[0, 0.4], [0.2, 1], [0.85, 1], [1.1, 0.7], [1.3, 0.9], [1.75, 0.9], [2, 0.1]]
const LEG_FAT: Knots = [[0, 0.9], [0.3, 0.8], [0.9, 0.5], [1.2, 0.2], [2, 0]]

const tmpAB = new THREE.Vector3()
const tmpAP = new THREE.Vector3()
const tmpCP = new THREE.Vector3()

/** Ponto mais próximo de uma poligonal. `u` = índice do segmento + posição nele (0 a 2 para duas partes). */
function nearestOnPolyline(p: THREE.Vector3, pts: THREE.Vector3[], out: { cp: THREE.Vector3; u: number; r: number }) {
  out.r = Infinity
  for (let s = 0; s < pts.length - 1; s++) {
    tmpAB.subVectors(pts[s + 1], pts[s])
    tmpAP.subVectors(p, pts[s])
    const t = Math.min(1, Math.max(0, tmpAP.dot(tmpAB) / tmpAB.lengthSq()))
    tmpCP.copy(pts[s]).addScaledVector(tmpAB, t)
    const r = p.distanceTo(tmpCP)
    if (r < out.r) {
      out.r = r
      out.u = s + t
      out.cp.copy(tmpCP)
    }
  }
}

const FIXED = new Set<Cloth>(['none', 'neck', 'wrist', 'hand'])
const KIND_RANK: Partial<Record<Cloth, number>> = { arm: 4, leg: 3, torso: 2, foot: 1 }

/**
 * Posições finais do corpo e atributos de variação por vértice. Tudo é calculado por grupo de
 * vértices soldados, para que as bordas entre regiões nunca se separem.
 * 1) proporções ('female'), 2) magreza por membro, 3) suavização de Taubin do que fica sob a roupa,
 * 4) relaxamento da virilha, 5) direção radial e pesos de atrofia e massa.
 */
function shapeBody(base: BaseBody, build: Build): { pos: Float32Array; morph: Morph } {
  const { gid, count: G, start, adj } = base.welds
  const n = base.pos.length / 3
  const cfg = LEAN[build]
  const gp = new Float32Array(G * 3)
  const kind = new Uint8Array(G) // 1 fixo, 2 torso, 3 braço, 4 perna, 5 pé
  const seen = new Uint8Array(G)
  const fixed = new Uint8Array(G)
  const groin = new Uint8Array(G).fill(1)
  const best = new Int8Array(G)
  const handG = new Uint8Array(G) // pulso e mão: fixos, mas seguem o antebraço na postura
  const v = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    const g = gid[i]
    const cloth = CLOTH_BY_ID[base.vCloth[i]]
    if (cloth === 'wrist' || cloth === 'hand') handG[g] = 1
    if (!seen[g]) {
      seen[g] = 1
      v.set(base.pos[3 * i], base.pos[3 * i + 1], base.pos[3 * i + 2])
      warp(v, build)
      gp[3 * g] = v.x
      gp[3 * g + 1] = v.y
      gp[3 * g + 2] = v.z
    }
    if (FIXED.has(cloth)) fixed[g] = 1
    const rank = KIND_RANK[cloth] ?? 0
    if (rank > best[g]) {
      best[g] = rank
      kind[g] = cloth === 'arm' ? 3 : cloth === 'leg' ? 4 : cloth === 'foot' ? 5 : 2
    }
    if (!base.vGroin[i]) groin[g] = 0
  }
  for (let g = 0; g < G; g++) if (fixed[g] || !kind[g]) kind[g] = 1

  // 2) Magreza
  const P = BODY_POINTS
  const w = (q: THREE.Vector3) => warp(q.clone(), build)
  const arm = [w(P.shoulderL), w(P.elbowL), w(P.wristL)]
  const leg = [w(HIP), w(P.kneeL), w(P.ankleL)]
  const armScale: Knots = [
    [0, 1 - 0.5 * (1 - cfg.upper)], [0.22, cfg.upper], [0.85, cfg.upper], [1.05, (cfg.upper + cfg.fore) / 2 + 0.04],
    [1.3, cfg.fore], [1.8, cfg.fore], [2, 1 - 0.6 * (1 - cfg.fore)],
  ]
  const legScale: Knots = [
    [0, 1 - 0.5 * (1 - cfg.thigh)], [0.2, cfg.thigh], [0.85, cfg.thigh], [1.0, (cfg.thigh + cfg.calf) / 2 + 0.03],
    [1.25, cfg.calf], [1.75, cfg.calf], [2, 1 - 0.5 * (1 - cfg.calf)],
  ]
  const near = { cp: new THREE.Vector3(), u: 0, r: 0 }
  const side = new Int8Array(G)
  for (let g = 0; g < G; g++) {
    if (kind[g] === 1) continue
    v.set(gp[3 * g], gp[3 * g + 1], gp[3 * g + 2])
    const sx = v.x < 0 ? -1 : 1
    side[g] = sx
    v.x *= sx
    if (kind[g] === 3 || kind[g] === 4) {
      nearestOnPolyline(v, kind[g] === 3 ? arm : leg, near)
      const s = knots(kind[g] === 3 ? armScale : legScale, near.u)
      v.sub(near.cp).multiplyScalar(s).add(near.cp)
    } else if (kind[g] === 2) {
      v.x *= 1 - (1 - cfg.chestX) * bump(v.y, 1.3, 0.13)
      v.z *= 1 - (1 - cfg.chestZ) * bump(v.y, 1.3, 0.14) - (1 - cfg.waistZ) * bump(v.y, 1.07, 0.1)
    }
    v.x *= sx
    gp[3 * g] = v.x
    gp[3 * g + 1] = v.y
    gp[3 * g + 2] = v.z
  }

  // 3) Taubin (λ|μ): tira o relevo de músculo sem encolher o volume. O que toca pele exposta fica fixo.
  const freeList: number[] = []
  for (let g = 0; g < G; g++) if (kind[g] !== 1 && start[g + 1] > start[g]) freeList.push(g)
  const tmp = new Float32Array(G * 3)
  for (let it = 0; it < 22; it++) {
    for (const f of [0.5, -0.53]) {
      for (const g of freeList) {
        let x = 0, y = 0, z = 0
        for (let j = start[g]; j < start[g + 1]; j++) {
          const q = adj[j] * 3
          x += gp[q]; y += gp[q + 1]; z += gp[q + 2]
        }
        const m = start[g + 1] - start[g]
        tmp[3 * g] = gp[3 * g] + f * (x / m - gp[3 * g])
        tmp[3 * g + 1] = gp[3 * g + 1] + f * (y / m - gp[3 * g + 1])
        tmp[3 * g + 2] = gp[3 * g + 2] + f * (z / m - gp[3 * g + 2])
      }
      for (const g of freeList) {
        gp[3 * g] = tmp[3 * g]; gp[3 * g + 1] = tmp[3 * g + 1]; gp[3 * g + 2] = tmp[3 * g + 2]
      }
    }
  }

  // 3b) Pele do rosto: o atlas vem de voxels e tem relevo de 4 a 6 mm, que a luz revelava como casca de laranja.
  // Poucas iterações de Taubin apagam o que é menor que ~1 cm e mantêm os traços de 2 cm para cima (nariz, lábios).
  const faceMask = new Uint8Array(G)
  for (let i = 0; i < n; i++) if (base.vFace[i]) faceMask[gid[i]] = 1
  const faceList: number[] = []
  for (let g = 0; g < G; g++) if (faceMask[g] && start[g + 1] > start[g]) faceList.push(g)
  for (let it = 0; it < 12; it++) {
    for (const f of [0.5, -0.53]) {
      for (const g of faceList) {
        let x = 0, y = 0, z = 0
        for (let j = start[g]; j < start[g + 1]; j++) {
          const q = adj[j] * 3
          x += gp[q]; y += gp[q + 1]; z += gp[q + 2]
        }
        const m = start[g + 1] - start[g]
        tmp[3 * g] = gp[3 * g] + f * (x / m - gp[3 * g])
        tmp[3 * g + 1] = gp[3 * g + 1] + f * (y / m - gp[3 * g + 1])
        tmp[3 * g + 2] = gp[3 * g + 2] + f * (z / m - gp[3 * g + 2])
      }
      for (const g of faceList) {
        gp[3 * g] = tmp[3 * g]; gp[3 * g + 1] = tmp[3 * g + 1]; gp[3 * g + 2] = tmp[3 * g + 2]
      }
    }
  }

  // 3c) Postura de repouso do braço (pose.ts): antebraço mais perto do corpo, palma voltada para a coxa e dedos soltos.
  // Vem depois da magreza e das suavizações, que trabalham na posição do atlas.
  const pose = makeArmPose(arm[0], arm[1], arm[2])
  const armPosed = [arm[0], pose.elbow, pose.wrist]
  for (let g = 0; g < G; g++) {
    if (!seen[g] || !(kind[g] === 3 || handG[g])) continue
    v.set(gp[3 * g], gp[3 * g + 1], gp[3 * g + 2])
    poseSym(pose, v)
    gp[3 * g] = v.x
    gp[3 * g + 1] = v.y
    gp[3 * g + 2] = v.z
  }

  // 3b2) Boca: os cantos e a linha dos lábios vêm com nódulos do atlas; mais algumas passadas só nesta área
  const mouthList = faceList.filter((g) => Math.abs(gp[3 * g]) < 0.038 && gp[3 * g + 1] > 1.5 && gp[3 * g + 1] < 1.548 && gp[3 * g + 2] > 0.06)
  for (let it = 0; it < 14; it++) {
    for (const f of [0.5, -0.53]) {
      for (const g of mouthList) {
        let x = 0, y = 0, z = 0
        for (let j = start[g]; j < start[g + 1]; j++) {
          const q = adj[j] * 3
          x += gp[q]; y += gp[q + 1]; z += gp[q + 2]
        }
        const m = start[g + 1] - start[g]
        tmp[3 * g] = gp[3 * g] + f * (x / m - gp[3 * g])
        tmp[3 * g + 1] = gp[3 * g + 1] + f * (y / m - gp[3 * g + 1])
        tmp[3 * g + 2] = gp[3 * g + 2] + f * (z / m - gp[3 * g + 2])
      }
      for (const g of mouthList) {
        gp[3 * g] = tmp[3 * g]; gp[3 * g + 1] = tmp[3 * g + 1]; gp[3 * g + 2] = tmp[3 * g + 2]
      }
    }
  }

  // 4) Virilha: membrana lisa entre o abdômen e as coxas (o personagem é sempre vestido)
  const groinList: number[] = []
  for (let g = 0; g < G; g++) if (groin[g] && seen[g] && start[g + 1] > start[g]) groinList.push(g)
  for (let it = 0; it < 700; it++) {
    for (const g of groinList) {
      let x = 0, y = 0, z = 0
      for (let j = start[g]; j < start[g + 1]; j++) {
        const q = adj[j] * 3
        x += gp[q]; y += gp[q + 1]; z += gp[q + 2]
      }
      const m = start[g + 1] - start[g]
      gp[3 * g] = x / m; gp[3 * g + 1] = y / m; gp[3 * g + 2] = z / m
    }
  }

  // 5) Direção radial e pesos de variação
  const gdir = new Float32Array(G * 3)
  const gw = new Float32Array(G * 2)
  for (let g = 0; g < G; g++) {
    if (kind[g] === 1 || kind[g] === 5) continue
    v.set(gp[3 * g], gp[3 * g + 1], gp[3 * g + 2])
    const sx = side[g] || 1
    v.x *= sx
    let muscle = 0
    let fat = 0
    let r = 0
    if (kind[g] === 3 || kind[g] === 4) {
      nearestOnPolyline(v, kind[g] === 3 ? armPosed : leg, near)
      r = near.r
      muscle = knots(kind[g] === 3 ? ARM_MUSCLE : LEG_MUSCLE, near.u)
      fat = knots(kind[g] === 3 ? ARM_FAT : LEG_FAT, near.u)
      v.sub(near.cp)
    } else {
      r = Math.hypot(v.x, v.z)
      muscle = 0.3 * bump(v.y, 1.3, 0.12)
      fat = Math.min(1, bump(v.y, 1.07, 0.17) + 0.9 * bump(v.y, 0.92, 0.1))
      v.set(v.x, 0, v.z)
    }
    const l = v.length() || 1
    gdir[3 * g] = (v.x / l) * sx
    gdir[3 * g + 1] = v.y / l
    gdir[3 * g + 2] = v.z / l
    gw[2 * g] = -ATROPHY_GAIN * r * muscle
    gw[2 * g + 1] = MASS_GAIN * r * fat
  }

  const pos = new Float32Array(n * 3)
  const dir = new Float32Array(n * 3)
  const wt = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const g = gid[i]
    pos[3 * i] = gp[3 * g]; pos[3 * i + 1] = gp[3 * g + 1]; pos[3 * i + 2] = gp[3 * g + 2]
    dir[3 * i] = gdir[3 * g]; dir[3 * i + 1] = gdir[3 * g + 1]; dir[3 * i + 2] = gdir[3 * g + 2]
    wt[2 * i] = gw[2 * g]; wt[2 * i + 1] = gw[2 * g + 1]
  }
  return { pos, morph: { dir, w: wt } }
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
  shoulderL: new THREE.Vector3(...ATLAS_ARM.shoulder),
  shoulderR: new THREE.Vector3(-ATLAS_ARM.shoulder[0], ATLAS_ARM.shoulder[1], ATLAS_ARM.shoulder[2]),
  elbowL: new THREE.Vector3(...ATLAS_ARM.elbow),
  elbowR: new THREE.Vector3(-ATLAS_ARM.elbow[0], ATLAS_ARM.elbow[1], ATLAS_ARM.elbow[2]),
  wristL: new THREE.Vector3(...ATLAS_ARM.wrist),
  wristR: new THREE.Vector3(-ATLAS_ARM.wrist[0], ATLAS_ARM.wrist[1], ATLAS_ARM.wrist[2]),
  kneeL: new THREE.Vector3(0.082, 0.443, 0.006),
  kneeR: new THREE.Vector3(-0.082, 0.443, 0.006),
  ankleL: new THREE.Vector3(0.081, 0.091, -0.039),
  ankleR: new THREE.Vector3(-0.081, 0.091, -0.039),
}
