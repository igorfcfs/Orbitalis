import * as THREE from 'three'

/**
 * Cabo de segurança do traje: uma corda simulada (Verlet) presa ao traje de um lado e ao casco da nave do outro. Em microgravidade
 * a corda não pende: ela flutua, acompanha a ponta que se mexe e se acomoda devagar. Só o comprimento máximo é imposto (a corda
 * pode ter folga), com um leve alisamento para não formar nós. A malha é um tubo refeito a cada quadro pela curva dos nós.
 */

const NODES = 26
const SEGMENTS = 52
const RADIUS = 0.013

/** Ponta presa ao casco (m, mundo) */
export const TETHER_HULL = new THREE.Vector3(-4.2, 1.2, -9.4)

export interface Tether {
  mesh: THREE.Mesh
  /** Avança a corda: `start` é o ponto do traje em coordenadas do mundo; `calm` congela o balanço aleatório */
  step: (start: THREE.Vector3, dt: number, t: number, calm: boolean) => void
  /** Esquece a posição dos nós: a próxima `step` recomeça a corda a partir do traje */
  reset: () => void
  dispose: () => void
}

export function createTether(material: THREE.Material): Tether {
  const pos = Array.from({ length: NODES }, () => new THREE.Vector3())
  const prev = Array.from({ length: NODES }, () => new THREE.Vector3())
  let ready = false
  let rest = 0
  const curve = new THREE.CatmullRomCurve3(pos, false, 'catmullrom', 0.5)
  const geometry = new THREE.TubeGeometry(curve, SEGMENTS, RADIUS, 6, false)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.visible = false
  const tmp = new THREE.Vector3()
  const dir = new THREE.Vector3()

  function init(start: THREE.Vector3) {
    // Começa como uma curva frouxa saindo para trás e para baixo do astronauta
    const chord = start.distanceTo(TETHER_HULL)
    rest = (chord * 1.14) / (NODES - 1)
    for (let i = 0; i < NODES; i++) {
      const s = i / (NODES - 1)
      pos[i].lerpVectors(start, TETHER_HULL, s)
      pos[i].y -= Math.sin(Math.PI * s) * 0.9
      pos[i].x += Math.sin(Math.PI * s) * -0.7
      prev[i].copy(pos[i])
    }
    ready = true
  }

  function step(start: THREE.Vector3, dt: number, t: number, calm: boolean) {
    if (!ready) init(start)
    const h = Math.min(dt, 1 / 30)
    // Integração: velocidade com amortecimento e uma deriva lenta e suave, diferente em cada nó
    for (let i = 1; i < NODES - 1; i++) {
      tmp.copy(pos[i])
      dir.copy(pos[i]).sub(prev[i]).multiplyScalar(0.985)
      pos[i].add(dir)
      if (!calm) {
        const a = 0.06 * h * h * 60
        pos[i].x += Math.sin(t * 0.31 + i * 0.9) * a * 0.02
        pos[i].y += Math.sin(t * 0.27 + i * 1.3) * a * 0.02
        pos[i].z += Math.cos(t * 0.23 + i * 0.7) * a * 0.02
      }
      prev[i].copy(tmp)
    }
    pos[0].copy(start)
    prev[0].copy(start)
    pos[NODES - 1].copy(TETHER_HULL)
    prev[NODES - 1].copy(TETHER_HULL)
    // Restrições: comprimento máximo entre nós vizinhos (a corda aguenta tração, não compressão) e alisamento
    for (let it = 0; it < 8; it++) {
      for (let i = 0; i < NODES - 1; i++) {
        const a = pos[i], b = pos[i + 1]
        dir.copy(b).sub(a)
        const d = dir.length()
        if (d <= rest || d === 0) continue
        dir.multiplyScalar((d - rest) / d)
        if (i === 0) b.sub(dir)
        else if (i === NODES - 2) a.add(dir)
        else {
          a.addScaledVector(dir, 0.5)
          b.addScaledVector(dir, -0.5)
        }
      }
      pos[0].copy(start)
      pos[NODES - 1].copy(TETHER_HULL)
    }
    for (let i = 1; i < NODES - 1; i++) {
      tmp.copy(pos[i - 1]).add(pos[i + 1]).multiplyScalar(0.5)
      pos[i].lerp(tmp, 0.04)
    }
    // Tubo novo pela curva dos nós; a topologia é a mesma, então só os vértices são copiados
    curve.updateArcLengths() // a curva guarda os comprimentos de arco em cache; sem isto o tubo usa os de quando os nós estavam em zero
    const fresh = new THREE.TubeGeometry(curve, SEGMENTS, RADIUS, 6, false)
    const p = geometry.getAttribute('position') as THREE.BufferAttribute
    const n = geometry.getAttribute('normal') as THREE.BufferAttribute
    p.array.set(fresh.getAttribute('position').array)
    n.array.set(fresh.getAttribute('normal').array)
    p.needsUpdate = true
    n.needsUpdate = true
    fresh.dispose()
  }

  return { mesh, step, reset: () => { ready = false }, dispose: () => geometry.dispose() }
}
