import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { clampInCabin } from './Places'

// Parede cônica da cabine (Places.tsx): raio 2,3 m no piso, 15° de inclinação, 3,05 m de altura
const wallR = (y: number) => 2.3 - Math.tan((15 * Math.PI) / 180) * y

describe('RF-33: a câmera do foguete não sai da cabine', () => {
  it('um ponto dentro da cabine não muda', () => {
    const p = new THREE.Vector3(0.6, 2.4, 0.9)
    expect(clampInCabin(p.clone()).distanceTo(p)).toBe(0)
  })

  it('a câmera recuada para fora volta para dentro da parede, do teto e do piso', () => {
    for (const p of [new THREE.Vector3(2.1, 4.6, 2.4), new THREE.Vector3(0, 1.6, 6.4), new THREE.Vector3(-3, -1, 0.5), new THREE.Vector3(0.2, 9, -0.1)]) {
      const q = clampInCabin(p.clone())
      expect(q.y).toBeGreaterThan(0.4)
      expect(q.y).toBeLessThan(3.05 - 0.1)
      expect(Math.hypot(q.x, q.z)).toBeLessThan(wallR(q.y) - 0.15)
    }
  })

  it('mantém a direção em volta do eixo da nave', () => {
    const q = clampInCabin(new THREE.Vector3(3, 2, 4))
    expect(Math.atan2(q.x, q.z)).toBeCloseTo(Math.atan2(3, 4), 6)
  })
})
