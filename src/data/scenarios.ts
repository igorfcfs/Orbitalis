/**
 * RF-33: os três lugares da missão. Cada um é um perfil com o que muda no corpo e no entorno: gravidade, taxa de dose
 * (com grandeza e fonte), regime do link, duração, evacuação, o traje de EVA, a postura dos astronautas e o cenário 3D.
 *
 * - Foguete: na plataforma de lançamento na Terra, com o foguete de pé. A tripulação vai deitada de costas nos assentos da
 *   cápsula, presa pelos cintos, com quadril e joelhos a 90° e o rosto voltado para o painel (como na Crew Dragon e na Soyuz).
 * - Estação espacial: a nave do cruzeiro a Marte (o cenário original). Com o traje de EVA, o astronauta sai para o espaço
 *   profundo, flutuando preso à estação pelo cabo; ao tirar o traje, volta para dentro. "Espaço sideral" não é outro lugar.
 * - Base lunar: em terra firme na Lua, com 1/6 g; com o traje, o astronauta caminha no solo lá fora.
 *
 * O motor de status não conhece cenário: só a taxa de dose e a duração entram nas projeções.
 * Valor sem fonte publicada fica marcado `assumed` e a interface diz isso.
 */

export type ScenarioId = 'launch' | 'station' | 'lunar'

export const SCENARIO_IDS: ScenarioId[] = ['launch', 'station', 'lunar']
export const DEFAULT_SCENARIO: ScenarioId = 'station'

/** Como o corpo se comporta: deitado de costas no assento, de pé no piso da estação ou de pé em 1/6 g (passos lentos e saltos) */
export type Posture = 'supine' | 'standing' | 'lunar'

export interface ScenarioProfile {
  id: ScenarioId
  name: string
  /** Rótulo curto para a barra superior */
  short: string
  /** Onde o astronauta está, numa frase */
  place: string
  /** Duração da fase em dias (o foguete é a fase de lançamento, de 1 dia) */
  length: number
  /** Dia mostrado ao chegar por uma transição */
  enterDay: number
  /** Dia padrão ao escolher o cenário direto (a estação mantém o dia 142 da matriz de status testada) */
  defaultDay: number
  minDay: number
  /** Nome do tempo da fase na barra superior (o lançamento não conta dias) */
  clock: 'day' | 'launch'
  /** Cenário 3D */
  world: 'capsule' | 'station' | 'lunar'
  posture: Posture
  gravity: { g: number; label: string; detail: string; assumed: boolean }
  dose: {
    /** mSv/dia dentro da estrutura (ou na superfície, na base lunar) */
    rate: number
    quantity: 'effective' | 'equivalent'
    source: string
    href: string
    provenance: 'CONTINUOUS' | 'ESTIMATED'
    assumed: boolean
    note: string
  }
  link: {
    /** Atraso de ida em segundos; 0 = contínuo */
    delaySec: number
    delayText: string
    blackoutText: string
    note: string
  }
  evacuation: { available: boolean; text: string }
  /** O traje de EVA e para onde ele leva */
  eva: { available: boolean; tethered: boolean; place: string; note: string }
  /** Nome da exposição sem o traje, para o cartão da radiação */
  inside: string
  /** Para onde dá para ir a partir daqui, com o que a transição significa */
  next: { to: ScenarioId; label: string }[]
  /** Ações do catálogo que o lugar não comporta (id → motivo). O catálogo continua o mesmo: só aparece o aviso */
  actionNotes: Record<string, string>
  summary: string
}

const NO_GYM = 'No exercise hardware in the capsule. It waits until you reach the station or the base.'

export const SCENARIOS: Record<ScenarioId, ScenarioProfile> = {
  launch: {
    id: 'launch',
    name: 'Rocket',
    short: 'Rocket',
    place: 'Crew capsule on the launch pad, on Earth',
    length: 1,
    enterDay: 1,
    defaultDay: 1,
    minDay: 1,
    clock: 'launch',
    world: 'capsule',
    posture: 'supine',
    gravity: { g: 1, label: '1 g', detail: 'Earth gravity on the pad. The rocket stands upright, so you lie on your back, strapped in. Ascent adds several g for a few minutes, chest to back.', assumed: false },
    dose: {
      rate: 0.0066,
      quantity: 'effective',
      source: 'Worldwide average natural background on Earth, about 2.4 mSv per year (UNSCEAR)',
      href: 'https://www.unscear.org/',
      provenance: 'ESTIMATED',
      assumed: false,
      note: 'The atmosphere and the magnetic field still shield you. The ascent itself takes minutes.',
    },
    link: {
      delaySec: 0,
      delayText: 'Mission control, continuous',
      blackoutText: 'Loss of signal',
      note: 'Voice and data stay with mission control until orbit.',
    },
    evacuation: { available: true, text: 'On the pad the crew can leave the vehicle. In flight, the launch abort system is a vehicle function, not this app.' },
    eva: { available: false, tethered: false, place: '', note: 'No spacewalk from the capsule.' },
    inside: 'Capsule',
    next: [
      { to: 'station', label: 'Launch to the space station (Mars mission)' },
      { to: 'lunar', label: 'Launch to the lunar base' },
    ],
    actionNotes: { 'EX-RES': NO_GYM, 'EX-AER': NO_GYM, 'EX-PLAN': NO_GYM, 'IMM-SAMPLE': 'Blood sampling waits until you arrive.', 'NUT-MASS': 'Body mass is measured on board after arrival.' },
    summary: 'Lying on your back and strapped in before launch. Only the worn sensors and the emergency flow apply.',
  },
  station: {
    id: 'station',
    name: 'Space station',
    short: 'Station',
    place: 'Station on the cruise from Earth to Mars',
    length: 250,
    enterDay: 1,
    defaultDay: 142,
    minDay: 1,
    clock: 'day',
    world: 'station',
    posture: 'standing',
    gravity: { g: 0, label: 'Microgravity', detail: 'Free fall for the whole cruise. Inside, you hold on with foot restraints.', assumed: false },
    dose: {
      rate: 1.8,
      quantity: 'effective',
      source: 'Cruise dose measured by the RAD instrument on the Mars Science Laboratory',
      href: 'https://www.swri.org/newsroom/press-releases/swri-led-team-calculates-the-radiation-exposure-associated-trip-mars',
      provenance: 'CONTINUOUS',
      assumed: false,
      note: 'Inside the hull. Outside it, only the suit shields you.',
    },
    link: {
      delaySec: 21 * 60,
      delayText: 'Earth 21 min each way',
      blackoutText: 'Blackout (conjunction)',
      note: 'The reply to any message takes about 40 minutes, and a conjunction blackout lasts weeks.',
    },
    evacuation: { available: false, text: 'No evacuation during the cruise. The crew treats and decides on board.' },
    eva: { available: true, tethered: true, place: 'Deep space', note: 'Deep space: you float outside, tethered to the station. Take the suit off to come back in.' },
    inside: 'Station',
    next: [],
    actionNotes: {},
    summary: 'About 250 days from Earth to Mars, with a delayed link and no way home.',
  },
  lunar: {
    id: 'lunar',
    name: 'Lunar base',
    short: 'Moon',
    place: 'Base on the lunar surface',
    length: 60,
    enterDay: 1,
    defaultDay: 30,
    minDay: 1,
    clock: 'day',
    world: 'lunar',
    posture: 'lunar',
    gravity: { g: 0.166, label: '1/6 g', detail: 'Lunar surface gravity, 1.62 m/s². The musculoskeletal loss rate at this gravity is not published, so the series keep the microgravity model.', assumed: true },
    dose: {
      rate: 1.369,
      quantity: 'equivalent',
      source: 'Chang’E-4 lander neutron and dose detector on the lunar far side (Zhang et al., 2020)',
      href: 'https://doi.org/10.1126/sciadv.aaz1334',
      provenance: 'ESTIMATED',
      assumed: false,
      note: 'Dose equivalent measured on the surface, while the NASA career limit is an effective dose. Shielding inside the base is not published, so none is subtracted.',
    },
    link: {
      delaySec: 1.3,
      delayText: 'Earth 1.3 s each way',
      blackoutText: 'No line of sight without a relay (far side)',
      note: 'A call is almost real time, but the far side has no view of Earth without a relay.',
    },
    evacuation: { available: true, text: 'Return to Earth takes days, so treat the first hours as autonomous.' },
    eva: { available: true, tethered: false, place: 'Lunar surface', note: 'Surface walk in 1/6 g, boots on the regolith.' },
    inside: 'Base',
    next: [],
    actionNotes: {
      'EX-RES': 'ARED is a station device; the base’s exercise kit is not defined in this prototype.',
      'EX-AER': 'T2 and CEVIS are station devices; the base’s exercise kit is not defined in this prototype.',
    },
    summary: 'Weeks on firm ground in 1/6 g, with a nearly real-time link to Earth.',
  },
}

/** Aceita o nome antigo `deep` (o cruzeiro, antes de virar a estação) para links e dados salvos */
export const profileOf = (id: ScenarioId | 'deep' | undefined): ScenarioProfile => SCENARIOS[id === 'deep' || !id ? DEFAULT_SCENARIO : id]

/** Texto do atraso do link no cenário (o app funciona por inteiro a bordo, com ou sem a Terra) */
export function linkText(id: ScenarioId | undefined, state: 'delayed' | 'blackout'): string {
  const p = profileOf(id)
  return state === 'blackout' ? p.link.blackoutText : p.link.delayText
}

/** A transição só existe quando o perfil de origem a lista: foguete → estação ou base lunar. */
export const canGo = (from: ScenarioId, to: ScenarioId) => SCENARIOS[from].next.some((n) => n.to === to)
