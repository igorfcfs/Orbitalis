import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { LayerId } from '../state/store'
import type { SystemId } from '../types'
import { ATLAS_ARM, makeArmPose, poseDirSym, poseSym } from './pose'

/**
 * Anatomia interna: Shandon's Body Atlas (Z-Anatomy, CC BY-SA 4.0), GLB com meshopt.
 * Os arquivos ficam em /public/models (cópia local, conforme o plano de risco da spec).
 * A pele vem de bodyBuild.ts; aqui ficam as camadas que aparecem quando o corpo se abre.
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

/**
 * Cinco sistemas do atlas, de fora para dentro. Cada um tem um tom próprio e dessaturado, longe do verde, âmbar
 * e vermelho vivos de status (o músculo é um tijolo apagado, não o vermelho de alerta), para o raio-X com todos juntos continuar legível.
 */
export const LAYERS: LayerInfo[] = [
  { id: 'muscles', label: 'Muscles', file: 'muscles.glb', blurb: 'Skeletal muscles', color: '#b9625b', renderOrder: 5 },
  { id: 'skeleton', label: 'Skeleton', file: 'skeleton.glb', blurb: 'Bones, joints, ligaments', color: '#eceff6', renderOrder: 4 },
  { id: 'organs', label: 'Organs', file: 'organs.glb', blurb: 'Internal organs, including the heart', color: '#e4a3b8', renderOrder: 3 },
  { id: 'vessels', label: 'Circulation', file: 'vessels.glb', blurb: 'Arteries, veins, lymphatics', color: '#79b0ff', renderOrder: 2 },
  { id: 'nerves', label: 'Nerves', file: 'nerves.glb', blurb: 'Brain and nerves', color: '#e6d9a2', renderOrder: 1 },
]

/** Carregam assim que o corpo abre (raio-X imediato). */
export const INITIAL_LAYERS: LayerId[] = ['skeleton', 'organs']

/** Carregam depois, uma a uma, para o raio-X com todos os sistemas não travar a tela. */
export const WARM_LAYERS: { id: LayerId; after: number }[] = [
  { id: 'vessels', after: 2500 },
  { id: 'nerves', after: 5000 },
  { id: 'muscles', after: 7500 },
]

/** Camadas que cada sistema mostra ao abrir a região. */
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

// O corpo é sempre vestido: sem genitais. Os olhos vêm do personagem, não do atlas.
const SKIP = /penis|testis|epididymis|seminal|prostate|ductus deferens|ejaculatory|corpus cavernosum|corpus spongiosum|glans|scrot|eyeball|sclera|\biris\b|cornea|\blens\b|vitreous|choroid|ciliary|^retina/i

const RE = {
  eye: /optic|retinal/i,
  brain: /brain|cerebr|cerebell|midbrain|\bpons\b|medulla|gyrus|thalam|hippocamp|amygdal|callos|caudate|putamen|pallid|nucleus|insula|cortex|lobe|ventricle|aqueduct|colliculus|peduncle|lingula|tonsil of cerebellum|basal ganglia|fornix|septum pellucidum/i,
  heartOrgan: /atrium|ventricle|papillary|leaflet|valve|coronary|chordae|septum/i,
  nodes: /nodes?\b|thymus|splen|tonsil|lymph/i,
  gut: /stomach|colon|duoden|jejun|ileum|caecum|cecum|appendix|oesophagus|esophagus|liver|pancrea|gallbladder|bile|omentum|rectum|anal canal|taenia|mesocolon/i,
}

/** Primeiro casamento vence. 'rest' = camada neutra sem sistema. */
export function classify(layer: LayerId, rawName: string): SysKey | 'rest' {
  const name = rawName.replace(/_/g, ' ')
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
  if (RE.eye.test(name)) return 'neuro_ocular'
  if (RE.nodes.test(name)) return 'immune'
  return 'cardiovascular'
}

export interface Bucket {
  layer: LayerId
  system: SysKey | 'rest'
  geometry: THREE.BufferGeometry
}

export interface LoadedLayer {
  id: LayerId
  buckets: Bucket[]
  matched: Record<string, number>
  triangles: number
}

interface Acc {
  pos: Float32Array[]
  nor: Float32Array[]
  idx: Uint32Array[]
  vcount: number
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

/** A pele e o macacão estão na postura de repouso do braço (pose.ts); a anatomia por dentro segue a mesma deformação. */
const ARM_POSE = makeArmPose(new THREE.Vector3(...ATLAS_ARM.shoulder), new THREE.Vector3(...ATLAS_ARM.elbow), new THREE.Vector3(...ATLAS_ARM.wrist))

const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * Funde as malhas de cada sistema em uma só geometria no espaço do modelo (poucos draw calls).
 * Trabalha em pedaços e devolve o controle à tela entre eles, para a câmera não congelar.
 */
async function bake(root: THREE.Object3D, layer: LayerId): Promise<Omit<LoadedLayer, 'id'>> {
  root.updateMatrixWorld(true)
  const accs = new Map<string, Acc>()
  const matched: Record<string, number> = {}
  const v = new THREE.Vector3()
  const pp = new THREE.Vector3()
  const nn = new THREE.Vector3()
  let triangles = 0

  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh && mesh.geometry.getAttribute('position')) meshes.push(mesh)
  })

  let budget = 0
  for (const mesh of meshes) {
    const g = mesh.geometry
    const posA = g.getAttribute('position')
    const name = `${mesh.name} ${mesh.parent?.name ?? ''}`.replace(/_/g, ' ').trim()
    if (SKIP.test(name)) continue
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
      let px = v.x, py = v.y, pz = v.z
      if (norA) {
        v.fromBufferAttribute(norA, i).applyMatrix3(nm).normalize()
        nor[i * 3] = v.x
        nor[i * 3 + 1] = v.y
        nor[i * 3 + 2] = v.z
      }
      // Braços e mãos: mesma postura do corpo (só vale perto do braço; o resto não sai do lugar)
      if (Math.abs(px) > 0.1 && py < 1.47 && py > 0.66) {
        pp.set(px, py, pz)
        if (norA) {
          nn.set(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2])
          poseDirSym(ARM_POSE, pp, nn, nn, true)
          nor[i * 3] = nn.x
          nor[i * 3 + 1] = nn.y
          nor[i * 3 + 2] = nn.z
        }
        poseSym(ARM_POSE, pp, pp, true)
        px = pp.x
        py = pp.y
        pz = pp.z
      }
      pos[i * 3] = px
      pos[i * 3 + 1] = py
      pos[i * 3 + 2] = pz
    }
    const src = g.index
    const idx = new Uint32Array(src ? src.count : n)
    if (src) for (let i = 0; i < src.count; i++) idx[i] = src.getX(i)
    else for (let i = 0; i < n; i++) idx[i] = i
    // Escala negativa inverte a orientação dos triângulos
    if (m.determinant() < 0) for (let i = 0; i + 2 < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]
    triangles += idx.length / 3

    const acc = accs.get(key) ?? { pos: [], nor: [], idx: [], vcount: 0 }
    const offset = acc.vcount
    if (offset) for (let i = 0; i < idx.length; i++) idx[i] += offset
    acc.pos.push(pos)
    acc.nor.push(nor)
    acc.idx.push(idx)
    acc.vcount += n
    accs.set(key, acc)

    budget += n
    if (budget > 60000) {
      budget = 0
      await yieldToMain()
    }
  }

  const buckets: Bucket[] = []
  for (const [key, acc] of accs) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(concat(acc.pos), 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(concat(acc.nor), 3))
    geometry.setIndex(new THREE.BufferAttribute(concatU32(acc.idx), 1))
    geometry.computeBoundingSphere()
    buckets.push({ layer, system: key as Bucket['system'], geometry })
    await yieldToMain()
  }

  for (const mesh of meshes) mesh.geometry.dispose()
  return { buckets, matched, triangles }
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
    p = loader.loadAsync(ANATOMY_BASE + info.file).then(async (gltf) => ({ id, ...(await bake(gltf.scene, id)) }))
    p.catch(() => promises.delete(id)) // permite nova tentativa
    promises.set(id, p)
  }
  return p
}
