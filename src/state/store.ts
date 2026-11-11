import { useMemo } from 'react'
import { create } from 'zustand'
import { EMPTY_ANSWERS, type EmergencyAnswers, type EmergencySession } from '../engine/emergency'
import { DEFAULT_SCENARIO, SCENARIOS, SCENARIO_IDS, canGo, type ScenarioId } from '../data/scenarios'
import { MISSION_DAY } from '../lib/model'
import type { Decision, Measurement, Sim, SystemId } from '../types'

export type LayerId = 'skin' | 'muscles' | 'skeleton' | 'organs' | 'vessels' | 'nerves'

/** Os cinco sistemas do atlas, de fora para dentro. O raio-X liga todos; o painel de camadas liga e desliga cada um. */
export const ATLAS_LAYERS: LayerId[] = ['muscles', 'skeleton', 'organs', 'vessels', 'nerves']
export const DEFAULT_LAYERS: LayerId[] = ATLAS_LAYERS

interface Persisted {
  measurements: Measurement[]
  diary: Decision[]
  flags: Record<string, true>
  sent: Record<string, { ts: string; day: number; link: 'delayed' | 'blackout' }>
  /** Emergências abertas, uma por paciente (RF-29) */
  emergencies: Record<string, EmergencySession>
}

const KEY = 'orbitalis.v1'

function load(): Persisted {
  const empty: Persisted = { measurements: [], diary: [], flags: {}, sent: {}, emergencies: {} }
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? { ...empty, ...JSON.parse(raw) } : empty
  } catch {
    return empty
  }
}

function save(p: Persisted) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* sem armazenamento: o app continua em memória */
  }
}

interface Store extends Persisted {
  day: number
  solar: boolean
  link: 'delayed' | 'blackout'
  suit: boolean
  /** Cenário da missão (RF-33): foguete, estação espacial, base lunar ou espaço sideral */
  scenario: ScenarioId
  xray: boolean
  /** Camadas do atlas visíveis (esqueleto, músculos, órgãos, circulação, nervos); xray = há alguma ligada */
  layers: LayerId[]
  /** Camada sob o cursor no painel de camadas: ganha destaque e as outras esmaecem */
  hoverLayer: LayerId | null
  /** Sistema sob o cursor no corpo 3D (para o rótulo e o destaque) */
  hoverSys: SystemId | null
  /** Sistema sob o cursor (ou com foco) na lista ao lado do corpo: realça a região sem a dica do cursor */
  railSys: SystemId | null
  /** Astronauta sob o cursor na formação da tripulação */
  hoverCrew: string | null
  menuOpen: boolean
  creditsOpen: boolean
  /** A cena 3D não está disponível (sem WebGL, erro ou contexto perdido): a interface segue só com listas e painéis */
  sceneFailed: boolean
  setSceneFailed: (v: boolean) => void
  setDay: (d: number) => void
  setSolar: (v: boolean) => void
  setLink: (v: Sim['link']) => void
  setSuit: (v: boolean) => void
  /** Escolhe o cenário direto (simulação): dia padrão do cenário, sem traje nem evento solar */
  setScenario: (id: ScenarioId) => void
  /** Transição lógica entre cenários: só as que o perfil de origem lista. Devolve se aconteceu */
  advance: (to: ScenarioId) => boolean
  setXray: (v: boolean) => void
  toggleLayer: (id: LayerId) => void
  setAllLayers: (on: boolean) => void
  setHoverLayer: (id: LayerId | null) => void
  setHoverSys: (s: SystemId | null) => void
  setRailSys: (s: SystemId | null) => void
  setHoverCrew: (id: string | null) => void
  setMenu: (v: boolean) => void
  setCredits: (v: boolean) => void
  addMeasurements: (list: Measurement[]) => void
  decide: (d: Omit<Decision, 'id' | 'ts' | 'missionDay' | 'linkState' | 'autonomous'>) => void
  toggleFlag: (key: string) => void
  sendPacket: (astroId: string) => void
  resetData: () => void
  openEmergency: (patientId: string) => void
  answerEmergency: (patientId: string, patch: Partial<EmergencyAnswers>, reporterId?: string | null) => void
  doneEmergencyStep: (patientId: string, actionId: string) => void
  closeEmergency: (patientId: string) => void
}

const persistedOf = (s: Store): Persisted => ({ measurements: s.measurements, diary: s.diary, flags: s.flags, sent: s.sent, emergencies: s.emergencies })

/**
 * O raio-X não existe com o traje de EVA vestido, em nenhum lugar (o corpo por dentro não acompanha o traje): decisão do dono
 * do produto, 10/11/2026. No foguete ele vale (revisto pelo dono em 11/11): a anatomia acompanha o corpo deitado no assento.
 */
export const xrayAllowed = (suit: boolean) => !suit

/** Parâmetros de URL para depurar e demonstrar: ?suit=1&xray=1&solar=1&day=200&link=blackout */
function urlFlags() {
  try {
    const q = new URLSearchParams(window.location.search)
    // `deep` era o nome do cruzeiro antes de virar a estação espacial; o espaço profundo agora é a EVA da estação
    const asked = q.get('scenario')
    const scenario: ScenarioId = asked === 'deep' ? 'station' : asked && (SCENARIO_IDS as string[]).includes(asked) ? (asked as ScenarioId) : DEFAULT_SCENARIO
    const prof = SCENARIOS[scenario]
    const day = Number(q.get('day'))
    const wanted = (q.get('layers') ?? '').split(',').filter((l): l is LayerId => (ATLAS_LAYERS as string[]).includes(l))
    const suit = q.get('suit') === '1' && prof.eva.available
    const xray = (q.get('xray') === '1' || wanted.length > 0) && xrayAllowed(suit)
    return {
      suit,
      scenario,
      xray,
      layers: !xray ? [] : wanted.length ? wanted : DEFAULT_LAYERS,
      solar: q.get('solar') === '1',
      link: q.get('link') === 'blackout' ? ('blackout' as const) : ('delayed' as const),
      day: Number.isFinite(day) && day >= prof.minDay && day <= prof.length ? Math.round(day) : prof.defaultDay,
    }
  } catch {
    return { suit: false, scenario: DEFAULT_SCENARIO, xray: false, layers: [] as LayerId[], solar: false, link: 'delayed' as const, day: MISSION_DAY }
  }
}

export const useStore = create<Store>((set, get) => {
  const commit = (patch: Partial<Persisted>) => {
    set(patch)
    save(persistedOf(get()))
  }
  return {
    ...load(),
    ...urlFlags(),
    hoverLayer: null,
    hoverSys: null,
    railSys: null,
    hoverCrew: null,
    menuOpen: false,
    creditsOpen: false,
    sceneFailed: false,
    setSceneFailed: (sceneFailed) => set({ sceneFailed }),
    setDay: (day) => set({ day }),
    setSolar: (solar) => set({ solar }),
    setLink: (link) => set({ link }),
    // Com o traje fechado o raio-X não faz sentido (o corpo por dentro não acompanha o traje): vestir o desliga
    setSuit: (suit) => set((s) => (suit ? (SCENARIOS[s.scenario].eva.available ? { suit, xray: false, layers: [] } : {}) : { suit })),
    setScenario: (scenario) => set(() => ({ scenario, day: SCENARIOS[scenario].defaultDay, suit: false, solar: false })),
    advance: (to) => {
      const s = get()
      if (!canGo(s.scenario, to)) return false
      // Cada fase tem o próprio relógio: a próxima começa no dia de entrada dela, sem traje e sem evento solar
      set({ scenario: to, day: SCENARIOS[to].enterDay, suit: false, solar: false })
      return true
    },
    setXray: (xray) => set((s) => (xray && !xrayAllowed(s.suit) ? {} : { xray, layers: xray ? (s.layers.length ? s.layers : DEFAULT_LAYERS) : [] })),
    setAllLayers: (on) => set((s) => (on && !xrayAllowed(s.suit) ? {} : { layers: on ? ATLAS_LAYERS : [], xray: on })),
    setHoverLayer: (hoverLayer) => set((s) => (s.hoverLayer === hoverLayer ? s : { hoverLayer })),
    toggleLayer: (id) =>
      set((s) => {
        if (!s.layers.includes(id) && !xrayAllowed(s.suit)) return {}
        const layers = s.layers.includes(id) ? s.layers.filter((l) => l !== id) : [...s.layers, id]
        return { layers, xray: layers.length > 0 }
      }),
    setHoverSys: (hoverSys) => set((s) => (s.hoverSys === hoverSys ? s : { hoverSys })),
    setRailSys: (railSys) => set((s) => (s.railSys === railSys ? s : { railSys })),
    setHoverCrew: (hoverCrew) => set((s) => (s.hoverCrew === hoverCrew ? s : { hoverCrew })),
    setMenu: (menuOpen) => set({ menuOpen }),
    setCredits: (creditsOpen) => set({ creditsOpen }),
    addMeasurements: (list) => commit({ measurements: [...get().measurements, ...list] }),
    decide: (d) => {
      const s = get()
      const entry: Decision = {
        ...d,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ts: new Date().toISOString(),
        missionDay: s.day,
        linkState: s.link,
        autonomous: s.link === 'blackout',
      }
      commit({ diary: [...s.diary, entry] })
    },
    toggleFlag: (key) => {
      const flags = { ...get().flags }
      if (flags[key]) delete flags[key]
      else flags[key] = true
      commit({ flags })
    },
    sendPacket: (astroId) => {
      const s = get()
      commit({ sent: { ...s.sent, [astroId]: { ts: new Date().toISOString(), day: s.day, link: s.link } } })
    },
    resetData: () => commit({ measurements: [], diary: [], flags: {}, sent: {}, emergencies: {} }),
    openEmergency: (patientId) => {
      const s = get()
      if (s.emergencies[patientId]) return
      const session: EmergencySession = {
        patientId, reporterId: null, answers: { ...EMPTY_ANSWERS }, startedTs: new Date().toISOString(), startedDay: s.day, link: s.link, done: {},
      }
      commit({ emergencies: { ...s.emergencies, [patientId]: session } })
    },
    answerEmergency: (patientId, patch, reporterId) => {
      const s = get()
      const cur = s.emergencies[patientId]
      if (!cur) return
      const answers = { ...cur.answers, ...patch }
      // Mudou a resposta que decide a categoria: os passos já marcados valem para a categoria anterior e saem
      const decisive = (['responds', 'breathing', 'collapsed', 'prior'] as const).some((k) => k in patch && patch[k] !== cur.answers[k])
      commit({ emergencies: { ...s.emergencies, [patientId]: { ...cur, answers, reporterId: reporterId === undefined ? cur.reporterId : reporterId, done: decisive ? {} : cur.done } } })
    },
    doneEmergencyStep: (patientId, actionId) => {
      const s = get()
      const cur = s.emergencies[patientId]
      if (!cur || cur.done[actionId]) return
      const done = { ...cur.done, [actionId]: { ts: new Date().toISOString(), day: s.day, autonomous: s.link === 'blackout' } }
      commit({ emergencies: { ...s.emergencies, [patientId]: { ...cur, done } } })
    },
    closeEmergency: (patientId) => {
      const { [patientId]: _gone, ...rest } = get().emergencies
      commit({ emergencies: rest })
    },
  }
})

export const useSim = (): Sim => {
  const day = useStore((s) => s.day)
  const solar = useStore((s) => s.solar)
  const link = useStore((s) => s.link)
  const suit = useStore((s) => s.suit)
  const scenario = useStore((s) => s.scenario)
  const measurements = useStore((s) => s.measurements)
  return useMemo(() => ({ day, solar, suit, link, measurements, scenario }), [day, solar, suit, link, measurements, scenario])
}
