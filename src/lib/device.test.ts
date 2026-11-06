import { describe, expect, it } from 'vitest'
import { METRICS } from '../data/systems'
import { deviceLine } from './device'

describe('RF-32 · dispositivo de medição', () => {
  const all = Object.values(METRICS)

  it('toda métrica tem um aparelho ou uma origem declarada', () => {
    for (const m of all) expect(deviceLine(m).length, m.id).toBeGreaterThan(3)
  })

  it('vo2, strength e acuity citam um aparelho específico, não o grupo', () => {
    expect(METRICS.vo2.instrument).toContain('CEVIS')
    expect(METRICS.strength.instrument).toContain('ARED')
    expect(METRICS.strength.instrument).not.toContain('CEVIS')
    expect(METRICS.acuity.instrument).not.toContain('OCT')
  })

  it('o que é estimado diz que nada mede a bordo, sem inventar instrumento', () => {
    expect(deviceLine(METRICS.bmd)).toMatch(/Not measured on board/)
    expect(deviceLine(METRICS.fn)).toMatch(/Not measured on board/)
  })

  it('sensor vestível diz que é automático', () => {
    expect(deviceLine(METRICS.rhr)).toMatch(/automatic/)
  })
})
