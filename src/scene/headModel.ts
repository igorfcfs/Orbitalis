import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SYS_INDEX } from './bodyBuild'
import { measureNeck, type NeckFit } from './collar'

/**
 * Cabeças da tripulação: quatro avatares da biblioteca Microsoft Rocketbox (licença MIT), personagens genéricos que
 * "não existem na realidade" (feitos por escultura, com fotos de referência muito misturadas). Cada arquivo em
 * /models/heads é um GLB já convertido por `tools/heads/build_head.py`: a cabeça, o pescoço e o cabelo de um avatar, escalados e
 * posicionados no espaço do corpo do atlas (olhos nos olhos do atlas, pescoço no pescoço), com textura de cor, normal e
 * rugosidade e o cabelo em cartões com alfa. `loadHead` ainda trata o que o conversor deixa: troca os globos oculares por esferas
 * com a íris da cor do astronauta, fecha um pouco as pálpebras, tira o busto e afina a base do pescoço (que o macacão e a gola
 * escondem) e monta o couro cabeludo para o cabelo em camadas de fios (`hairShells.ts`).
 */

export interface HeadModel {
  /** Pele da cabeça e do pescoço (inclui a boca e as pálpebras) */
  skin: THREE.BufferGeometry
  eyes: THREE.BufferGeometry
  /** Cartões de cabelo com alfa; nulo nos avatares com o cabelo pintado na própria malha */
  hair: THREE.BufferGeometry | null
  color: THREE.Texture
  normal: THREE.Texture | null
  /** Rugosidade no canal G */
  rough: THREE.Texture | null
  hairMap: THREE.Texture | null
  /** Anel do pescoço (centro e semieixos, m), de onde a gola do macacão fecha em volta de cada astronauta */
  neck: NeckFit
  /** Couro cabeludo (triângulos da pele acima da linha do cabelo, com `aScalp` e o índice de camada `aShell` instanciado): base das camadas de fios */
  scalp: THREE.BufferGeometry | null
  /** Unidades de UV por metro no couro cabeludo (para o tamanho dos fios nas camadas) */
  uvScale: number
  style: HairStyle
  /** Quanto escurecer os cartões de cabelo para casarem com o couro cabeludo pintado na textura de pele (1 = igual) */
  hairTint: number
  /** Tom médio da pele (bochechas), para as mãos e o pescoço do corpo combinarem com o rosto */
  avgSkin: THREE.Color
  topY: number
}

/**
 * Estilo do cabelo de cada astronauta. O avatar traz cartões de cabelo soltos sobre um couro cabeludo pintado: ficavam tiras
 * detalhadas ao lado de áreas só com textura. Aqui o couro cabeludo todo ganha camadas de fios (veja hairShells.ts), com o
 * comprimento (m), a cobertura (0 a 1), o quanto o cabelo é penteado para trás (`slick`) e para o lado (`sweep`) e o tamanho
 * da mecha (m). `cards` mantém os cartões do avatar (rabo de cavalo e franja de Lena e Aiko); sem eles só ficam os fios.
 */
export interface HairStyle {
  len: number
  cover: number
  slick: number
  sweep: number
  cell: number
  cards: boolean
}
export const HAIR_STYLE: Record<string, HairStyle> = {
  lena: { len: 0.014, cover: 0.9, slick: 0.95, sweep: 0, cell: 0.0011, cards: true },
  aiko: { len: 0.016, cover: 0.9, slick: 0.95, sweep: 0, cell: 0.0011, cards: true },
  rafael: { len: 0.03, cover: 0.95, slick: 0.15, sweep: 0.35, cell: 0.0014, cards: false },
  daniel: { len: 0.011, cover: 1, slick: 0, sweep: 0, cell: 0.0009, cards: false },
}
/** Camadas de fios sobre o couro cabeludo */
export const SHELLS = 14
const DEFAULT_STYLE: HairStyle = { len: 0.015, cover: 0.9, slick: 0.5, sweep: 0, cell: 0.0012, cards: true }

const loader = new GLTFLoader()
const cache = new Map<string, Promise<HeadModel>>()

/** Região do corpo (id do sistema) de cada ponto da cabeça: olhos em volta da órbita, o resto é cabeça; a base do pescoço é imune. */
export function headSystemAt(x: number, y: number, z: number): number {
  const ax = Math.abs(x)
  if (ax > 0.012 && ax < 0.056 && y > 1.572 && y < 1.622 && z > 0.04) return SYS_INDEX.neuro_ocular + 0.25
  if (y < 1.5) return SYS_INDEX.immune + 0.25
  return SYS_INDEX.behavior + 0.25
}

/**
 * Globos oculares novos no lugar dos do avatar: os do arquivo são esferas de ~60 vértices com a íris pintada na textura de pele
 * (amarelada e distorcida pelos triângulos grandes). Aqui há uma esfera fina por olho, no mesmo centro e raio, com uma
 * leve saliência na córnea. Esclera, íris e pupila vêm de `eyeTexture` (mapeada como a SphereGeometry, íris em +z): a cor dos
 * olhos é a do astronauta e não depende da textura do avatar.
 */
export interface EyeBall {
  c: THREE.Vector3
  r: number
}

/** Centro e raio de cada globo da malha de olhos do avatar, pela caixa (a média dos vértices pende para os polos e para a emenda da esfera). */
export function measureEyes(src: THREE.BufferGeometry): EyeBall[] {
  const p = src.getAttribute('position') as THREE.BufferAttribute
  const box = [new THREE.Box3(), new THREE.Box3()]
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) box[p.getX(i) >= 0 ? 0 : 1].expandByPoint(v.fromBufferAttribute(p, i))
  return box
    .filter((b) => !b.isEmpty())
    .map((b) => {
      const size = b.getSize(new THREE.Vector3())
      return { c: b.getCenter(new THREE.Vector3()), r: (size.x + size.y + size.z) / 6 }
    })
}

/**
 * Fecha um pouco as pálpebras. O avatar vem de olhos muito abertos (esclera à mostra em volta da íris inteira, olhar assustado):
 * a margem da pálpebra de cima desce e a de baixo sobe, com queda suave, e nada entra no globo.
 */
export function closeLids(skin: THREE.BufferGeometry, eyes: EyeBall[]) {
  const p = skin.getAttribute('position') as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (const { c, r } of eyes) {
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      if (v.z < c.z + 0.35 * r) continue // só a frente do olho
      const dx = v.x - c.x, dy = v.y - c.y
      const d = Math.hypot(dx, dy) / r
      if (d > 2.3) continue
      const g = smoothstep(2.3, 0.9, d)
      v.y += dy > 0 ? -0.2 * r * g * smoothstep(-0.1, 0.5, dy / r) : 0.1 * r * g * smoothstep(0.1, -0.5, dy / r)
      // fica fora da córnea
      const dist = v.distanceTo(c)
      const minR = r * 1.08
      if (dist < minR) v.sub(c).multiplyScalar(minR / (dist || 1)).add(c)
      p.setXYZ(i, v.x, v.y, v.z)
    }
  }
  p.needsUpdate = true
}

export function buildEyes(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const v = new THREE.Vector3()
  const balls: THREE.BufferGeometry[] = []
  for (const { c, r } of measureEyes(src)) {
    const g = new THREE.SphereGeometry(r, 48, 32)
    const q = g.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < q.count; i++) {
      v.fromBufferAttribute(q, i)
      const a = Math.acos(Math.min(1, Math.max(-1, v.z / (v.length() || 1)))) // ângulo ao eixo do olhar (+z)
      const t = Math.min(1, Math.max(0, (a - 0.15) / 0.5))
      v.multiplyScalar(1 + 0.05 * (1 - t * t * (3 - 2 * t)))
      q.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    // um pouco para dentro da órbita: as pálpebras cobrem mais do globo e o olhar deixa de parecer assustado
    g.translate(c.x, c.y, c.z - 0.0012)
    balls.push(g)
  }
  return balls.length > 1 ? mergeGeometries(balls, false) : balls[0]
}

/** Largura máxima (|x|, m) do pescoço de um avatar e altura abaixo da qual o resto é busto: ombros e peito que vêm junto com a cabeça. */
const BUST_MAX_X = 0.081
const BUST_TOP_Y = 1.47

/**
 * Alguns avatares trazem o busto (trapézio, ombros e parte do peito) junto com o pescoço: o de Aiko tem flanges de 10 cm de meia
 * largura em volta da base do pescoço, que furavam o macacão do corpo feminino e apareciam como manchas de pele nos ombros.
 * Aqui saem os triângulos que ficam inteiros abaixo de `BUST_TOP_Y` e passam de `BUST_MAX_X` de largura. Os outros avatares têm
 * o pescoço mais estreito que isso e nada muda. O que sobra da base do pescoço fica escondido dentro da gola.
 */
export function trimBust(g: THREE.BufferGeometry, maxX = BUST_MAX_X, topY = BUST_TOP_Y): THREE.BufferGeometry {
  const index = g.index
  const p = g.getAttribute('position') as THREE.BufferAttribute
  if (!index) return g
  const idx = index.array
  const keep: number[] = []
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2]
    const hi = Math.max(p.getY(a), p.getY(b), p.getY(c))
    const wide = Math.max(Math.abs(p.getX(a)), Math.abs(p.getX(b)), Math.abs(p.getX(c)))
    if (hi < topY && wide > maxX) continue
    keep.push(a, b, c)
  }
  if (keep.length !== idx.length) g.setIndex(keep)
  return g
}

/**
 * A base do pescoço do avatar (o peito e a clavícula que sobram depois de `trimBust`) fica dentro do macacão e da gola, mas ainda
 * furava a casca no ombro em lascas de pele. Abaixo de `TAPER_TOP` a seção do pescoço encolhe para dentro, em direção ao eixo,
 * até `TAPER_MIN` da largura na base: vira um cone que cabe folgado na gola. Acima disso o pescoço fica como está.
 */
const TAPER_TOP = 1.448
const TAPER_BOTTOM = 1.405
const TAPER_MIN = 0.55

export function taperNeckBase(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute
  const index = g.index
  const used = new Uint8Array(p.count)
  if (index) for (let k = 0; k < index.count; k++) used[index.array[k]] = 1
  else used.fill(1)
  // eixo do pescoço: o centro dos vértices logo acima da zona afinada
  let cx = 0, cz = 0, n = 0
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    if (!used[i] || y < TAPER_TOP || y > TAPER_TOP + 0.015) continue
    cx += p.getX(i)
    cz += p.getZ(i)
    n++
  }
  if (!n) return g
  cx /= n
  cz /= n
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    if (y >= TAPER_TOP) continue
    const t = smoothstep(TAPER_TOP, TAPER_BOTTOM, y)
    const k = 1 - (1 - TAPER_MIN) * t
    p.setX(i, cx + (p.getX(i) - cx) * k)
    p.setZ(i, cz + (p.getZ(i) - cz) * k)
  }
  p.needsUpdate = true
  g.computeBoundingSphere()
  return g
}

/** Atributos que o shader do corpo espera (sistema, posição de repouso, físico e oclusão). Aqui só o sistema varia. */
export function prepareHeadGeometry(src: THREE.BufferGeometry, sys: number | null): THREE.BufferGeometry {
  const g = src.clone()
  const p = g.getAttribute('position') as THREE.BufferAttribute
  const n = p.count
  const S = new Float32Array(n)
  const B = new Float32Array(p.array as Float32Array)
  for (let i = 0; i < n; i++) S[i] = sys ?? headSystemAt(p.getX(i), p.getY(i), p.getZ(i))
  g.setAttribute('aSys', new THREE.BufferAttribute(S, 1))
  g.setAttribute('aBase', new THREE.BufferAttribute(B, 3))
  g.setAttribute('aDir', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  g.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  g.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1))
  g.setAttribute('aCut', new THREE.BufferAttribute(new Float32Array(n).fill(-1), 1))
  g.computeBoundingSphere()
  return g
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Peso do couro cabeludo por vértice (0 a 1): acima da linha do cabelo na testa e nas têmporas, e atrás da cabeça até a nuca,
 * onde a textura de pele é escura (o cabelo pintado). Sobrancelhas, barba e boca ficam de fora pela geometria.
 */
export function scalpWeights(pos: THREE.BufferAttribute, uv: THREE.BufferAttribute, color: CanvasImageSource | null | undefined, skin: [number, number, number]): Float32Array {
  const n = pos.count
  const out = new Float32Array(n)
  const SIZE = 512
  const px = pixelsOf(color, SIZE)
  const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b
  const sl = lum(skin[0] * 255, skin[1] * 255, skin[2] * 255)
  for (let i = 0; i < n; i++) {
    const x = Math.abs(pos.getX(i)), y = pos.getY(i), z = pos.getZ(i)
    // acima da linha do cabelo (testa), nas laterais acima das orelhas e atrás da cabeça, da nuca para cima. Nas têmporas e acima
    // das orelhas o cabelo pintado na pele brilhava como pele (uma placa cinza lustrosa entre as mechas)
    const elig = Math.max(
      smoothstep(1.645, 1.67, y),
      smoothstep(0.058, 0.07, x) * smoothstep(1.545, 1.575, y),
      smoothstep(-0.015, -0.045, z) * smoothstep(1.47, 1.53, y),
    )
    if (elig <= 0) continue
    let dark = 1
    if (px) {
      const u = Math.min(SIZE - 1, Math.max(0, Math.round(uv.getX(i) * (SIZE - 1))))
      const v = Math.min(SIZE - 1, Math.max(0, Math.round(uv.getY(i) * (SIZE - 1))))
      const k = (v * SIZE + u) * 4
      dark = 1 - smoothstep(0.3 * sl, 0.56 * sl, lum(px[k], px[k + 1], px[k + 2]))
    }
    out[i] = elig * dark
  }
  return out
}

/** Couro cabeludo como geometria própria: só os triângulos com os três vértices cobertos de cabelo. Devolve também as UV por metro. */
export function buildScalp(skin: THREE.BufferGeometry, weights: Float32Array, shells: number): { geometry: THREE.BufferGeometry; uvScale: number } | null {
  const idx = skin.index!.array
  const pos = skin.getAttribute('position') as THREE.BufferAttribute
  const uv = skin.getAttribute('uv') as THREE.BufferAttribute
  const keep: number[] = []
  let a3 = 0, a2 = 0
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3()
  for (let t = 0; t < idx.length; t += 3) {
    const i = idx[t], j = idx[t + 1], k = idx[t + 2]
    if (weights[i] < 0.3 || weights[j] < 0.3 || weights[k] < 0.3) continue
    keep.push(i, j, k)
    A.fromBufferAttribute(pos, i); B.fromBufferAttribute(pos, j); C.fromBufferAttribute(pos, k)
    a3 += B.clone().sub(A).cross(C.clone().sub(A)).length() / 2
    a2 += Math.abs((uv.getX(j) - uv.getX(i)) * (uv.getY(k) - uv.getY(i)) - (uv.getX(k) - uv.getX(i)) * (uv.getY(j) - uv.getY(i))) / 2
  }
  if (keep.length < 90 || a3 <= 0) return null
  const g = skin.clone()
  g.setIndex(keep)
  g.setAttribute('aScalp', new THREE.BufferAttribute(weights, 1))
  const shell = new Float32Array(shells)
  for (let s = 0; s < shells; s++) shell[s] = (s + 1) / shells
  g.setAttribute('aShell', new THREE.InstancedBufferAttribute(shell, 1))
  g.computeBoundingSphere()
  return { geometry: g, uvScale: Math.sqrt(a2 / a3) }
}

/** Pixels de uma imagem de textura, reduzidos (estatística de cor; não precisa da resolução cheia). */
function pixelsOf(img: CanvasImageSource | null | undefined, size = 256): Uint8ClampedArray | null {
  if (!img || typeof document === 'undefined') return null
  try {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d', { willReadFrequently: true })
    if (!g) return null
    g.drawImage(img, 0, 0, size, size)
    return g.getImageData(0, 0, size, size).data
  } catch {
    return null
  }
}

/**
 * Os cartões de cabelo do avatar são mais claros que o couro cabeludo pintado por baixo: sem ajuste, as tiras aparecem como
 * barras alaranjadas sobre o cabelo escuro. A relação das luminâncias (cartões opacos contra os pixels escuros da pele, que
 * são o cabelo pintado) dá o fator que os iguala.
 */
export function hairTintFor(color: CanvasImageSource | null | undefined, hair: CanvasImageSource | null | undefined, skin: [number, number, number]): number {
  const cd = pixelsOf(color), hd = pixelsOf(hair)
  if (!cd || !hd) return 1
  const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b
  let card = 0, cn = 0
  for (let i = 0; i < hd.length; i += 4) {
    if (hd[i + 3] > 230) {
      card += lum(hd[i], hd[i + 1], hd[i + 2])
      cn++
    }
  }
  const sl = lum(skin[0] * 255, skin[1] * 255, skin[2] * 255)
  let scalp = 0, sn = 0
  for (let i = 0; i < cd.length; i += 4) {
    const l = lum(cd[i], cd[i + 1], cd[i + 2])
    if (l > 6 && l < sl * 0.42) {
      scalp += l
      sn++
    }
  }
  if (cn < 50 || sn < 200) return 1
  return Math.min(1, Math.max(0.3, scalp / sn / (card / cn)))
}

export function loadHead(id: string): Promise<HeadModel> {
  let p = cache.get(id)
  if (!p) {
    p = loader.loadAsync(`/models/heads/${id}.glb`).then((gltf) => {
      const meshes = new Map<string, THREE.Mesh>()
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) meshes.set(m.name, m)
      })
      const skin = meshes.get('skin')
      const eyes = meshes.get('eyes')
      if (!skin || !eyes) throw new Error(`head ${id}: missing skin or eyes`)
      const hair = meshes.get('hair')
      const mat = skin.material as THREE.MeshStandardMaterial
      const hairMat = hair?.material as THREE.MeshStandardMaterial | undefined
      const extras = (gltf.parser.json.extras ?? {}) as { avgSkin?: number[]; topY?: number }
      const avg = extras.avgSkin ?? [0.7, 0.5, 0.4]
      for (const t of [mat.map, mat.normalMap, mat.roughnessMap, hairMat?.map]) if (t) t.anisotropy = 8
      const style = HAIR_STYLE[id] ?? DEFAULT_STYLE
      closeLids(skin.geometry, measureEyes(eyes.geometry))
      const skinGeo = taperNeckBase(trimBust(prepareHeadGeometry(skin.geometry, null)))
      const weights = scalpWeights(skinGeo.getAttribute('position') as THREE.BufferAttribute, skinGeo.getAttribute('uv') as THREE.BufferAttribute, mat.map?.image as CanvasImageSource | undefined, [avg[0], avg[1], avg[2]])
      const scalp = skinGeo.index && skinGeo.getAttribute('uv') ? buildScalp(skinGeo, weights, SHELLS) : null
      skinGeo.setAttribute('aScalp', new THREE.BufferAttribute(weights, 1))
      const cards = !!hair && style.cards
      return {
        skin: skinGeo,
        eyes: prepareHeadGeometry(buildEyes(eyes.geometry), SYS_INDEX.neuro_ocular),
        hair: cards ? prepareHeadGeometry(hair!.geometry, SYS_INDEX.behavior) : null,
        neck: measureNeck(skinGeo.getAttribute('position') as THREE.BufferAttribute, skinGeo.index?.array),
        scalp: scalp?.geometry ?? null,
        uvScale: scalp?.uvScale ?? 1,
        style,
        color: mat.map!,
        normal: mat.normalMap ?? null,
        rough: mat.roughnessMap ?? null,
        hairMap: cards ? hairMat?.map ?? null : null,
        hairTint: cards && hairMat?.map ? hairTintFor(mat.map?.image as CanvasImageSource | undefined, hairMat.map.image as CanvasImageSource, [avg[0], avg[1], avg[2]]) : 1,
        // As texturas do GLB estão em sRGB; o tom médio vem em sRGB e precisa virar cor linear de material
        avgSkin: new THREE.Color().setRGB(avg[0], avg[1], avg[2], THREE.SRGBColorSpace),
        topY: extras.topY ?? 1.7,
      } satisfies HeadModel
    })
    p.catch(() => cache.delete(id))
    cache.set(id, p)
  }
  return p
}
