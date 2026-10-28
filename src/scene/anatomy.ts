import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { LayerId } from '../state/store'
import type { SystemId } from '../types'

/**
 * Modelo anatômico: Shandon's Body Atlas (Z-Anatomy, CC BY-SA 4.0), seis GLB com meshopt.
 * Os arquivos ficam em /public/models (cópia local, conforme o plano de risco da spec).
 */
export const ANATOMY_BASE = '/models/'

export const ATTRIBUTION =
  'Model data: Z-Anatomy — the libre 3D atlas of anatomy (CC-BY-SA 4.0), derived from BodyParts3D © The Database Center for Life Science.'

export interface LayerInfo {
  id: LayerId
  label: string
  file: string
  blurb: string
  /** Tom neutro da camada (nunca verde, âmbar ou vermelho saturado) */
  color: string
  renderOrder: number
}

export const LAYERS: LayerInfo[] = [
  { id: 'skin', label: 'Skin', file: 'skin.glb', blurb: 'Body surface', color: '#9fb3d9', renderOrder: 6 },
  { id: 'muscles', label: 'Muscles', file: 'muscles.glb', blurb: 'Skeletal muscles', color: '#6f84ad', renderOrder: 5 },
  { id: 'skeleton', label: 'Skeleton', file: 'skeleton.glb', blurb: 'Bones, joints, ligaments', color: '#b4c2de', renderOrder: 4 },
  { id: 'organs', label: 'Organs', file: 'organs.glb', blurb: 'Internal organs, including the heart', color: '#8ea3c9', renderOrder: 3 },
  { id: 'vessels', label: 'Circulation', file: 'vessels.glb', blurb: 'Arteries, veins, lymphatics', color: '#7f98c6', renderOrder: 2 },
  { id: 'nerves', label: 'Nerves', file: 'nerves.glb', blurb: 'Brain, nerves, eyes', color: '#a9b8d8', renderOrder: 1 },
]

/** Camadas que carregam logo ao abrir o corpo. As demais carregam sob demanda. */
export const INITIAL_LAYERS: LayerId[] = ['skin', 'skeleton', 'organs']

/** Camadas que cada sistema precisa ver para ser explicado. */
export const SYSTEM_LAYERS: Record<SystemId, LayerId[]> = {
  cardiovascular: ['organs', 'vessels'],
  skeletal: ['skeleton'],
  muscular: ['muscles', 'skeleton'],
  neuro_ocular: ['nerves'],
  immune: ['vessels'],
  nutrition: ['organs'],
  behavior: ['nerves'],
  radiation: [],
}

type SysKey = Exclude<SystemId, 'radiation'>

const RE = {
  eye: /eyeball|\biris\b|sclera|retina|optic|lens|cornea|vitreous|choroid|ciliary/i,
  brain: /brain|cerebr|cerebell|midbrain|\bpons\b|medulla|gyrus|thalam|hippocamp|amygdal|callos|caudate|putamen|pallid|nucleus|insula|cortex|lobe|ventricle|aqueduct|colliculus|peduncle|lingula|tonsil of cerebellum|basal ganglia|fornix|septum pellucidum/i,
  heartOrgan: /atrium|ventricle|papillary|leaflet|valve|coronary|chordae|septum/i,
  nodes: /nodes?\b|thymus|splen|tonsil|lymph/i,
  gut: /stomach|colon|duoden|jejun|ileum|caecum|cecum|appendix|oesophagus|esophagus|liver|pancrea|gallbladder|bile|omentum|rectum|anal canal|taenia|mesocolon/i,
}

/** Primeiro casamento vence. 'rest' = camada neutra sem sistema. */
export function classify(layer: LayerId, name: string): SysKey | 'rest' {
  if (layer === 'skin') return 'rest'
  if (layer === 'skeleton') return 'skeletal'
  if (layer === 'muscles') return 'muscular'
  if (layer === 'nerves') {
    if (RE.eye.test(name)) return 'neuro_ocular'
    if (RE.brain.test(name)) return 'behavior'
    return 'rest'
  }
  if (layer === 'organs') {
    if (RE.heartOrgan.test(name) && !/bronch|lung|pleura/i.test(name)) return 'cardiovascular'
    if (RE.gut.test(name)) return 'nutrition'
    return 'rest'
  }
  // vessels
  if (RE.eye.test(name) || /retinal/i.test(name)) return 'neuro_ocular'
  if (RE.nodes.test(name)) return 'immune'
  return 'cardiovascular'
}

const ANCHORS: Record<SysKey, { layer: LayerId; re: RegExp }> = {
  cardiovascular: { layer: 'organs', re: /atrium|ventricle/i },
  skeletal: { layer: 'skeleton', re: /hip bone|sacrum/i },
  muscular: { layer: 'muscles', re: /(vastus lateralis|rectus femoris) muscle R$/i },
  neuro_ocular: { layer: 'nerves', re: /eyeball|\biris\b|sclera/i },
  behavior: { layer: 'nerves', re: /gyrus/i },
  immune: { layer: 'vessels', re: /thymus/i },
  nutrition: { layer: 'organs', re: /stomach|liver/i },
}

export interface Bucket {
  layer: LayerId
  system: SysKey | 'rest'
  geometry: THREE.BufferGeometry
}

export interface LoadedLayer {
  id: LayerId
  buckets: Bucket[]
  /** Contagem de estruturas por sistema, para o log do console */
  matched: Record<string, number>
  triangles: number
  anchors: Partial<Record<SysKey, THREE.Box3>>
  /** Posição média das estruturas de referência para detectar a frente do corpo */
  frontProbe?: { front: THREE.Vector3; back: THREE.Vector3 }
  bounds: THREE.Box3
}

interface Acc {
  pos: Float32Array[]
  nor: Float32Array[]
  idx: Uint32Array[]
  vcount: number
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

/** Funde todas as malhas de um bucket em uma só geometria no espaço do mundo (poucos draw calls). */
function bake(root: THREE.Object3D, layer: LayerId): Omit<LoadedLayer, 'id'> {
  root.updateMatrixWorld(true)
  const accs = new Map<string, Acc>()
  const matched: Record<string, number> = {}
  const anchors: LoadedLayer['anchors'] = {}
  const bounds = new THREE.Box3()
  const sternum = new THREE.Box3()
  const spine = new THREE.Box3()
  const v = new THREE.Vector3()
  const box = new THREE.Box3()
  let triangles = 0

  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const g = mesh.geometry
    const posA = g.getAttribute('position')
    if (!posA) return
    const name = `${mesh.name} ${mesh.parent?.name ?? ''}`.trim()
    const key = classify(layer, name)
    matched[key] = (matched[key] ?? 0) + 1

    const m = mesh.matrixWorld
    const n = posA.count
    const pos = new Float32Array(n * 3)
    const nor = new Float32Array(n * 3)
    const norA = g.getAttribute('normal')
    const nm = new THREE.Matrix3().getNormalMatrix(m)
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(posA, i).applyMatrix4(m)
      pos[i * 3] = v.x
      pos[i * 3 + 1] = v.y
      pos[i * 3 + 2] = v.z
      if (norA) {
        v.fromBufferAttribute(norA, i).applyMatrix3(nm).normalize()
        nor[i * 3] = v.x
        nor[i * 3 + 1] = v.y
        nor[i * 3 + 2] = v.z
      }
    }
    const src = g.index
    const idx = new Uint32Array(src ? src.count : n)
    if (src) for (let i = 0; i < src.count; i++) idx[i] = src.getX(i)
    else for (let i = 0; i < n; i++) idx[i] = i
    // Escala negativa inverte a orientação dos triângulos
    if (m.determinant() < 0) for (let i = 0; i + 2 < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]
    triangles += idx.length / 3

    box.makeEmpty()
    for (let i = 0; i < n; i++) box.expandByPoint(v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]))
    bounds.union(box)

    for (const [sys, a] of Object.entries(ANCHORS) as [SysKey, { layer: LayerId; re: RegExp }][]) {
      if (a.layer === layer && a.re.test(name)) (anchors[sys] ??= new THREE.Box3()).union(box)
    }
    if (layer === 'skeleton') {
      if (/sternum|manubrium/i.test(name)) sternum.union(box)
      if (/thoracic vertebra|vertebra T/i.test(name)) spine.union(box)
    }

    const acc = accs.get(key) ?? { pos: [], nor: [], idx: [], vcount: 0 }
    const offset = acc.vcount
    if (offset) for (let i = 0; i < idx.length; i++) idx[i] += offset
    acc.pos.push(pos)
    acc.nor.push(nor)
    acc.idx.push(idx)
    acc.vcount += n
    accs.set(key, acc)
  })

  const buckets: Bucket[] = []
  for (const [key, acc] of accs) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(concat(acc.pos), 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(concat(acc.nor), 3))
    geometry.setIndex(new THREE.BufferAttribute(concatU32(acc.idx), 1))
    geometry.computeBoundingSphere()
    buckets.push({ layer, system: key as Bucket['system'], geometry })
  }

  // Libera as malhas originais (dispose)
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) mesh.geometry.dispose()
  })

  const frontProbe = !sternum.isEmpty() && !spine.isEmpty()
    ? { front: sternum.getCenter(new THREE.Vector3()), back: spine.getCenter(new THREE.Vector3()) }
    : undefined
  return { buckets, matched, triangles, anchors, frontProbe, bounds }
}

function concat(list: Float32Array[]) {
  const out = new Float32Array(list.reduce((s, a) => s + a.length, 0))
  let o = 0
  for (const a of list) {
    out.set(a, o)
    o += a.length
  }
  return out
}
function concatU32(list: Uint32Array[]) {
  const out = new Uint32Array(list.reduce((s, a) => s + a.length, 0))
  let o = 0
  for (const a of list) {
    out.set(a, o)
    o += a.length
  }
  return out
}

const promises = new Map<LayerId, Promise<LoadedLayer>>()

export function loadLayer(id: LayerId): Promise<LoadedLayer> {
  let p = promises.get(id)
  if (!p) {
    const info = LAYERS.find((l) => l.id === id)!
    p = loader.loadAsync(ANATOMY_BASE + info.file).then((gltf) => ({ id, ...bake(gltf.scene, id) }))
    p.catch(() => promises.delete(id)) // permite nova tentativa
    promises.set(id, p)
  }
  return p
}

export interface Normalization {
  matrix: THREE.Matrix4
  scale: number
  rotationY: number
  height: number
}

/**
 * Mesma transformação para todas as camadas: altura 1.80, pés em y=0, centrado,
 * olhando para +z. A frente vem da posição do esterno em relação às vértebras torácicas.
 */
export function normalize(skin: LoadedLayer, skeleton?: LoadedLayer): Normalization {
  const { min, max } = skin.bounds
  const height = max.y - min.y
  const scale = 1.8 / height
  let rotationY = 0
  const probe = skeleton?.frontProbe
  if (probe && probe.front.z < probe.back.z) rotationY = Math.PI
  const cx = (min.x + max.x) / 2
  const cz = (min.z + max.z) / 2
  const matrix = new THREE.Matrix4()
    .makeRotationY(rotationY)
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    .multiply(new THREE.Matrix4().makeTranslation(-cx, -min.y, -cz))
  return { matrix, scale, rotationY, height }
}

/** Centro anatômico de cada sistema no espaço normalizado, quando a camada de referência existe. */
export function anchorPositions(layers: LoadedLayer[], norm: Normalization): Partial<Record<SystemId, [number, number, number]>> {
  const out: Partial<Record<SystemId, [number, number, number]>> = {}
  for (const l of layers) {
    for (const [sys, box] of Object.entries(l.anchors) as [SysKey, THREE.Box3][]) {
      const c = box.getCenter(new THREE.Vector3()).applyMatrix4(norm.matrix)
      out[sys] = [c.x, c.y, c.z]
    }
  }
  return out
}
