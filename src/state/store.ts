import { useMemo } from 'react'
import { create } from 'zustand'
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
}

const KEY = 'orbitalis.v1'

function load(): Persisted {
  const empty: Persisted = { measurements: [], diary: [], flags: {}, sent: {} }
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
  xray: boolean
  /** Camadas do atlas visíveis (esqueleto, músculos, órgãos, circulação, nervos); xray = há alguma ligada */
  layers: LayerId[]
  /** Camada sob o cursor no painel de camadas: ganha destaque e as outras esmaecem */
  hoverLayer: LayerId | null
  /** Sistema sob o cursor no corpo 3D (para o rótulo e o destaque) */
  hoverSys: SystemId | null
  /** Astronauta sob o cursor na formação da tripulação */
  hoverCrew: string | null
  menuOpen: boolean
  creditsOpen: boolean
  setDay: (d: number) => void
  setSolar: (v: boolean) => void
  setLink: (v: Sim['link']) => void
  setSuit: (v: boolean) => void
  setXray: (v: boolean) => void
  toggleLayer: (id: LayerId) => void
  setAllLayers: (on: boolean) => void
  setHoverLayer: (id: LayerId | null) => void
  setHoverSys: (s: SystemId | null) => void
  setHoverCrew: (id: string | null) => void
  setMenu: (v: boolean) => void
  setCredits: (v: boolean) => void
  addMeasurements: (list: Measurement[]) => void
  decide: (d: Omit<Decision, 'id' | 'ts' | 'missionDay' | 'linkState' | 'autonomous'>) => void
  toggleFlag: (key: string) => void
  sendPacket: (astroId: string) => void
  resetData: () => void
}

const persistedOf = (s: Store): Persisted => ({ measurements: s.measurements, diary: s.diary, flags: s.flags, sent: s.sent })

/** Parâmetros de URL para depurar e demonstrar: ?suit=1&xray=1&solar=1&day=200&link=blackout */
function urlFlags() {
  try {
    const q = new URLSearchParams(window.location.search)
    const day = Number(q.get('day'))
    const wanted = (q.get('layers') ?? '').split(',').filter((l): l is LayerId => (ATLAS_LAYERS as string[]).includes(l))
    const xray = q.get('xray') === '1' || wanted.length > 0
    return {
      suit: q.get('suit') === '1',
      xray,
      layers: wanted.length ? wanted : xray ? DEFAULT_LAYERS : [],
      solar: q.get('solar') === '1',
      link: q.get('link') === 'blackout' ? ('blackout' as const) : ('delayed' as const),
      day: Number.isFinite(day) && day >= 10 && day <= 250 ? day : MISSION_DAY,
    }
  } catch {
    return { suit: false, xray: false, layers: [] as LayerId[], solar: false, link: 'delayed' as const, day: MISSION_DAY }
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
    hoverCrew: null,
    menuOpen: false,
    creditsOpen: false,
    setDay: (day) => set({ day }),
    setSolar: (solar) => set({ solar }),
    setLink: (link) => set({ link }),
    // Com o traje fechado o raio-X não faz sentido (o corpo por dentro não acompanha o traje): vestir o desliga
    setSuit: (suit) => set(suit ? { suit, xray: false, layers: [] } : { suit }),
    setXray: (xray) => set((s) => ({ xray, layers: xray ? (s.layers.length ? s.layers : DEFAULT_LAYERS) : [] })),
    setAllLayers: (on) => set({ layers: on ? ATLAS_LAYERS : [], xray: on }),
    setHoverLayer: (hoverLayer) => set((s) => (s.hoverLayer === hoverLayer ? s : { hoverLayer })),
    toggleLayer: (id) =>
      set((s) => {
        const layers = s.layers.includes(id) ? s.layers.filter((l) => l !== id) : [...s.layers, id]
        return { layers, xray: layers.length > 0 }
      }),
    setHoverSys: (hoverSys) => set((s) => (s.hoverSys === hoverSys ? s : { hoverSys })),
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
    resetData: () => commit({ measurements: [], diary: [], flags: {}, sent: {} }),
  }
})

export const useSim = (): Sim => {
  const day = useStore((s) => s.day)
  const solar = useStore((s) => s.solar)
  const link = useStore((s) => s.link)
  const suit = useStore((s) => s.suit)
  const measurements = useStore((s) => s.measurements)
  return useMemo(() => ({ day, solar, suit, link, measurements }), [day, solar, suit, link, measurements])
}
