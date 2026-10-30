import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshBVH } from 'three-mesh-bvh'
import type { SystemId } from '../types'
import { SYS_INDEX, buildWelds, type Build } from './bodyBuild'
import { cavityAO } from './meshAO'

/**
 * Traje de EVA: o Z-2, protótipo de traje planetário da NASA (Advanced Concepts Lab), modelo real em domínio público.
 * O arquivo em /models/suit.glb é o original com texturas reduzidas, sem os emblemas da NASA e a bandeira
 * (a tripulação é fictícia) e sem a sujeira "assada" no tecido. Geometria em Draco, decodificador em /draco.
 *
 * O modelo é uma peça única numa pose fixa (braços esticados à frente). `fitSuit` o adapta a cada corpo:
 * refaz os braços (caídos ao lado do corpo, cotovelo um pouco dobrado, com a manga afinada como um antebraço e as proporções de um
 * braço), ajusta o tamanho ao corpo feminino e alinha o tronco.
 */

export interface SuitModel {
  /** Em metros, pés em y = 0, de frente para +z. No traje ajustado, sem os triângulos do visor (veja `visor`). */
  geometry: THREE.BufferGeometry
  /** Vidro dourado do capacete, numa malha à parte (mesmos vértices, outro índice) para ser semitransparente e o rosto aparecer; nulo no modelo cru */
  visor: THREE.BufferGeometry | null
  map: THREE.Texture | null
  /** Mapa de relevo do tecido (cinza) */
  bump: THREE.Texture | null
  /** Mapa de especular do arquivo: branco = metal (anéis), amarelo = viseira dourada, preto = tecido */
  spec: THREE.Texture | null
}

/**
 * Sistema do corpo por baixo de cada ponto do traje (astronauta de 1,80 m, pés em y = 0).
 * Segue as regiões do corpo: cabeça e viseira, pescoço, tórax, abdômen, bacia, braços e pernas.
 * O espelho em GLSL fica em bodyShader (SUIT_SYS); os braços do traje são sempre musculares.
 */
export function suitSystemAt(x: number, y: number, z: number): SystemId {
  const ax = Math.abs(x)
  if (y >= 1.56) return z > 0.12 && y < 1.8 ? 'neuro_ocular' : 'behavior'
  if (y >= 1.46) return 'immune'
  if (y >= 1.2) return ax <= 0.25 ? 'cardiovascular' : 'muscular'
  if (y >= 1.0) return ax <= 0.24 ? 'nutrition' : 'muscular'
  if (y >= 0.82) return ax <= 0.24 ? 'skeletal' : 'muscular'
  return 'muscular'
}

let promise: Promise<SuitModel> | null = null

export function loadSuit(): Promise<SuitModel> {
  promise ??= (async () => {
    const draco = new DRACOLoader().setDecoderPath('/draco/')
    const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync('/models/suit.glb')
    draco.dispose()
    gltf.scene.updateMatrixWorld(true)
    let mesh: THREE.Mesh | null = null
    gltf.scene.traverse((o) => {
      if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh
    })
    if (!mesh) throw new Error('suit mesh not found')
    const src = mesh as THREE.Mesh
    const geometry = src.geometry.clone()
    geometry.applyMatrix4(src.matrixWorld)

    // Pés no chão e o tronco (sem os braços à frente) centrado em x e z
    geometry.computeBoundingBox()
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    const minY = geometry.boundingBox!.min.y
    let sx = 0, sz = 0, n = 0
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) - minY
      if (y > 1.1 && y < 1.4 && Math.abs(pos.getX(i)) < 0.2) {
        sx += pos.getX(i)
        sz += pos.getZ(i)
        n++
      }
    }
    geometry.translate(-(n ? sx / n : 0), -minY, -(n ? sz / n : 0))

    const m = src.material as THREE.MeshStandardMaterial & { specularIntensityMap?: THREE.Texture | null; specularColorMap?: THREE.Texture | null }
    const map = m.map ?? null
    if (map) map.anisotropy = 8
    // O arquivo traz o relevo como "normal" com força zero: é um mapa de altura em cinza
    const bump = m.normalMap ?? null
    const spec = m.specularColorMap ?? m.specularIntensityMap ?? null
    return { geometry, visor: null, map, bump, spec }
  })()
  promise.catch(() => {
    promise = null
  })
  return promise
}

// ---------- Adaptação ao corpo ----------

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Juntas do Z-2 (m), no espaço alinhado de `loadSuit`, lado esquerdo (+x; o direito é o espelho).
 * Medidas nos anéis onde as peças do modelo se tocam: centro e eixo de cada anel.
 */
const Z2 = {
  shoulder: new THREE.Vector3(0.2925, 1.395, 0.2715),
  shoulderAxis: new THREE.Vector3(0.386, -0.678, 0.625).normalize(),
  elbow: new THREE.Vector3(0.309, 1.2885, 0.4035),
  elbowAxis: new THREE.Vector3(-0.152, -0.532, 0.833).normalize(),
  /**
   * Eixos dos tubos, medidos nos centros das seções (fatias por interseção exata com os triângulos): dois pontos de cada
   * peça. A manga do antebraço fica uns 12° para dentro do braço, e a luva cai uns 15° abaixo do eixo da manga. Alinhar pela
   * ponta da luva (como se fez antes) deixava a manga inclinada para a frente e fora de linha com o braço.
   */
  upper: [new THREE.Vector3(0.307, 1.376, 0.284), new THREE.Vector3(0.308, 1.294, 0.4)],
  fore: [new THREE.Vector3(0.305, 1.27, 0.419), new THREE.Vector3(0.285, 1.218, 0.517)],
}

/** O tronco do traje fica atrás do astronauta (a cúpula é a entrada traseira): este deslocamento põe o corpo dentro dele. */
const BODY_Z = -0.135

/**
 * Pose dos braços do traje (esquerdo; o direito é o espelho): direções do tubo do braço e da manga do antebraço. Estes dois
 * vetores foram ajustados À MÃO pelo dono do produto em 30/10/2026 e estão aprovados (braços para a frente e para baixo, uns 45°
 * da vertical, quase retos): NÃO ALTERAR sem ele pedir. O resto da deformação (manga afinada, alongamento, dobra no meio da
 * sanfona) foi feito para esta pose.
 */
const ARM_UP = new THREE.Vector3(0.2, -0.985, 1).normalize()
const ARM_FORE = new THREE.Vector3(0.06, -0.86, 1).normalize()
/**
 * O braço do Z-2 é curto (17 cm do anel do ombro ao do cotovelo) e a manga também (17 cm do anel ao punho): o tubo do braço e a
 * manga, entre a sanfona do cotovelo e o punho, alongam para o braço ter as proporções de um corpo de 1,80 m (cotovelo na
 * cintura, luva no meio da coxa).
 */
const UPPER_STRETCH = 1.3
const FORE_STRETCH = 1.6
/** Trecho da manga que alonga (m a partir do anel do cotovelo, ao longo do eixo): da sanfona até onde a manga começa a fechar no punho */
const FORE_STRETCH_FROM = 0.06
const FORE_STRETCH_TO = 0.165
/** O cotovelo fica no meio da sanfona, a 5 cm do anel; meia largura (m) da zona onde o tubo dobra, e comprimento da mistura no ombro */
const ELBOW_AT = 0.05
const ELBOW_BLEND = 0.08
const SHOULDER_BLEND = 0.12

/**
 * Fator da distância ao eixo da manga a `s` m do anel do cotovelo (tabela, interpolada). A manga do modelo é uma sanfona inteira,
 * com pregas de 9 cm de raio contra os 7,5 cm do braço: um tubo mais grosso que o braço, com a borda saltada no anel, que lia como
 * um gesso. Aqui ela começa por dentro da bainha do braço (7 cm), incha um pouco no cotovelo (7,4 cm) e afina até o punho (6 cm),
 * como um antebraço; as pregas continuam, menores. A luva (depois de 21,5 cm) não muda.
 */
const FORE_TAPER_S = [0, 0.03, 0.06, 0.1, 0.13, 0.16, 0.18, 0.195, 0.205, 0.215]
const FORE_TAPER_F = [0.76, 0.8, 0.82, 0.8, 0.78, 0.78, 0.77, 0.83, 0.9, 1]
export function foreTaper(s: number) {
  const S = FORE_TAPER_S, F = FORE_TAPER_F
  if (s <= S[0]) return F[0]
  for (let k = 1; k < S.length; k++) {
    if (s <= S[k]) return F[k - 1] + ((F[k] - F[k - 1]) * (s - S[k - 1])) / (S[k] - S[k - 1])
  }
  return F[F.length - 1]
}

/** Normal de uma superfície alongada por `k` ao longo de `axis` */
function stretchNormal(n: THREE.Vector3, axis: THREE.Vector3, k: number) {
  n.addScaledVector(axis, (1 / k - 1) * n.dot(axis))
}

/**
 * Normal de uma superfície afinada: a distância ao eixo (`r`, o vetor radial antes) é multiplicada por `f`, que varia ao longo do
 * eixo com derivada `df`. A componente transversal cresce por 1/f e a inclinação nova da parede entra na componente axial.
 */
function taperNormal(n: THREE.Vector3, axis: THREE.Vector3, r: THREE.Vector3, f: number, df: number) {
  const a = n.dot(axis)
  n.addScaledVector(axis, -a) // componente transversal
  const nr = n.dot(r)
  n.multiplyScalar(1 / f).addScaledVector(axis, a - (df / f) * nr)
}

/** Quanto cada corpo ajusta o traje: largura e profundidade do tronco, do capacete e das pernas. */
const FIT: Record<Build, { torsoX: number; torsoZ: number; helmetX: number; helmetZ: number; helmetY: number; legsX: number }> = {
  male: { torsoX: 1, torsoZ: 1, helmetX: 1, helmetZ: 1, helmetY: 1, legsX: 1 },
  female: { torsoX: 0.925, torsoZ: 0.955, helmetX: 0.955, helmetZ: 0.97, helmetY: 0.955, legsX: 0.97 },
}

/** Fator por altura (m): do quadril aos ombros o tronco estreita; acima do pescoço vale o capacete; abaixo do quadril, as pernas. */
function fitScale(build: Build, y: number) {
  const f = FIT[build]
  const upper = smooth(0.95, 1.38, y)
  const helm = smooth(1.46, 1.58, y)
  const legs = 1 - smooth(0.7, 0.95, y)
  const x = 1 + (f.torsoX - 1) * upper + (f.helmetX - f.torsoX) * helm * upper + (f.legsX - 1) * legs
  const z = 1 + (f.torsoZ - 1) * upper + (f.helmetZ - f.torsoZ) * helm * upper
  return { x, z }
}

interface Parts {
  /** 0 = fixo, 1 = braço, 2 = antebraço com a luva */
  limb: Uint8Array
}

/** Peças soldadas do modelo (anéis, mangas, luvas, capacete...): componentes conexos depois de unir os vértices por posição. */
function classify(geometry: THREE.BufferGeometry): Parts {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const idx = geometry.index!.array
  const n = pos.count
  const weld = new Map<string, number>()
  const gid = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`
    let id = weld.get(k)
    if (id === undefined) {
      id = weld.size
      weld.set(k, id)
    }
    gid[i] = id
  }
  const par = new Int32Array(weld.size).map((_, i) => i)
  const find = (a: number) => {
    while (par[a] !== a) {
      par[a] = par[par[a]]
      a = par[a]
    }
    return a
  }
  for (let t = 0; t < idx.length; t += 3) {
    for (const [a, b] of [[0, 1], [1, 2]]) {
      const x = find(gid[idx[t + a]]), y = find(gid[idx[t + b]])
      if (x !== y) par[x] = y
    }
  }
  const root = new Int32Array(n)
  const stat = new Map<number, { n: number; x: number; y: number; z: number }>()
  for (let i = 0; i < n; i++) {
    const r = find(gid[i])
    root[i] = r
    const s = stat.get(r) ?? { n: 0, x: 0, y: 0, z: 0 }
    s.n++
    s.x += Math.abs(pos.getX(i))
    s.y += pos.getY(i)
    s.z += pos.getZ(i)
    stat.set(r, s)
  }
  // Braço: peça grande ao lado do ombro; antebraço: a peça que vem depois, mais à frente e mais baixa
  const kind = new Map<number, number>()
  for (const [r, s] of stat) {
    if (s.n < 500) continue
    const cx = s.x / s.n, cy = s.y / s.n, cz = s.z / s.n
    if (cx > 0.25 && cx < 0.36 && cy > 1.25 && cy < 1.42 && cz > 0.25 && cz < 0.42) kind.set(r, 1)
    else if (cx > 0.23 && cx < 0.33 && cy > 1.06 && cy < 1.26 && cz > 0.5 && cz < 0.66) kind.set(r, 2)
  }
  const limb = new Uint8Array(n)
  for (let i = 0; i < n; i++) limb[i] = kind.get(root[i]) ?? 0
  return { limb }
}

const partsCache = new WeakMap<THREE.BufferGeometry, Parts>()
const fitCache = new WeakMap<SuitModel, Map<Build, SuitModel>>()

/** Traje ajustado ao corpo (cacheado por modelo e corpo). */
export function fitSuit(raw: SuitModel, build: Build): SuitModel {
  let per = fitCache.get(raw)
  if (!per) {
    per = new Map()
    fitCache.set(raw, per)
  }
  let m = per.get(build)
  if (!m) {
    m = buildFit(raw, build)
    per.set(build, m)
  }
  return m
}

const qUp = new THREE.Quaternion()
const qFore = new THREE.Quaternion()

function buildFit(raw: SuitModel, build: Build): SuitModel {
  const src = raw.geometry
  let parts = partsCache.get(src)
  if (!parts) {
    parts = classify(src)
    partsCache.set(src, parts)
  }
  const sp = src.getAttribute('position') as THREE.BufferAttribute
  const sn = src.getAttribute('normal') as THREE.BufferAttribute
  const count = sp.count
  const P = new Float32Array(count * 3)
  const N = new Float32Array(count * 3)

  // 1) Ajuste ao corpo (largura do tronco, capacete e pernas), pontos e normais juntos
  for (let i = 0; i < count; i++) {
    const y = sp.getY(i)
    const f = fitScale(build, y)
    P[3 * i] = sp.getX(i) * f.x
    P[3 * i + 1] = y
    P[3 * i + 2] = sp.getZ(i) * f.z
    const nx = sn.getX(i) / f.x, nz = sn.getZ(i) / f.z, ny = sn.getY(i)
    const l = Math.hypot(nx, ny, nz) || 1
    N[3 * i] = nx / l
    N[3 * i + 1] = ny / l
    N[3 * i + 2] = nz / l
  }
  if (build === 'female') {
    // Capacete um pouco mais baixo: encolhe a partir da base
    for (let i = 0; i < count; i++) {
      const y = P[3 * i + 1]
      const h = smooth(1.5, 1.6, y)
      P[3 * i + 1] = y + (1.55 + (y - 1.55) * FIT.female.helmetY - y) * h
    }
  }

  // 2) Braços. O braço do Z-2 tem duas peças: o tubo do braço (do anel do ombro ao anel do cotovelo) e a manga, que começa no
  // anel com a sanfona do cotovelo, mais grossa que o braço, e afina até o punho e a luva. Antes de girar, o tubo do braço
  // alonga, a manga afina do cotovelo ao punho como um antebraço (sem o degrau no anel, que fazia a manga parecer um gesso) e
  // também alonga, para os segmentos terem as proporções de um braço. A dobra fica no meio da sanfona, onde está o cotovelo.
  const at = (q: THREE.Vector3) => {
    const f = fitScale(build, q.y)
    return new THREE.Vector3(q.x * f.x, q.y, q.z * f.z)
  }
  const S = at(Z2.shoulder)
  const ua = at(Z2.upper[1]).sub(at(Z2.upper[0])).normalize()
  const uf = at(Z2.fore[1]).sub(at(Z2.fore[0])).normalize()
  const Lu = at(Z2.elbow).sub(S).dot(ua)
  const kU = UPPER_STRETCH - 1
  const kF = FORE_STRETCH - 1
  // Com o braço alongado, o anel do cotovelo e o eixo da manga descem juntos
  const E = at(Z2.elbow).addScaledVector(ua, kU * Lu)
  const F = at(Z2.fore[0]).addScaledVector(ua, kU * Lu)
  const v = new THREE.Vector3()
  const t = new THREE.Vector3()
  const nv = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    const limb = parts.limb[i]
    if (!limb) continue
    const sx = P[3 * i] < 0 ? -1 : 1 // o lado direito é o espelho do esquerdo
    v.set(P[3 * i] * sx, P[3 * i + 1], P[3 * i + 2])
    nv.set(N[3 * i] * sx, N[3 * i + 1], N[3 * i + 2])
    // a) o tubo do braço alonga ao longo do eixo; daí para baixo tudo desce junto
    const along = t.copy(v).sub(S).dot(ua)
    v.addScaledVector(ua, kU * Math.min(Lu, Math.max(0, along)))
    if (along > 0 && along < Lu) stretchNormal(nv, ua, UPPER_STRETCH)
    if (limb === 2) {
      // b) a manga: distância ao longo do eixo a partir do anel do cotovelo, e o ponto do eixo na mesma altura
      const sF = t.copy(v).sub(E).dot(uf)
      c.copy(F).addScaledVector(uf, t.copy(v).sub(F).dot(uf))
      // afina como um antebraço: a distância ao eixo diminui do anel até o punho (a luva não muda)
      const f = foreTaper(sF)
      if (f !== 1) {
        const df = (foreTaper(sF + 0.002) - foreTaper(sF - 0.002)) / 0.004
        taperNormal(nv, uf, t.copy(v).sub(c), f, df)
        v.sub(c).multiplyScalar(f).add(c)
      }
      // alonga entre a sanfona e o punho
      if (sF > FORE_STRETCH_FROM) {
        v.addScaledVector(uf, kF * (Math.min(sF, FORE_STRETCH_TO) - FORE_STRETCH_FROM))
        if (sF < FORE_STRETCH_TO) stretchNormal(nv, uf, FORE_STRETCH)
      }
    }
    nv.normalize()
    P[3 * i] = v.x * sx
    P[3 * i + 1] = v.y
    P[3 * i + 2] = v.z
    N[3 * i] = nv.x * sx
    N[3 * i + 1] = nv.y
    N[3 * i + 2] = nv.z
  }

  // 2b) Pose: o braço gira em torno do ombro e o antebraço em torno do cotovelo (no meio da sanfona). Cada ponto gira rigidamente
  // por uma rotação que passa do tronco ao braço no ombro e do braço ao antebraço no cotovelo, por interpolação esférica: ao
  // contrário de misturar duas posições, o tubo não murcha na dobra.
  const Pv = E.clone().addScaledVector(uf, ELBOW_AT) // cotovelo
  qUp.setFromUnitVectors(ua, ARM_UP)
  // O antebraço acompanha o giro do braço e só depois flexiona o mínimo necessário: sem torção a mais no cotovelo
  qFore.setFromUnitVectors(uf.clone().applyQuaternion(qUp), ARM_FORE).multiply(qUp)
  const Pp = Pv.clone().sub(S).applyQuaternion(qUp).add(S) // cotovelo depois do giro do braço
  const qW = new THREE.Quaternion()
  const qId = new THREE.Quaternion()
  const aS = Z2.shoulderAxis
  const arm = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const limb = parts.limb[i]
    if (!limb) continue
    arm[i] = 1
    const sx = P[3 * i] < 0 ? -1 : 1
    v.set(P[3 * i] * sx, P[3 * i + 1], P[3 * i + 2])
    nv.set(N[3 * i] * sx, N[3 * i + 1], N[3 * i + 2])
    const sS = t.copy(v).sub(S).dot(aS)
    const sE = t.copy(v).sub(Pv).dot(uf)
    const wU = limb === 1 ? smooth(0, SHOULDER_BLEND, sS) : 1
    const wF = smooth(-ELBOW_BLEND, ELBOW_BLEND, sE)
    if (wF > 0) {
      // do cotovelo para baixo (a mistura do ombro já terminou: o tubo está bem longe dele)
      qW.copy(qUp).slerp(qFore, wF)
      v.sub(Pv).applyQuaternion(qW).add(Pp)
    } else {
      qW.copy(qId).slerp(qUp, wU)
      v.sub(S).applyQuaternion(qW).add(S)
    }
    nv.applyQuaternion(qW).normalize()
    P[3 * i] = v.x * sx
    P[3 * i + 1] = v.y
    P[3 * i + 2] = v.z
    N[3 * i] = nv.x * sx
    N[3 * i + 1] = nv.y
    N[3 * i + 2] = nv.z
  }

  // 3) O corpo entra pela frente do tronco: o traje sobe um pouco para trás
  for (let i = 0; i < count; i++) P[3 * i + 2] += BODY_Z

  // 4) Atributos do shader do corpo
  const sys = new Float32Array(count)
  const base = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    sys[i] = SYS_INDEX[arm[i] ? 'muscular' : suitSystemAt(P[3 * i], P[3 * i + 1], P[3 * i + 2])]
    base[3 * i] = P[3 * i]
    base[3 * i + 1] = P[3 * i + 1]
    base[3 * i + 2] = P[3 * i + 2]
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3))
  g.setAttribute('uv', src.getAttribute('uv'))
  g.setAttribute('aSys', new THREE.BufferAttribute(sys, 1))
  g.setAttribute('aArm', new THREE.BufferAttribute(arm, 1))
  g.setAttribute('aBase', new THREE.BufferAttribute(base, 3))
  g.setAttribute('aDir', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  g.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  // Oclusão das concavidades do traje (pregas, anéis, virilha, axilas)
  const idx32 = Uint32Array.from(src.index!.array as ArrayLike<number>)
  g.setAttribute('aAO', new THREE.BufferAttribute(cavityAO(P, N, buildWelds(P, idx32), { fine: 3, wide: 12, fineScale: 0.006, wideScale: 0.03 }), 1))
  // Visor: os triângulos dourados da frente do capacete saem do traje e viram uma malha própria
  const split = splitVisor(src.index!.array as ArrayLike<number>, P, src.getAttribute('uv') as THREE.BufferAttribute, raw.spec, raw.map)
  g.setIndex(new THREE.BufferAttribute(split.body, 1))
  g.computeBoundingSphere()
    ; (g as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree = new MeshBVH(g)
  let visor: THREE.BufferGeometry | null = null
  if (split.visor.length) {
    visor = new THREE.BufferGeometry()
    for (const name of Object.keys(g.attributes)) visor.setAttribute(name, g.getAttribute(name))
    visor.setIndex(new THREE.BufferAttribute(split.visor, 1))
    visor.computeBoundingSphere()
  }
  return { geometry: g, visor, map: raw.map, bump: raw.bump, spec: raw.spec }
}

/** Sobe a cabeça no capacete: o centro do visor fica uns 13 cm acima dos olhos do corpo, e a folga entre o nariz e o vidro é grande. */
export const HEAD_IN_HELMET = { lift: 0.12, forward: 0.0 }

/** Pixels de uma textura decodificada, lidos uma vez (a imagem é grande e o ajuste roda por corpo) */
const pixelCache = new WeakMap<object, { w: number; h: number; d: Uint8ClampedArray } | null>()
function readPixels(tex: THREE.Texture | null): { w: number; h: number; d: Uint8ClampedArray } | null {
  const img = tex?.image as (CanvasImageSource & { width: number; height: number }) | undefined
  if (!img || typeof document === 'undefined') return null
  const hit = pixelCache.get(img)
  if (hit !== undefined) return hit
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const cx = c.getContext('2d', { willReadFrequently: true })
  let out: { w: number; h: number; d: Uint8ClampedArray } | null = null
  if (cx) {
    cx.drawImage(img, 0, 0)
    out = { w: c.width, h: c.height, d: cx.getImageData(0, 0, c.width, c.height).data }
  }
  pixelCache.set(img, out)
  return out
}

/**
 * Separa os triângulos do visor: a calota dourada (três vértices com vermelho alto e azul baixo no mapa de especular) e a casca
 * escura que o modelo guarda atrás dela, dentro da janela da frente do capacete (cor base quase preta). Sem a casca escura o
 * rosto ficaria escondido atrás de uma parede preta. Os mapas só existem no navegador; sem eles nada é separado.
 */
export function splitVisor(index: ArrayLike<number>, P: Float32Array, uv: THREE.BufferAttribute, spec: THREE.Texture | null, map: THREE.Texture | null): { body: Uint32Array; visor: Uint32Array } {
  const all = Uint32Array.from(index)
  const sp = readPixels(spec)
  if (!sp) return { body: all, visor: new Uint32Array(0) }
  const cp = readPixels(map)
  const at = (im: { w: number; h: number; d: Uint8ClampedArray }, u: number, v: number) => {
    const x = Math.min(im.w - 1, Math.max(0, Math.floor(u * im.w)))
    const y = Math.min(im.h - 1, Math.max(0, Math.floor(v * im.h)))
    return (y * im.w + x) * 4
  }
  const gold = new Uint8Array(uv.count)
  for (let i = 0; i < uv.count; i++) {
    const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2]
    // a calota dourada inteira (frente, laterais e o lado de dentro da parte de trás): só o que fica acima do anel do pescoço
    const inDome = Math.abs(x) < 0.27 && y > 1.6 && y < 1.92
    const k = at(sp, uv.getX(i), uv.getY(i))
    const isGold = sp.d[k] > 110 && sp.d[k] - sp.d[k + 2] > 45
    // casca escura da janela: dentro da frente do capacete e com a cor base quase preta
    let isDark = false
    if (cp && Math.abs(x) < 0.19 && y > 1.62 && y < 1.86 && z > 0.0 && z < 0.215) {
      const c = at(cp, uv.getX(i), uv.getY(i))
      isDark = 0.2126 * cp.d[c] + 0.7152 * cp.d[c + 1] + 0.0722 * cp.d[c + 2] < 52
    }
    gold[i] = (inDome && isGold) || isDark ? 1 : 0
  }
  const body: number[] = []
  const visor: number[] = []
  for (let t = 0; t < all.length; t += 3) {
    const out = gold[all[t]] && gold[all[t + 1]] && gold[all[t + 2]] ? visor : body
    out.push(all[t], all[t + 1], all[t + 2])
  }
  return { body: Uint32Array.from(body), visor: Uint32Array.from(visor) }
}
