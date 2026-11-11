import { describe, expect, it } from 'vitest'
import { ASTRONAUTS } from './astronauts'
import { DEFAULT_SCENARIO, SCENARIOS, SCENARIO_IDS, canGo, linkText, profileOf, type ScenarioId } from './scenarios'
import { SYSTEM_IDS } from './systems'
import {
  CRUISE_DOSE_RATE, SUIT_SHIELD_FACTOR, astronautStatus, careerAtArrival, doseRate, exposure, missionLength, packetText, resolveMetric, systemActions, systemStatus,
} from '../lib/model'
import { useStore } from '../state/store'
import type { Sim } from '../types'

const sim = (scenario: ScenarioId | undefined, day: number, suit = false): Sim => ({ day, solar: false, suit, link: 'delayed', measurements: [], scenario })

describe('RF-33: os três lugares', () => {
  it('são o foguete, a estação espacial e a base lunar; o espaço profundo não é lugar, é a EVA da estação', () => {
    expect(SCENARIO_IDS).toEqual(['launch', 'station', 'lunar'])
    expect(SCENARIOS.station.eva).toMatchObject({ available: true, tethered: true, place: 'Deep space' })
    // O nome antigo do cruzeiro cai na estação
    expect(profileOf('deep')).toBe(SCENARIOS.station)
  })

  it('a estação é o cruzeiro a Marte original e continua o padrão, com a taxa medida pelo RAD e o dia 142', () => {
    expect(DEFAULT_SCENARIO).toBe('station')
    expect(SCENARIOS.station.defaultDay).toBe(142)
    expect(doseRate(sim(undefined, 142))).toBe(CRUISE_DOSE_RATE)
    expect(doseRate(sim('station', 142))).toBe(CRUISE_DOSE_RATE)
    expect(missionLength(sim(undefined, 142))).toBe(250)
  })

  it('cada lugar tem cenário 3D e postura próprios', () => {
    expect(SCENARIOS.launch).toMatchObject({ world: 'capsule', posture: 'supine' })
    expect(SCENARIOS.station).toMatchObject({ world: 'station', posture: 'standing' })
    expect(SCENARIOS.lunar).toMatchObject({ world: 'lunar', posture: 'lunar' })
  })

  it('cada lugar tem taxa de dose, gravidade e link próprios, e o traje multiplica a taxa do lugar', () => {
    for (const id of SCENARIO_IDS) {
      const p = SCENARIOS[id]
      expect(doseRate(sim(id, p.defaultDay))).toBe(p.dose.rate)
      expect(doseRate(sim(id, p.defaultDay, true))).toBe(p.dose.rate * SUIT_SHIELD_FACTOR)
      expect(p.dose.href).toMatch(/^https:\/\//)
    }
    expect(SCENARIOS.launch.gravity.g).toBe(1)
    expect(SCENARIOS.lunar.gravity.g).toBeCloseTo(1 / 6, 2)
    expect(SCENARIOS.station.gravity.g).toBe(0)
    expect(doseRate(sim('launch', 1))).toBeLessThan(doseRate(sim('lunar', 30)))
  })

  it('valor sem fonte publicada vem marcado como suposição, e a base lunar declara a grandeza da dose', () => {
    expect(SCENARIOS.lunar.dose.quantity).toBe('equivalent')
    expect(SCENARIOS.lunar.gravity.assumed).toBe(true)
    expect(SCENARIOS.station.dose.assumed).toBe(false)
  })

  it('só existem as transições lógicas: foguete → estação (missão a Marte) ou base lunar', () => {
    expect(canGo('launch', 'station')).toBe(true)
    expect(canGo('launch', 'lunar')).toBe(true)
    expect(canGo('station', 'launch')).toBe(false)
    expect(canGo('station', 'lunar')).toBe(false)
    expect(canGo('lunar', 'station')).toBe(false)
  })

  it('no foguete não há traje de EVA; na Lua o traje leva ao solo, sem cabo', () => {
    expect(SCENARIOS.launch.eva.available).toBe(false)
    expect(SCENARIOS.lunar.eva).toMatchObject({ available: true, tethered: false })
  })

  it('o texto do link muda por lugar e por estado', () => {
    expect(linkText('station', 'delayed')).toContain('21 min')
    expect(linkText('lunar', 'delayed')).toContain('1.3 s')
    expect(linkText('launch', 'blackout')).not.toBe(linkText('launch', 'delayed'))
  })

  it('a exposição e a projeção de dose seguem o lugar, e o traje troca o nome da exposição', () => {
    expect(exposure(sim('launch', 1)).label).toBe('Capsule')
    expect(exposure(sim('lunar', 30)).label).toBe('Base')
    expect(exposure(sim('lunar', 30, true)).label).toBe('EVA suit')
    expect(careerAtArrival(100, sim('lunar', 30))).toBeCloseTo(100 + 1.369 * 30, 5)
    expect(careerAtArrival(100, sim('station', 142))).toBeCloseTo(100 + 1.8 * 108, 5)
  })

  it('o motor calcula todos os sistemas em todos os lugares, sem valor inválido', () => {
    for (const id of SCENARIO_IDS) {
      const s = sim(id, SCENARIOS[id].defaultDay)
      for (const a of ASTRONAUTS) {
        expect(['nominal', 'watch', 'critical']).toContain(astronautStatus(a, s))
        for (const sys of SYSTEM_IDS) expect(['nominal', 'watch', 'critical']).toContain(systemStatus(a, sys, s))
        expect(Number.isFinite(resolveMetric(a, 'career_dose', s).value)).toBe(true)
      }
    }
  })

  it('o lugar avisa nas ações que o equipamento não comporta, sem trocar a ação do catálogo', () => {
    const st = sim('station', 142)
    const a = ASTRONAUTS.find((x) => systemStatus(x, 'muscular', st) !== 'nominal')!
    const station = systemActions(a, 'muscular', st)
    const rocket = systemActions(a, 'muscular', sim('launch', 142))
    expect(rocket.map((x) => x.id)).toEqual(station.map((x) => x.id))
    expect(rocket.some((x) => x.note)).toBe(true)
    expect(station.every((x) => !x.note || x.id === 'CMO-CONSULT')).toBe(true)
  })

  it('o pacote para o flight surgeon diz o lugar e o regime do link', () => {
    const a = ASTRONAUTS[0]
    expect(packetText(a, sim('lunar', 30), {}, [])).toContain('Scenario: Lunar base')
    expect(packetText(a, sim('lunar', 30), {}, [])).toContain('1.3 s')
    expect(packetText(a, sim('launch', 1), {}, [])).toContain('Launch day')
  })
})

describe('RF-33: transição no estado', () => {
  it('advance só aceita transições do perfil de origem, reinicia o relógio e tira o traje e o evento solar', () => {
    const st = useStore
    st.getState().setScenario('launch')
    expect(st.getState().day).toBe(1)
    st.getState().setSuit(true)
    expect(st.getState().suit).toBe(false)
    st.setState({ solar: true })
    expect(st.getState().advance('lunar')).toBe(true)
    expect(st.getState()).toMatchObject({ scenario: 'lunar', day: 1, solar: false, suit: false })
    st.getState().setSuit(true)
    expect(st.getState().suit).toBe(true)
    expect(st.getState().advance('station')).toBe(false)
    expect(st.getState().scenario).toBe('lunar')
    st.getState().setScenario('station')
    expect(st.getState()).toMatchObject({ scenario: 'station', day: 142, suit: false })
  })
})
