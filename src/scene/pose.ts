import * as THREE from 'three'

/**
 * Postura de repouso do braço. O atlas está na posição anatômica (palmas para a frente, dedos esticados, braços abertos
 * como num manequim). Aqui o braço ganha uma postura natural de quem está de pé: antebraço um pouco flexionado e mais
 * perto do corpo, palma voltada para a coxa (pronação) e dedos soltos, levemente curvos.
 *
 * É uma função só da posição (rotações rígidas em torno do ombro e do cotovelo, com mistura suave nas juntas), então vale
 * igual para a pele, o macacão, o fantasma do raio-X e a anatomia por dentro, que assim continuam coincidindo.
 */

/** Articulações do braço esquerdo no atlas (m): ombro, cotovelo e pulso. O direito é o espelho em x. */
export const ATLAS_ARM = {
  shoulder: [0.2, 1.395, -0.02],
  elbow: [0.219, 1.125, -0.006],
  wrist: [0.27, 0.846, 0.036],
} as const

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Direções de repouso (braço esquerdo, x para fora): o braço pende quase na vertical; o antebraço flexiona para a frente. */
const REST_UPPER = new THREE.Vector3(0.075, -0.995, 0.06).normalize()
const REST_FORE = new THREE.Vector3(0.05, -0.972, 0.23).normalize()
/** Pronação do antebraço e da mão, em radianos: a palma sai da frente e passa a olhar a coxa. */
export const ROLL = THREE.MathUtils.degToRad(76)
/** A curva dos dedos começa na linha dos nós, 7,1 cm abaixo do pulso, e tem esta curvatura (rad por metro de dedo). */
const MCP_DROP = 0.071
const MCP_Z = 0.049
export const CURL = 10.5
/** Só a mão do atlas fica a mais de 21,5 cm do eixo do corpo nesta altura */
const HAND_MIN_X = 0.215

export interface ArmPose {
  /** Esquerdo; para o direito, espelhe x antes e depois (veja `poseSym`). */
  apply(p: THREE.Vector3, out?: THREE.Vector3, gated?: boolean): THREE.Vector3
  /** Direção (normal, direção radial) transportada pela mesma deformação. */
  dir(p: THREE.Vector3, d: THREE.Vector3, out?: THREE.Vector3, gated?: boolean): THREE.Vector3
  /** Articulações depois da postura */
  elbow: THREE.Vector3
  wrist: THREE.Vector3
  /** Direção do antebraço depois da postura */
  foreAxis: THREE.Vector3
}

/** `S`, `E` e `W` são ombro, cotovelo e pulso do braço esquerdo no corpo em questão (o corpo feminino já vem deformado). */
export function makeArmPose(S: THREE.Vector3, E: THREE.Vector3, W: THREE.Vector3): ArmPose {
  const Lu = E.distanceTo(S)
  const Lf = W.distanceTo(E)
  const uSrc = E.clone().sub(S).normalize()
  const fSrc = W.clone().sub(E).normalize()
  const qU = new THREE.Quaternion().setFromUnitVectors(uSrc, REST_UPPER)
  const E2 = S.clone().addScaledVector(REST_UPPER, Lu)
  // O antebraço acompanha o giro do braço e só depois flexiona o mínimo necessário: sem torção extra no cotovelo
  const qB = new THREE.Quaternion().setFromUnitVectors(fSrc.clone().applyQuaternion(qU), REST_FORE)
  const qF = qB.clone().multiply(qU)
  const W2 = E2.clone().addScaledVector(REST_FORE, Lf)
  const mcpY = W.y - MCP_DROP

  const ab = new THREE.Vector3()
  const ap = new THREE.Vector3()
  const cp = new THREE.Vector3()
  /** Parâmetro ao longo da poligonal S–E–W (0 a 2) e distância a ela */
  const nearest = (p: THREE.Vector3) => {
    let bestR = Infinity
    let bestU = 0
    for (let s = 0; s < 2; s++) {
      const a = s === 0 ? S : E
      const b = s === 0 ? E : W
      ab.subVectors(b, a)
      ap.subVectors(p, a)
      const t = Math.min(1, Math.max(0, ap.dot(ab) / ab.lengthSq()))
      cp.copy(a).addScaledVector(ab, t)
      const r = p.distanceTo(cp)
      if (r < bestR) {
        bestR = r
        bestU = s + t
      }
    }
    return { u: bestU, r: bestR }
  }

  const q = new THREE.Vector3()
  const pu = new THREE.Vector3()
  const pf = new THREE.Vector3()
  const c = new THREE.Vector3()
  const rot = new THREE.Quaternion()

  const apply = (p: THREE.Vector3, out: THREE.Vector3 = p, gated = false) => {
    const { u, r } = nearest(p)
    let gate = 1
    if (gated) {
      // Só vale perto do braço (a anatomia traz quadril, costelas e mão no mesmo arquivo)
      const lim = u > 1.9 ? 0.2 : 0.085
      gate = 1 - smooth(lim - 0.03, lim, r)
      if (u > 1.9) gate *= smooth(0.195, 0.22, p.x)
      if (gate <= 0) return out.copy(p)
    }
    q.copy(p)
    // dedos: cada ponto abaixo da linha dos nós gira em torno do nó, e o ângulo cresce com a distância (arco de curvatura constante)
    if (q.x > HAND_MIN_X && q.y < mcpY) {
      const s = mcpY - q.y
      const off = q.z - MCP_Z
      const th = Math.min(CURL * s, 1.3)
      const R = 1 / CURL
      q.y = mcpY - (R - off) * Math.sin(th)
      q.z = MCP_Z + R * (1 - Math.cos(th)) + off * Math.cos(th)
    }
    const wU = smooth(0, 0.3, u)
    const wF = smooth(0.82, 1.2, u)
    pu.copy(q).sub(S).applyQuaternion(qU).add(S)
    pf.copy(q).sub(E).applyQuaternion(qF).add(E2)
    q.lerp(pu, wU).lerp(pf, wF)
    // pronação: torção em torno do eixo do antebraço, crescendo do cotovelo ao pulso
    const rho = ROLL * smooth(1.15, 1.95, u)
    if (rho > 1e-4) {
      rot.setFromAxisAngle(REST_FORE, rho)
      c.copy(q).sub(E2)
      c.copy(REST_FORE).multiplyScalar(c.dot(REST_FORE)).add(E2)
      q.sub(c).applyQuaternion(rot).add(c)
    }
    return out.copy(p).lerp(q, gate)
  }

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const dir = (p: THREE.Vector3, d: THREE.Vector3, out: THREE.Vector3 = d, gated = false) => {
    const eps = 0.003
    apply(a.copy(p), a, gated)
    apply(b.copy(p).addScaledVector(d, eps), b, gated)
    return out.copy(b.sub(a)).normalize()
  }

  return { apply, dir, elbow: E2, wrist: W2, foreAxis: REST_FORE.clone() }
}

/** Aplica a postura nos dois lados: o direito é o espelho do esquerdo. */
export function poseSym(pose: ArmPose, p: THREE.Vector3, out: THREE.Vector3 = p, gated = false) {
  const sx = p.x < 0 ? -1 : 1
  const x0 = p.x
  p.x = x0 * sx
  pose.apply(p, out, gated)
  if (out !== p) p.x = x0
  out.x *= sx
  return out
}

export function poseDirSym(pose: ArmPose, p: THREE.Vector3, d: THREE.Vector3, out: THREE.Vector3 = d, gated = false) {
  const sx = p.x < 0 ? -1 : 1
  const pm = new THREE.Vector3(p.x * sx, p.y, p.z)
  const dm = new THREE.Vector3(d.x * sx, d.y, d.z)
  pose.dir(pm, dm, out, gated)
  out.x *= sx
  return out
}
