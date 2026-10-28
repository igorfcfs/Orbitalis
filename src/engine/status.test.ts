import { describe, expect, it } from 'vitest'
import { ASTRONAUTS } from '../data/astronauts'
import { RULES } from '../data/rules'
import { SYSTEM_IDS } from '../data/systems'
import {
  astronautStatus, getAstronaut, prioritySystem, resolveMetric, systemActions, systemStatus,
} from '../lib/model'
import type { Sim, Status, SystemId } from '../types'
import { evaluateMetric } from './status'
import { regress } from './projection'

const sim: Sim = { day: 142, solar: false, suit: false, link: 'delayed', measurements: [] }

const base = { baseline: 100, unit: '%', decimals: 1, day: 142, cadence: { mode: 'continuous' as const, step: 2, plausible: [0, 1000] as [number, number] } }
const line = (from: number, slope: number, n = 8) =>
  Array.from({ length: n }, (_, i) => ({ day: 142 - (n - 1 - i) * 2, value: from + slope * i * 2 }))

describe('regressão', () => {
  it('recupera a inclinação de uma reta', () => {
    expect(regress(line(10, 0.5)).slope).toBeCloseTo(0.5)
  })
})

describe('regra 1: métrica com requisito NASA', () => {
  const rule = { dir: 'min' as const, official: true, limit: 95, margin: 1 }
  it('CRITICAL se viola', () => {
    const pts = line(96, -0.05)
    expect(evaluateMetric(rule, { ...base, value: 94, points: pts }).status).toBe('critical')
  })
  it('WATCH se a projeção de 30 dias viola', () => {
    const pts = line(97, -0.08)
    const last = pts[pts.length - 1].value
    expect(evaluateMetric(rule, { ...base, value: last, points: pts }).status).toBe('watch')
  })
  it('WATCH se a folga é menor que a margem', () => {
    const pts = line(95.5, 0)
    expect(evaluateMetric(rule, { ...base, value: 95.5, points: pts }).status).toBe('watch')
  })
  it('NOMINAL com folga e projeção dentro', () => {
    const pts = line(98, 0)
    expect(evaluateMetric(rule, { ...base, value: 98, points: pts }).status).toBe('nominal')
  })
  it('limite máximo: dose perto do teto com projeção que estoura é WATCH', () => {
    const r = { dir: 'max' as const, official: true, limit: 600, margin: 30 }
    const pts = line(570, 1.8)
    const last = pts[pts.length - 1].value
    expect(evaluateMetric(r, { ...base, unit: 'mSv', value: last, points: pts }).status).toBe('watch')
  })
})

describe('regra 2: sem requisito NASA, faixas provisórias', () => {
  it('mínimo provisório', () => {
    const r = RULES.sleep.rule
    const e = (v: number) => evaluateMetric(r, { ...base, value: v, points: line(v, 0) }).status
    expect([e(7), e(6), e(5)]).toEqual(['nominal', 'watch', 'critical'])
  })
  it('faixa clínica', () => {
    const r = RULES.lymph.rule
    const e = (v: number) => evaluateMetric(r, { ...base, value: v, points: line(v, 0) }).status
    expect([e(1.9), e(0.9), e(0.3)]).toEqual(['nominal', 'watch', 'critical'])
  })
  it('desvio relativo à massa pré-voo', () => {
    const r = RULES.mass.rule
    const e = (v: number) => evaluateMetric(r, { ...base, baseline: 70, value: v, points: line(v, 0) }).status
    expect([e(68), e(65), e(60)]).toEqual(['nominal', 'watch', 'critical'])
  })
})

const byId = Object.fromEntries(ASTRONAUTS.map((a) => [a.id, a]))
const sys = (id: string, s: SystemId) => systemStatus(byId[id], s, sim)

describe('matriz esperada no dia 142', () => {
  const expected: Record<string, Partial<Record<SystemId, Status>>> = {
    lena: { radiation: 'watch' },
    rafael: { skeletal: 'watch', muscular: 'watch' },
    aiko: { behavior: 'critical', nutrition: 'watch' },
    daniel: { neuro_ocular: 'watch', immune: 'watch' },
  }
  for (const a of ASTRONAUTS) {
    it(`${a.name}`, () => {
      for (const s of SYSTEM_IDS) expect(sys(a.id, s), `${a.id}/${s}`).toBe(expected[a.id][s] ?? 'nominal')
    })
  }
})

describe('regras 3 a 7', () => {
  it('status do astronauta é o pior entre os sistemas', () => {
    expect(astronautStatus(byId.aiko, sim)).toBe('critical')
    expect(astronautStatus(byId.lena, sim)).toBe('watch')
  })
  it('ação prioritária vem do sistema de pior status, com desempate por ordem de risco', () => {
    expect(prioritySystem(byId.aiko, sim)).toBe('behavior')
    expect(prioritySystem(byId.daniel, sim)).toBe('neuro_ocular') // empate neuro_ocular × immune
    expect(prioritySystem(byId.rafael, sim)).toBe('skeletal') // empate skeletal × muscular
  })
  it('evento solar: radiação CRITICAL para todos e ação RAD-SHELTER', () => {
    const solar: Sim = { ...sim, solar: true }
    for (const a of ASTRONAUTS) {
      expect(systemStatus(a, 'radiation', solar)).toBe('critical')
      expect(prioritySystem(a, solar)).toBe('radiation')
      expect(systemActions(a, 'radiation', solar)[0].id).toBe('RAD-SHELTER')
    }
  })
  it('CMO com CRITICAL consulta o CMO reserva', () => {
    const actions = systemActions(getAstronaut('aiko'), 'behavior', sim)
    const consult = actions.find((x) => x.id === 'CMO-CONSULT')!
    expect(consult.label).toBe('Consult the backup CMO')
    expect(consult.note).toBeTruthy()
  })
  it('nominal não tem ação', () => {
    expect(systemActions(byId.lena, 'cardiovascular', sim)).toEqual([])
  })
})

describe('medição do astronauta recalcula o status', () => {
  it('lymphocytes normalizados saem de WATCH', () => {
    const s: Sim = { ...sim, measurements: [{ astronautId: 'daniel', metric: 'lymph', day: 142, value: 1.6, ts: '' }] }
    expect(resolveMetric(byId.daniel, 'lymph', s).status).toBe('nominal')
  })
})

describe('traje de EVA e dose de radiação', () => {
  const suited: Sim = { ...sim, suit: true }
  it('a taxa de dose sobe fora do casco e a projeção acompanha', async () => {
    const { doseRate, SUIT_SHIELD_FACTOR, CRUISE_DOSE_RATE } = await import('../lib/model')
    expect(doseRate(sim)).toBe(CRUISE_DOSE_RATE)
    expect(doseRate(suited)).toBe(CRUISE_DOSE_RATE * SUIT_SHIELD_FACTOR)
    const a = resolveMetric(byId.rafael, 'career_dose', sim)
    const b = resolveMetric(byId.rafael, 'career_dose', suited)
    expect(b.eval.projected!).toBeGreaterThan(a.eval.projected!)
    expect(b.eval.daysToLimit!).toBeLessThan(a.eval.daysToLimit!)
    expect(b.value).toBe(a.value) // o que já foi absorvido não muda
  })
  it('com o traje, quem já está perto do limite continua em WATCH', () => {
    expect(resolveMetric(byId.lena, 'career_dose', suited).status).toBe('watch')
  })
  it('o traje não altera métricas que não são de dose', () => {
    expect(resolveMetric(byId.aiko, 'sleep', suited).status).toBe(resolveMetric(byId.aiko, 'sleep', sim).status)
  })
})
