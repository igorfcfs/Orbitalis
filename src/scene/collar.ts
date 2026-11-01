import * as THREE from 'three'

/**
 * Gola do macacão. O atlas deixava uma "tigela" larga em volta do pescoço (o corte pegava a inclinação do trapézio, com a
 * abertura de ±13 cm contra um pescoço de ±6 cm), com o interior da casca à mostra e dentes onde o corte cruzava a malha.
 * Agora o macacão é cortado num plano limpo (`COLLAR_BASE`) e sobe dali uma gola feita à parte: um funil que sai do laço do corte,
 * se fecha num anel em volta do pescoço de cada astronauta (medido na cabeça), sobe uns centímetros em pé, enrola a borda e
 * desce por dentro, mais escura. A malha é pequena e é montada por astronauta, no mesmo espaço e com os mesmos atributos do
 * macacão (cor por vértice, `aBase`, `aSys`, `aDir`, `aW`, `aAO`, `aCut`).
 */

/** Altura do corte do macacão em volta do pescoço (m), na frente e atrás. */
export const COLLAR_BASE = 1.418
/** A partir daqui (|x|, m) o plano de corte sobe para fora: acima do trapézio ele passa do ombro e deixa a linha natural dele intacta. */
const SHOULDER_FREE = 0.1
const SHOULDER_RISE = 0.7

/**
 * Altura do plano de corte na posição lateral `x`. Plano reto de ponta a ponta achatava os ombros em uma prateleira; assim o corte
 * fica horizontal perto do pescoço e sobe, cruzando a curva do ombro uns 14 cm do centro, onde o corte termina sem degrau.
 */
export const collarPlane = (x: number) => COLLAR_BASE + SHOULDER_RISE * Math.max(0, Math.abs(x) - SHOULDER_FREE)

/** Centro do pescoço no plano do corte, para ordenar o laço por ângulo. */
const LOOP_CENTER = { x: 0, z: -0.02 }

/** Pontos do laço do corte, em volta do pescoço (por ângulo), com os atributos do macacão nesses vértices. */
export interface CollarLoop {
  count: number
  /** Posições do laço, na borda exata do corte do macacão */
  P: Float32Array
  /** O mesmo laço com o raio suavizado: é por ele que o funil sobe (a emenda fica no P) */
  Q: Float32Array
  B: Float32Array
  N: Float32Array
  C: Float32Array
  D: Float32Array
  W: Float32Array
  O: Float32Array
}

/** Anel da gola em volta do pescoço: centro e semieixos (m), na altura da gola. */
export interface NeckFit {
  cx: number
  cz: number
  ax: number
  az: number
  /**
   * Raio do pescoço (m) em cada direção em volta do centro, `NECK_BINS` valores a partir de +z no sentido de +x, já com a folga:
   * é o maior raio da pele em toda a altura da gola, então a gola fecha rente ao pescoço de cada astronauta, mesmo com o
   * pescoço inclinado, e a pele nunca fura a parede. Sem isto vale a elipse (ax, az).
   */
  radii?: number[]
}

export const NECK_BINS = 48

export const DEFAULT_NECK: NeckFit = { cx: 0, cz: -0.015, ax: 0.074, az: 0.066 }

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Vértices do macacão na borda do corte da gola (`aCut` = 0 perto do pescoço), sem repetidos e em ordem de ângulo. */
export function extractCollarLoop(g: THREE.BufferGeometry): CollarLoop | null {
  const pos = g.getAttribute('position') as THREE.BufferAttribute | undefined
  const cut = g.getAttribute('aCut') as THREE.BufferAttribute | undefined
  if (!pos || !cut) return null
  const seen = new Set<string>()
  const picked: number[] = []
  const edge: number[] = [] // todos os vértices da borda (com os repetidos), para a borda acompanhar o laço suavizado
  for (let i = 0; i < pos.count; i++) {
    if (cut.getX(i) !== 0) continue
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    if (Math.abs(y - collarPlane(x)) > 2e-3 || Math.abs(x) > 0.3) continue // os punhos também têm borda de corte
    edge.push(i)
    const key = `${Math.round(x * 1e5)},${Math.round(z * 1e5)}`
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(i)
  }
  if (picked.length < 24) return null
  const ang = (i: number) => Math.atan2(pos.getX(i) - LOOP_CENTER.x, pos.getZ(i) - LOOP_CENTER.z)
  picked.sort((a, b) => ang(a) - ang(b))
  const m = picked.length
  const angles = picked.map(ang)
  // Reamostra em ângulos uniformes: os vértices do corte são irregulares (saem do recorte dos triângulos) e davam pregas no funil
  const n = LOOP_SAMPLES
  const out = {
    count: n,
    P: new Float32Array(n * 3), Q: new Float32Array(n * 3), B: new Float32Array(n * 3), N: new Float32Array(n * 3), C: new Float32Array(n * 3),
    D: new Float32Array(n * 3), W: new Float32Array(n * 2), O: new Float32Array(n),
  }
  const strides: [keyof Omit<CollarLoop, 'count'>, string, number][] = [
    ['P', 'position', 3], ['B', 'aBase', 3], ['N', 'normal', 3], ['C', 'color', 3], ['D', 'aDir', 3], ['W', 'aW', 2], ['O', 'aAO', 1],
  ]
  for (let j = 0; j < n; j++) {
    const a = -Math.PI + ((j + 0.5) / n) * 2 * Math.PI
    // segmento k -> k+1 (com a volta) que contém o ângulo a
    let k = angles.findIndex((v) => v > a) - 1
    if (k < -1) k = m - 1
    const k0 = k < 0 ? m - 1 : k
    const k1 = (k0 + 1) % m
    let a0 = angles[k0], a1 = angles[k1]
    if (a1 < a0) a1 += 2 * Math.PI
    let aa = a
    if (aa < a0) aa += 2 * Math.PI
    const t = a1 > a0 ? Math.min(1, Math.max(0, (aa - a0) / (a1 - a0))) : 0
    for (const [key, name, stride] of strides) {
      const att = g.getAttribute(name) as THREE.BufferAttribute
      for (let c = 0; c < stride; c++) out[key][j * stride + c] = att.getComponent(picked[k0], c) * (1 - t) + att.getComponent(picked[k1], c) * t
    }
    const l = Math.hypot(out.N[3 * j], out.N[3 * j + 1], out.N[3 * j + 2]) || 1
    out.N[3 * j] /= l; out.N[3 * j + 1] /= l; out.N[3 * j + 2] /= l
  }
  // Suaviza o raio do laço em volta do centro (média móvel circular): tira os dentes e deixa o funil liso
  const rad = new Float32Array(n)
  const dir = new Float32Array(n * 2)
  for (let j = 0; j < n; j++) {
    const dx = out.P[3 * j] - LOOP_CENTER.x, dz = out.P[3 * j + 2] - LOOP_CENTER.z
    rad[j] = Math.hypot(dx, dz)
    dir[2 * j] = dx / (rad[j] || 1)
    dir[2 * j + 1] = dz / (rad[j] || 1)
  }
  const tmp = new Float32Array(n)
  for (let it = 0; it < 4; it++) {
    for (let j = 0; j < n; j++) tmp[j] = (rad[(j + n - 2) % n] + 2 * rad[(j + n - 1) % n] + 3 * rad[j] + 2 * rad[(j + 1) % n] + rad[(j + 2) % n]) / 9
    rad.set(tmp)
  }
  for (let j = 0; j < n; j++) {
    out.Q[3 * j] = LOOP_CENTER.x + dir[2 * j] * rad[j]
    out.Q[3 * j + 2] = LOOP_CENTER.z + dir[2 * j + 1] * rad[j]
    out.Q[3 * j + 1] = collarPlane(out.Q[3 * j])
  }
  // A borda do macacão passa a seguir o laço suavizado (o plano corta o ombro quase na horizontal e deixava a borda em zigue-zague
  // de centímetros, o que aparecia como dentes na emenda com a gola): o mesmo raio, no mesmo ângulo, nos vértices da borda
  for (const i of edge) {
    const th = Math.atan2(pos.getX(i) - LOOP_CENTER.x, pos.getZ(i) - LOOP_CENTER.z)
    const u = ((th + Math.PI) / (2 * Math.PI)) * n - 0.5
    const j0 = Math.floor(u)
    const f = u - j0
    const r = rad[((j0 % n) + n) % n] * (1 - f) + rad[(((j0 + 1) % n) + n) % n] * f
    const nx = LOOP_CENTER.x + Math.sin(th) * r
    pos.setX(i, nx)
    pos.setY(i, collarPlane(nx)) // continua sobre o plano de corte
    pos.setZ(i, LOOP_CENTER.z + Math.cos(th) * r)
  }
  pos.needsUpdate = true
  out.P.set(out.Q)
  return out
}

const LOOP_SAMPLES = 96

/** Eixo do pescoço (x, z) em torno do qual o macacão encolhe dentro do traje (é o centro do laço do corte) */
export const NECK_AXIS = LOOP_CENTER

/**
 * O mesmo laço, encolhido em torno do eixo do pescoço: a gola de dentro do traje parte do macacão encolhido (`scale`), mas o
 * anel em volta do pescoço continua com a medida da pele.
 */
export function scaleLoop(loop: CollarLoop, s: number): CollarLoop {
  const sc = (src: Float32Array) => {
    const out = new Float32Array(src)
    for (let j = 0; j < loop.count; j++) {
      out[3 * j] = LOOP_CENTER.x + (src[3 * j] - LOOP_CENTER.x) * s
      out[3 * j + 2] = LOOP_CENTER.z + (src[3 * j + 2] - LOOP_CENTER.z) * s
    }
    return out
  }
  return { ...loop, P: sc(loop.P), Q: sc(loop.Q) }
}

/**
 * Anel do pescoço a partir dos vértices da pele da cabeça entre 1,43 e 1,455 m (acima do ombro, abaixo do maxilar). Com `index`
 * só contam os vértices que algum triângulo usa (o que `trimBust` tirou não entra na medida).
 */
export function measureNeck(pos: THREE.BufferAttribute, index?: ArrayLike<number> | null): NeckFit {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, n = 0
  let used: Uint8Array | null = null
  if (index) {
    used = new Uint8Array(pos.count)
    for (let k = 0; k < index.length; k++) used[index[k]] = 1
  }
  for (let i = 0; i < pos.count; i++) {
    if (used && !used[i]) continue
    const y = pos.getY(i)
    if (y < 1.43 || y > 1.455) continue
    x0 = Math.min(x0, pos.getX(i)); x1 = Math.max(x1, pos.getX(i))
    z0 = Math.min(z0, pos.getZ(i)); z1 = Math.max(z1, pos.getZ(i))
    n++
  }
  if (n < 8) return DEFAULT_NECK
  const clearance = 0.016
  const ax = Math.min(0.1, Math.max(0.062, (x1 - x0) / 2 + clearance))
  const az = Math.min(0.1, Math.max(0.056, (z1 - z0) / 2 + clearance))
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
  // Raio máximo por direção em toda a altura da gola (do corte à borda de cima): o pescoço alarga e se inclina para cima
  const rmax = new Float32Array(NECK_BINS)
  for (let i = 0; i < pos.count; i++) {
    if (used && !used[i]) continue
    const y = pos.getY(i)
    if (y < NECK_Y0 || y > NECK_Y1) continue
    const dx = pos.getX(i) - cx, dz = pos.getZ(i) - cz
    if (Math.abs(dx) > 0.12 || Math.abs(dz) > 0.12) continue // sobra de ombro ou de cabelo
    const b = Math.floor(((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI)) * NECK_BINS) % NECK_BINS
    rmax[b] = Math.max(rmax[b], Math.hypot(dx, dz))
  }
  // A malha do pescoço é esparsa: as direções sem vértice recebem a interpolação das vizinhas mais próximas (sem isto a gola caía
  // na elipse e a pele da nuca, que passa de 8 cm do centro, furava a parede)
  const known: number[] = []
  for (let b = 0; b < NECK_BINS; b++) if (rmax[b] > 0) known.push(b)
  if (known.length < 4) return { cx, cz, ax, az }
  for (let b = 0; b < NECK_BINS; b++) {
    if (rmax[b] > 0) continue
    let lo = b, hi = b, dl = 0, dh = 0
    while (rmax[lo] === 0 || dl === 0) { lo = (lo + NECK_BINS - 1) % NECK_BINS; dl++; if (rmax[lo] > 0) break }
    while (rmax[hi] === 0 || dh === 0) { hi = (hi + 1) % NECK_BINS; dh++; if (rmax[hi] > 0) break }
    // o maior das duas vizinhas: um triângulo largo entre vértices distantes também precisa caber na gola
    rmax[b] = Math.max(rmax[lo], rmax[hi])
  }
  // cada direção vale o maior raio entre ela e as vizinhas (a pele entre duas amostras também precisa caber) mais a folga
  const radii: number[] = []
  for (let b = 0; b < NECK_BINS; b++) {
    const m = Math.max(rmax[b], rmax[(b + 1) % NECK_BINS], rmax[(b + NECK_BINS - 1) % NECK_BINS])
    radii.push(Math.min(0.11, m + NECK_CLEARANCE))
  }
  return { cx, cz, ax, az, radii }
}

/** Faixa de alturas da pele que a gola precisa envolver, e a folga entre a pele e a parede (m) */
const NECK_Y0 = 1.405
const NECK_Y1 = 1.468 // acima daqui, na frente, começa o maxilar (a 1,48 m já passa de 9 cm do centro)
const NECK_CLEARANCE = 0.007

/** Raio do anel do pescoço na direção `theta` (de +z para +x), interpolado entre as amostras */
function neckRadius(neck: NeckFit, theta: number): number | null {
  const r = neck.radii
  if (!r) return null
  const u = ((theta + Math.PI) / (2 * Math.PI)) * NECK_BINS - 0.5
  const j0 = Math.floor(u)
  const f = u - j0
  return r[((j0 % NECK_BINS) + NECK_BINS) % NECK_BINS] * (1 - f) + r[(((j0 + 1) % NECK_BINS) + NECK_BINS) % NECK_BINS] * f
}

interface RingSpec {
  /** 0 = laço do corte, 1 = anel do pescoço (mistura horizontal) */
  s: number
  /** Fração da altura da gola */
  yf: number
  /** Deslocamento vertical (m) somado depois */
  dy: number
  /** Quanto o anel entra em direção ao pescoço (m) */
  inset: number
  /** Escurecimento por oclusão (1 = nenhum) */
  ao: number
}

const RIM = 0.0028
const RINGS: RingSpec[] = [
  { s: 0, yf: 0, dy: 0, inset: 0, ao: 1 },
  { s: 0.2, yf: 0.15, dy: 0, inset: 0, ao: 1 },
  { s: 0.45, yf: 0.34, dy: 0, inset: 0, ao: 1 },
  { s: 0.75, yf: 0.58, dy: 0, inset: 0, ao: 1 },
  { s: 1, yf: 0.78, dy: 0, inset: 0, ao: 1 },
  { s: 1, yf: 1, dy: -RIM, inset: 0, ao: 1 },
  // borda enrolada
  { s: 1, yf: 1, dy: 0, inset: RIM, ao: 0.92 },
  // forro por dentro, mais escuro
  { s: 1, yf: 1, dy: -RIM, inset: RIM * 2, ao: 0.6 },
  { s: 1, yf: 1, dy: -0.014, inset: RIM * 2 + 0.001, ao: 0.42 },
  { s: 1, yf: 1, dy: -0.03, inset: RIM * 2 + 0.0028, ao: 0.3 },
]
/** O anel da borda (o mais alto): daqui medem-se as distâncias para a costura e a borda enrolada */
const RIM_RING = 6

/** Altura da borda de cima da gola: mais baixa na frente (onde fecha o zíper), mais alta atrás. */
const collarTop = (theta: number) => 1.462 + 0.014 * (1 - Math.cos(theta)) * 0.5
/** A gola nunca fica mais baixa que isto (m) sobre o laço, mesmo onde o laço sobe pelo ombro */
const COLLAR_MIN_H = 0.032

export function buildCollar(loop: CollarLoop, neck: NeckFit, sys: number): THREE.BufferGeometry {
  const n = loop.count
  const R = RINGS.length
  const P = new Float32Array(R * n * 3)
  const theta = new Float32Array(n)
  for (let i = 0; i < n; i++) theta[i] = Math.atan2(loop.P[3 * i] - LOOP_CENTER.x, loop.P[3 * i + 2] - LOOP_CENTER.z)
  for (let r = 0; r < R; r++) {
    const spec = RINGS[r]
    for (let i = 0; i < n; i++) {
      const lx = r === 0 ? loop.P[3 * i] : loop.Q[3 * i], lz = r === 0 ? loop.P[3 * i + 2] : loop.Q[3 * i + 2]
      const nr = neckRadius(neck, theta[i])
      const tx = neck.cx + (nr ?? neck.ax) * Math.sin(theta[i])
      const tz = neck.cz + (nr ?? neck.az) * Math.cos(theta[i])
      const s = smooth(0, 1, spec.s)
      let x = lx + (tx - lx) * s
      let z = lz + (tz - lz) * s
      if (spec.inset > 0) {
        const dx = x - neck.cx, dz = z - neck.cz
        const l = Math.hypot(dx, dz) || 1
        x -= (dx / l) * spec.inset
        z -= (dz / l) * spec.inset
      }
      // a borda de cima é nivelada (com a inclinação suave frente-costas); o laço sobe pelo ombro, então ali a gola é mais curta
      const y0 = loop.P[3 * i + 1]
      const top = Math.max(y0 + COLLAR_MIN_H, collarTop(theta[i]))
      P[(r * n + i) * 3] = x
      P[(r * n + i) * 3 + 1] = y0 + (top - y0) * spec.yf + spec.dy
      P[(r * n + i) * 3 + 2] = z
    }
  }
  // Normais pela malha: (tangente do anel) × (tangente do perfil). Para fora na parede de fora, para dentro no forro
  const N = new Float32Array(R * n * 3)
  const at = (r: number, i: number, c: number) => P[(r * n + ((i + n) % n)) * 3 + c]
  let flip = 1
  for (let r = 0; r < R; r++) {
    for (let i = 0; i < n; i++) {
      const ta = [at(r, i + 1, 0) - at(r, i - 1, 0), at(r, i + 1, 1) - at(r, i - 1, 1), at(r, i + 1, 2) - at(r, i - 1, 2)]
      const r0 = Math.max(0, r - 1), r1 = Math.min(R - 1, r + 1)
      const tb = [at(r1, i, 0) - at(r0, i, 0), at(r1, i, 1) - at(r0, i, 1), at(r1, i, 2) - at(r0, i, 2)]
      let nx = ta[1] * tb[2] - ta[2] * tb[1], ny = ta[2] * tb[0] - ta[0] * tb[2], nz = ta[0] * tb[1] - ta[1] * tb[0]
      if (r === 2 && i === 0) {
        // o lado de fora da parede: para longe do centro do pescoço
        const ox = at(r, i, 0) - neck.cx, oz = at(r, i, 2) - neck.cz
        flip = nx * ox + nz * oz < 0 ? -1 : 1
      }
      const l = Math.hypot(nx, ny, nz) || 1
      N[(r * n + i) * 3] = nx / l
      N[(r * n + i) * 3 + 1] = ny / l
      N[(r * n + i) * 3 + 2] = nz / l
    }
  }
  for (let k = 0; k < N.length; k++) N[k] *= flip
  // Distância (m) à borda, medida ao longo do perfil a partir do anel da borda
  const cut = new Float32Array(R * n)
  for (let i = 0; i < n; i++) {
    let acc = 0
    cut[RIM_RING * n + i] = 0
    for (let r = RIM_RING - 1; r >= 0; r--) {
      acc += Math.hypot(at(r, i, 0) - at(r + 1, i, 0), at(r, i, 1) - at(r + 1, i, 1), at(r, i, 2) - at(r + 1, i, 2))
      cut[r * n + i] = -acc
    }
    acc = 0
    for (let r = RIM_RING + 1; r < R; r++) {
      acc += Math.hypot(at(r, i, 0) - at(r - 1, i, 0), at(r, i, 1) - at(r - 1, i, 1), at(r, i, 2) - at(r - 1, i, 2))
      cut[r * n + i] = -acc
    }
  }
  const B = new Float32Array(R * n * 3)
  B.set(P)
  const C = new Float32Array(R * n * 3)
  const D = new Float32Array(R * n * 3)
  const W = new Float32Array(R * n * 2)
  const O = new Float32Array(R * n)
  const S = new Float32Array(R * n).fill(sys)
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < R; r++) {
      const j = r * n + i
      C[3 * j] = loop.C[3 * i]; C[3 * j + 1] = loop.C[3 * i + 1]; C[3 * j + 2] = loop.C[3 * i + 2]
      O[j] = RINGS[r].ao * (r === 0 ? loop.O[i] : 1)
    }
    // a primeira fileira é o próprio laço do macacão: mesma posição de repouso, mesmo físico
    for (let c = 0; c < 3; c++) {
      B[3 * i + c] = loop.B[3 * i + c]
      D[3 * i + c] = loop.D[3 * i + c]
    }
    W[2 * i] = loop.W[2 * i]
    W[2 * i + 1] = loop.W[2 * i + 1]
  }
  const idx: number[] = []
  for (let r = 0; r < R - 1; r++) {
    for (let i = 0; i < n; i++) {
      const a = r * n + i, b = r * n + ((i + 1) % n), c = (r + 1) * n + ((i + 1) % n), d = (r + 1) * n + i
      for (const t of [[a, b, c], [a, c, d]]) {
        // sentido do triângulo de acordo com a normal do vértice
        const [p, q, s2] = t
        const ux = P[3 * q] - P[3 * p], uy = P[3 * q + 1] - P[3 * p + 1], uz = P[3 * q + 2] - P[3 * p + 2]
        const vx = P[3 * s2] - P[3 * p], vy = P[3 * s2 + 1] - P[3 * p + 1], vz = P[3 * s2 + 2] - P[3 * p + 2]
        const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx
        const dot = gx * N[3 * p] + gy * N[3 * p + 1] + gz * N[3 * p + 2]
        if (dot >= 0) idx.push(p, q, s2)
        else idx.push(p, s2, q)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3))
  g.setAttribute('color', new THREE.BufferAttribute(C, 3))
  g.setAttribute('aBase', new THREE.BufferAttribute(B, 3))
  g.setAttribute('aSys', new THREE.BufferAttribute(S, 1))
  g.setAttribute('aDir', new THREE.BufferAttribute(D, 3))
  g.setAttribute('aW', new THREE.BufferAttribute(W, 2))
  g.setAttribute('aCut', new THREE.BufferAttribute(cut, 1))
  g.setAttribute('aAO', new THREE.BufferAttribute(O, 1))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}
