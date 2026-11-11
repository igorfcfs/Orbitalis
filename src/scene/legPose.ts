import { createContext } from 'react'
import * as THREE from 'three'
import { BODY_POINTS, HIP, warp, type Build } from './bodyBuild'
import { makeArmPose } from './pose'

/**
 * Postura das pernas (RF-33): deitado de costas no assento da cápsula e os passos e saltos de 1/6 g na Lua.
 *
 * O corpo não tem esqueleto, então a perna gira rigidamente em torno do quadril (flexão da coxa para a frente) e do joelho
 * (a canela volta para trás), com o ângulo crescendo suavemente na junta. A mesma conta roda no shader (pele, macacão,
 * fantasma do raio-X e camadas da anatomia) e aqui na CPU, para a malha invisível do clique acompanhar o corpo sentado.
 *
 * Cada vértice traz `aLeg` (1 = perna ou pelve abaixo do quadril, 0 = o resto): a mão pende ao lado da coxa e não pode
 * girar com ela, por isso a classificação é por distância às poligonais da perna e do braço já posto, não só pela altura.
 */

/** Flexão do quadril e do joelho no assento (rad), no corpo de pé: coxa quase a 90° do tronco, canela quase a 90° da coxa */
export const SEAT_HIP = 1.45
export const SEAT_KNEE = 1.45

export interface LegJoints {
  /** Quadril e joelho da perna esquerda (x > 0); a direita é o espelho em x */
  hip: THREE.Vector3
  knee: THREE.Vector3
  ankle: THREE.Vector3
}

const jointsCache = new Map<Build, LegJoints>()
export function legJoints(build: Build): LegJoints {
  let j = jointsCache.get(build)
  if (!j) {
    j = { hip: warp(HIP.clone(), build), knee: warp(BODY_POINTS.kneeL.clone(), build), ankle: warp(BODY_POINTS.ankleL.clone(), build) }
    jointsCache.set(build, j)
  }
  return j
}

/** Corpo da anatomia: sempre no atlas masculino, sem a deformação feminina */
export const ANATOMY_JOINTS: LegJoints = legJoints('male')

/** Uniformes da postura: ângulos (quadril esquerdo, quadril direito, joelho esquerdo, joelho direito) e as juntas */
export interface LegUniforms {
  uLegPose: THREE.IUniform<THREE.Vector4>
  uHipJ: THREE.IUniform<THREE.Vector3>
  uKneeJ: THREE.IUniform<THREE.Vector3>
}

export const makeLegUniforms = (j: LegJoints): LegUniforms => ({
  uLegPose: { value: new THREE.Vector4() },
  uHipJ: { value: j.hip.clone() },
  uKneeJ: { value: j.knee.clone() },
})

/**
 * GLSL: `legPos(b, p)` e `legDir(b, n)`, onde `b` é a posição de repouso (pesos e lado) e `p` a posição já com o físico.
 * Pesos: a coxa gira a partir de 2 cm acima do quadril até 12 cm abaixo; a canela, de 4 cm acima a 6 cm abaixo do joelho.
 */
export const LEG_POSE_GLSL = /* glsl */ `
uniform vec4 uLegPose; uniform vec3 uHipJ; uniform vec3 uKneeJ;
vec3 rotX(vec3 v, float a) { float c = cos(a); float s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }
void legFrame(vec3 b, float leg, out vec3 H, out vec3 K2, out float ah, out float ak) {
  float side = b.x >= 0.0 ? 1.0 : -1.0;
  float f = b.x >= 0.0 ? uLegPose.x : uLegPose.y;
  float kf = b.x >= 0.0 ? uLegPose.z : uLegPose.w;
  H = vec3(side * uHipJ.x, uHipJ.y, uHipJ.z);
  vec3 K = vec3(side * uKneeJ.x, uKneeJ.y, uKneeJ.z);
  K2 = H + rotX(K - H, -f);
  ah = -f * leg * smoothstep(0.02, -0.12, b.y - H.y);
  ak = kf * leg * smoothstep(0.04, -0.06, b.y - K.y);
}
vec3 legPos(vec3 b, float leg, vec3 p) {
  if (leg <= 0.0) return p;
  vec3 H; vec3 K2; float ah; float ak;
  legFrame(b, leg, H, K2, ah, ak);
  vec3 q = H + rotX(p - H, ah);
  return K2 + rotX(q - K2, ak);
}
vec3 legDir(vec3 b, float leg, vec3 n) {
  if (leg <= 0.0) return n;
  vec3 H; vec3 K2; float ah; float ak;
  legFrame(b, leg, H, K2, ah, ak);
  return rotX(rotX(n, ah), ak);
}
`

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const rotX = (v: THREE.Vector3, a: number) => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const y = c * v.y - s * v.z
  v.z = s * v.y + c * v.z
  v.y = y
  return v
}

/** O mesmo que `legPos` do shader, na CPU. `angles` = (quadril E, quadril D, joelho E, joelho D). */
export function legPosePoint(b: THREE.Vector3, leg: number, angles: THREE.Vector4, j: LegJoints, p: THREE.Vector3, out = new THREE.Vector3()) {
  out.copy(p)
  if (leg <= 0) return out
  const side = b.x >= 0 ? 1 : -1
  const f = b.x >= 0 ? angles.x : angles.y
  const kf = b.x >= 0 ? angles.z : angles.w
  const H = new THREE.Vector3(side * j.hip.x, j.hip.y, j.hip.z)
  const K = new THREE.Vector3(side * j.knee.x, j.knee.y, j.knee.z)
  const K2 = rotX(K.clone().sub(H), -f).add(H)
  const ah = -f * leg * smooth(0.02, -0.12, b.y - H.y)
  const ak = kf * leg * smooth(0.04, -0.06, b.y - K.y)
  rotX(out.sub(H), ah).add(H)
  return rotX(out.sub(K2), ak).add(K2)
}

const segDist = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
  const ab = b.clone().sub(a)
  const t = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / ab.lengthSq()))
  return p.distanceTo(a.clone().addScaledVector(ab, t))
}
const polyDist = (p: THREE.Vector3, pts: THREE.Vector3[]) => {
  let d = Infinity
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(p, pts[i], pts[i + 1]))
  return d
}

/**
 * Atributo `aLeg` de uma geometria (lido de `aBase`, ou da posição quando não há repouso). Guardado na própria geometria,
 * que é compartilhada entre astronautas do mesmo corpo-base. `anatomy` = sem a deformação feminina e com o braço do atlas.
 */
export function ensureLegWeights(geo: THREE.BufferGeometry, build: Build) {
  if (geo.getAttribute('aLeg')) return
  const j = legJoints(build)
  const P = BODY_POINTS
  const pose = makeArmPose(warp(P.shoulderL.clone(), build), warp(P.elbowL.clone(), build), warp(P.wristL.clone(), build))
  const tip = pose.wrist.clone().addScaledVector(pose.foreAxis, 0.19)
  const arm = [warp(P.shoulderL.clone(), build), pose.elbow, pose.wrist, tip]
  const leg = [j.hip, j.knee, j.ankle, j.ankle.clone().add(new THREE.Vector3(0, -0.06, 0.16))]
  const src = (geo.getAttribute('aBase') ?? geo.getAttribute('position')) as THREE.BufferAttribute
  const out = new Float32Array(src.count)
  const v = new THREE.Vector3()
  for (let i = 0; i < src.count; i++) {
    v.set(Math.abs(src.getX(i)), src.getY(i), src.getZ(i))
    if (v.y > j.hip.y + 0.04) continue
    const dl = polyDist(v, leg)
    const da = polyDist(v, arm)
    // Perto do limite entre a mão e a coxa, uma faixa curta evita degraus
    out[i] = smooth(-0.01, 0.015, da - dl)
  }
  geo.setAttribute('aLeg', new THREE.BufferAttribute(out, 1))
}

/** Cópia da malha do clique já com as pernas dobradas (guardada por geometria), para o clique e o hover acompanharem o corpo */
const seatedCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>()
export function seatedPick(geo: THREE.BufferGeometry, build: Build): THREE.BufferGeometry {
  const hit = seatedCache.get(geo)
  if (hit) return hit
  ensureLegWeights(geo, build)
  const g = geo.clone()
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const base = (g.getAttribute('aBase') ?? pos) as THREE.BufferAttribute
  const legW = g.getAttribute('aLeg') as THREE.BufferAttribute
  const angles = new THREE.Vector4(SEAT_HIP, SEAT_HIP, SEAT_KNEE, SEAT_KNEE)
  const j = legJoints(build)
  const b = new THREE.Vector3()
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    b.set(base.getX(i), base.getY(i), base.getZ(i))
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i))
    legPosePoint(b, legW.getX(i), angles, j, p, p)
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  pos.needsUpdate = true
  g.computeBoundingBox()
  g.computeBoundingSphere()
  ;(g as THREE.BufferGeometry & { boundsTree?: unknown }).boundsTree = undefined
  seatedCache.set(geo, g)
  return g
}

/**
 * Deitado de costas no assento (foguete na plataforma). Numa cápsula de verdade (Crew Dragon, Soyuz, Orion) o foguete fica
 * de pé e a tripulação vai deitada de costas, com o quadril e os joelhos dobrados a uns 90°: as costas apoiam no encosto, as
 * coxas apontam para o nariz da nave, as canelas ficam na horizontal sobre o apoio de panturrilha e o rosto olha para cima,
 * para o painel. Assim a aceleração da subida empurra o corpo contra o encosto (do peito para as costas), e não para os pés.
 *
 * O corpo usa a pose sentada das pernas (SEAT_HIP, SEAT_KNEE) e o grupo inteiro gira −90° em x em torno do quadril, que fica
 * em SUPINE (m, mundo; x é o da formação).
 */
export const SUPINE = { hipY: 1.0, hipZ: 0.12 }

/**
 * Transformação do grupo que deita o corpo: rotação em x e posição (y, z), interpoladas por `s` (0 = de pé, 1 = deitado).
 * `hipY` e `hipZ` são o quadril no espaço do pai do corpo (m), já com a escala do astronauta.
 */
export function reclineFrame(s: number, hipY: number, hipZ: number) {
  const a = (-Math.PI / 2) * s
  const c = Math.cos(a)
  const sn = Math.sin(a)
  // Onde o quadril vai parar depois do giro, e o que falta para ele chegar ao ponto do assento
  const ty = hipY + s * (SUPINE.hipY - hipY)
  const tz = hipZ + s * (SUPINE.hipZ - hipZ)
  return { rotX: a, y: ty - (c * hipY - sn * hipZ), z: tz - (sn * hipY + c * hipZ) }
}

/**
 * Um ponto do corpo de pé (m, corpo de 1,8 m, x = 0) levado para a postura deitada no assento: as pernas dobram como no
 * shader e o corpo gira em torno do quadril. Serve para a câmera mirar a região certa no foguete.
 */
export function supinePoint(p: THREE.Vector3, scale = 1.8 / 1.743, out = new THREE.Vector3()) {
  const j = legJoints('male')
  const angles = new THREE.Vector4(SEAT_HIP, SEAT_HIP, SEAT_KNEE, SEAT_KNEE)
  const b = p.clone().divideScalar(scale)
  // A mão e o braço não dobram com a perna; abaixo do quadril, só a perna tem alvo de câmera
  legPosePoint(b, b.y < j.hip.y ? 1 : 0, angles, j, b.clone(), out)
  const dy = (out.y - j.hip.y) * scale
  const dz = (out.z - j.hip.z) * scale
  return out.set(p.x, SUPINE.hipY + dz, SUPINE.hipZ - dy)
}

/** Ângulos da postura do astronauta, para as camadas da anatomia (filhas do rig) girarem as pernas junto */
export const LegPoseContext = createContext<THREE.IUniform<THREE.Vector4> | null>(null)
