import { describe, expect, it } from 'vitest'
import { ASTRONAUTS } from '../data/astronauts'
import type { Sim } from '../types'
import { MISSION_DAY, getAstronaut, physique } from './model'

const sim = (day: number): Sim => ({ day, solar: false, suit: false, link: 'delayed', measurements: [] })

describe('físico do astronauta (só desenho 3D, nunca status)', () => {
  it('no início da missão ninguém mostra atrofia, fadiga nem variação de massa', () => {
    for (const a of ASTRONAUTS) {
      const p = physique(a, sim(10))
      expect(p.atrophy).toBeLessThan(0.06)
      expect(p.fatigue).toBeLessThan(0.06)
      expect(Math.abs(p.mass)).toBeLessThan(0.02)
    }
  })

  it('no dia 142, quem treinou menos mostra mais atrofia', () => {
    const rafael = physique(getAstronaut('rafael'), sim(MISSION_DAY))
    const others = ['lena', 'aiko', 'daniel'].map((id) => physique(getAstronaut(id), sim(MISSION_DAY)).atrophy)
    expect(rafael.atrophy).toBeGreaterThan(0.4)
    for (const o of others) expect(rafael.atrophy).toBeGreaterThan(o)
  })

  it('o sono curto da CMO aparece como fadiga', () => {
    const aiko = physique(getAstronaut('aiko'), sim(MISSION_DAY))
    expect(aiko.fatigue).toBeGreaterThan(0.4)
    for (const id of ['lena', 'rafael', 'daniel']) expect(physique(getAstronaut(id), sim(MISSION_DAY)).fatigue).toBeLessThan(aiko.fatigue)
  })

  it('a perda de massa registrada vira variação negativa, limitada a ±12%', () => {
    for (const a of ASTRONAUTS) {
      const p = physique(a, sim(MISSION_DAY))
      expect(p.mass).toBeLessThan(0)
      expect(p.mass).toBeGreaterThanOrEqual(-0.12)
    }
  })

  it('os valores ficam sempre dentro das faixas', () => {
    for (const a of ASTRONAUTS) {
      for (const d of [10, 60, 142, 200, 250]) {
        const p = physique(a, sim(d))
        expect(p.atrophy).toBeGreaterThanOrEqual(0)
        expect(p.atrophy).toBeLessThanOrEqual(1)
        expect(p.fatigue).toBeGreaterThanOrEqual(0)
        expect(p.fatigue).toBeLessThanOrEqual(1)
        expect(Math.abs(p.mass)).toBeLessThanOrEqual(0.12)
      }
    }
  })
})
