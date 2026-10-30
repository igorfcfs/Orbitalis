import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ATLAS_ARM, makeArmPose, poseDirSym, poseSym } from './pose'

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const pose = makeArmPose(V(...ATLAS_ARM.shoulder), V(...ATLAS_ARM.elbow), V(...ATLAS_ARM.wrist))

describe('postura de repouso do braço', () => {
  it('o ombro não sai do lugar', () => {
    const s = V(...ATLAS_ARM.shoulder)
    expect(pose.apply(s.clone()).distanceTo(s)).toBeLessThan(1e-6)
  })

  it('o pulso fica mais perto do corpo e um pouco mais à frente que na posição anatômica', () => {
    const w = V(...ATLAS_ARM.wrist)
    expect(pose.wrist.x).toBeLessThan(w.x - 0.02)
    expect(pose.wrist.z).toBeGreaterThan(w.z)
    // e o braço não encolhe: o comprimento do antebraço é o mesmo
    expect(pose.wrist.distanceTo(pose.elbow)).toBeCloseTo(w.distanceTo(V(...ATLAS_ARM.elbow)), 5)
  })

  it('a palma, que olhava para a frente, passa a olhar a coxa (para dentro, x negativo)', () => {
    const w = V(...ATLAS_ARM.wrist)
    const hand = w.clone().add(V(0, -0.05, 0.02))
    const palm = poseDirSym(pose, hand, V(0, 0, 1), V(0, 0, 1), true)
    expect(palm.x).toBeLessThan(-0.7)
  })

  it('os dedos curvam para a palma (que olha a coxa): a ponta vai para dentro, e a mão não alonga', () => {
    const w = V(...ATLAS_ARM.wrist)
    const tip = V(0.27, 0.7, 0.045) // ponta do dedo médio no atlas, a ~14,6 cm do pulso
    const posed = poseSym(pose, tip.clone(), undefined, true)
    // sem a curva, a ponta ficaria na vertical do pulso; com ela, vai mais de 1 cm para o lado da palma (x negativo)
    expect(posed.x).toBeLessThan(pose.wrist.x - 0.01)
    // a curva é um arco, não um esticão: a distância ao pulso não passa da do dedo reto
    expect(posed.distanceTo(pose.wrist)).toBeLessThan(tip.distanceTo(w) + 0.002)
  })

  it('a curva só começa nos nós dos dedos: o dorso da mão, acima deles, só gira junto com o antebraço', () => {
    const w = V(...ATLAS_ARM.wrist)
    const palmBack = V(0.27, 0.8, 0.02) // dorso da mão, entre o pulso e os nós
    const p = poseSym(pose, palmBack.clone(), undefined, true)
    expect(p.distanceTo(pose.wrist)).toBeCloseTo(palmBack.distanceTo(w), 3)
  })

  it('o lado direito é o espelho do esquerdo', () => {
    const p = V(0.265, 0.77, 0.04)
    const l = poseSym(pose, p.clone(), undefined, true)
    const r = poseSym(pose, V(-p.x, p.y, p.z), undefined, true)
    expect(r.x).toBeCloseTo(-l.x, 6)
    expect(r.y).toBeCloseTo(l.y, 6)
    expect(r.z).toBeCloseTo(l.z, 6)
  })

  it('quadril e coxa, que a anatomia traz no mesmo arquivo, não são mexidos', () => {
    for (const p of [V(0.18, 0.8, 0.0), V(0.15, 0.9, -0.05), V(0.12, 1.3, -0.08), V(0.06, 1.0, 0.05)]) {
      expect(poseSym(pose, p.clone(), undefined, true).distanceTo(p)).toBeLessThan(1e-6)
    }
  })

  it('o braço de cima quase não muda: só o antebraço, a mão e os dedos', () => {
    const arm = V(0.21, 1.25, -0.012) // meio do braço de cima
    expect(poseSym(pose, arm.clone(), undefined, true).distanceTo(arm)).toBeLessThan(0.006)
    const forearm = V(0.248, 0.98, 0.01) // meio do antebraço
    expect(poseSym(pose, forearm.clone(), undefined, true).distanceTo(forearm)).toBeGreaterThan(0.01)
  })
})
