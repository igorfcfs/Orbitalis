import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { SEAT_HIP, SEAT_KNEE, SUPINE, ensureLegWeights, legJoints, legPosePoint, reclineFrame, supinePoint } from './legPose'
import { lunarGait } from './AstronautRig'

const SEATED = new THREE.Vector4(SEAT_HIP, SEAT_HIP, SEAT_KNEE, SEAT_KNEE)

describe('RF-33: pernas dobradas no assento (foguete)', () => {
  const j = legJoints('male')

  it('o quadril não sai do lugar, o joelho sobe quase à altura do quadril e vai para a frente', () => {
    const hip = legPosePoint(j.hip, 1, SEATED, j, j.hip.clone())
    expect(hip.distanceTo(j.hip)).toBeLessThan(1e-6)
    const knee = legPosePoint(j.knee, 1, SEATED, j, j.knee.clone())
    expect(knee.y).toBeGreaterThan(j.hip.y - 0.08)
    expect(knee.z).toBeGreaterThan(0.4)
  })

  it('a canela fica quase na vertical e o comprimento da perna se mantém', () => {
    const knee = legPosePoint(j.knee, 1, SEATED, j, j.knee.clone())
    const ankle = legPosePoint(j.ankle, 1, SEATED, j, j.ankle.clone())
    const shin = ankle.clone().sub(knee)
    expect(Math.abs(shin.z) / shin.length()).toBeLessThan(0.15)
    expect(shin.length()).toBeCloseTo(j.ankle.distanceTo(j.knee), 3)
  })

  it('o resto do corpo (peso 0) e o tronco acima do quadril não se mexem', () => {
    const hand = new THREE.Vector3(0.25, 0.75, 0.05)
    expect(legPosePoint(hand, 0, SEATED, j, hand.clone()).distanceTo(hand)).toBe(0)
    const chest = new THREE.Vector3(0.05, 1.2, 0.1)
    expect(legPosePoint(chest, 1, SEATED, j, chest.clone()).distanceTo(chest)).toBeLessThan(1e-9)
  })

  it('a perna direita é o espelho da esquerda', () => {
    const l = legPosePoint(j.knee, 1, SEATED, j, j.knee.clone())
    const kr = new THREE.Vector3(-j.knee.x, j.knee.y, j.knee.z)
    const r = legPosePoint(kr, 1, SEATED, j, kr.clone())
    expect(r.x).toBeCloseTo(-l.x, 6)
    expect(r.y).toBeCloseTo(l.y, 6)
    expect(r.z).toBeCloseTo(l.z, 6)
  })

  it('a mão pendurada ao lado da coxa não gira com a perna; a coxa e a nádega giram', () => {
    const g = new THREE.BufferGeometry()
    // mão (ao lado da coxa), coxa, nádega e peito
    const pts = [0.245, 0.78, 0.07, 0.1, 0.7, 0.05, 0.08, 0.84, -0.12, 0.05, 1.25, 0.1]
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    ensureLegWeights(g, 'male')
    const w = g.getAttribute('aLeg') as THREE.BufferAttribute
    expect(w.getX(0)).toBe(0)
    expect(w.getX(1)).toBe(1)
    expect(w.getX(2)).toBe(1)
    expect(w.getX(3)).toBe(0)
  })
})

describe('RF-33: deitado de costas no foguete de pé', () => {
  const S = 1.8 / 1.743
  const j = legJoints('male')
  const hip = j.hip.clone().multiplyScalar(S)
  const place = (p: THREE.Vector3, s = 1) => {
    const f = reclineFrame(s, hip.y, hip.z)
    const c = Math.cos(f.rotX)
    const sn = Math.sin(f.rotX)
    return new THREE.Vector3(p.x, c * p.y - sn * p.z + f.y, sn * p.y + c * p.z + f.z)
  }

  it('de pé (s = 0) nada muda; deitado, o quadril vai para o ponto do assento', () => {
    const p = new THREE.Vector3(0.1, 1.4, 0.05)
    expect(place(p, 0).distanceTo(p)).toBeLessThan(1e-9)
    const h = place(hip)
    expect(h.y).toBeCloseTo(SUPINE.hipY, 6)
    expect(h.z).toBeCloseTo(SUPINE.hipZ, 6)
  })

  it('o tronco fica na horizontal, com a cabeça para trás e o rosto para cima (para o nariz da nave)', () => {
    const head = place(new THREE.Vector3(0, 1.65, 0))
    expect(Math.abs(head.y - SUPINE.hipY)).toBeLessThan(0.01)
    expect(head.z).toBeLessThan(SUPINE.hipZ - 0.6)
    const nose = place(new THREE.Vector3(0, 1.65, 0.1))
    expect(nose.y - head.y).toBeCloseTo(0.1, 6)
  })

  it('as coxas apontam para cima e as canelas ficam na horizontal, com os pés longe da cabeça', () => {
    const knee = supinePoint(j.knee.clone().multiplyScalar(S))
    const ankle = supinePoint(j.ankle.clone().multiplyScalar(S))
    expect(knee.y - SUPINE.hipY).toBeGreaterThan(0.38)
    expect(Math.abs(knee.z - SUPINE.hipZ)).toBeLessThan(0.1)
    expect(Math.abs(ankle.y - knee.y)).toBeLessThan(0.08)
    expect(ankle.z - knee.z).toBeGreaterThan(0.32)
  })

  it('o alvo da câmera para a cabeça cai na cabeça deitada', () => {
    const t = supinePoint(new THREE.Vector3(0, 1.6, 0.05))
    expect(t.y).toBeCloseTo(SUPINE.hipY + 0.05, 2)
    expect(t.z).toBeLessThan(SUPINE.hipZ - 0.55)
  })
})

describe('RF-33: passos e saltos em 1/6 g (Lua)', () => {
  it('o salto é uma parábola com a gravidade lunar: uns 18 cm e cerca de 0,94 s no ar', () => {
    let peak = 0
    let air = 0
    for (let t = 0; t < 11; t += 0.005) {
      const g = lunarGait(t)
      peak = Math.max(peak, g.lift)
      if (g.lift > 0) air += 0.005
    }
    expect(peak).toBeGreaterThan(0.17)
    expect(peak).toBeLessThan(0.19)
    expect(air).toBeGreaterThan(0.88)
    expect(air).toBeLessThan(1.0)
  })

  it('os passos levantam uma perna de cada vez, com o joelho dobrando para trás', () => {
    const l = lunarGait(1.4)
    expect(l.hipL).toBeGreaterThan(0.2)
    expect(l.kneeL).toBeGreaterThan(l.hipL)
    expect(l.hipR).toBe(0)
    const r = lunarGait(3.6)
    expect(r.hipR).toBeGreaterThan(0.2)
    expect(r.hipL).toBe(0)
  })

  it('o ciclo se repete e nada é inválido', () => {
    for (let t = -20; t < 40; t += 0.37) {
      const g = lunarGait(t)
      for (const v of Object.values(g)) expect(Number.isFinite(v)).toBe(true)
      expect(g.lift).toBeGreaterThanOrEqual(0)
      expect(g.crouch).toBeGreaterThanOrEqual(0)
    }
    expect(lunarGait(1.4)).toEqual(lunarGait(12.4))
  })
})
