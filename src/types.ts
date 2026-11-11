import type { ScenarioId } from './data/scenarios'

export type Status = 'nominal' | 'watch' | 'critical'

export type SystemId =
  | 'cardiovascular'
  | 'skeletal'
  | 'muscular'
  | 'neuro_ocular'
  | 'immune'
  | 'nutrition'
  | 'behavior'
  | 'radiation'

export type Provenance = 'CONTINUOUS' | 'PERIODIC' | 'ESTIMATED' | 'LOGGED' | 'LIVE' | 'SAMPLE'

/** Os cinco riscos do voo espacial mapeados pelo Human Research Program da NASA */
export type Hazard = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment'

export interface Threshold {
  kind: 'nasa' | 'provisional' | 'clinical'
  /** ID do requisito NASA-STD-3001, quando oficial */
  id?: string
  text: string
  /** Linha de limite desenhada no gráfico */
  limit?: number
  /** Faixa desenhada no gráfico (clínica) */
  range?: [number, number]
}

/** Regra determinística de status de uma métrica (spec §6). */
export interface Rule {
  dir: 'min' | 'max' | 'range' | 'rel' | 'none'
  /** Requisito oficial: violar = CRITICAL; projeção ou folga curta = WATCH */
  official?: boolean
  limit?: number
  /** Folga mínima (requisito oficial) */
  margin?: number
  /** Provisório min/max: fronteira NOMINAL → WATCH */
  watch?: number
  /** Provisório min/max: fronteira WATCH → CRITICAL */
  crit?: number
  /** Faixa clínica e faixa crítica */
  range?: [number, number]
  critRange?: [number, number]
  /** Desvio relativo ao baseline (%) */
  relWatch?: number
  relCrit?: number
}

export interface Cadence {
  mode: 'continuous' | 'periodic'
  /** Continuous: dias entre pontos do gráfico. Periodic: dias entre coletas */
  step: number
  /** Agrupa métricas colhidas na mesma amostra */
  group?: string
  /** Faixa plausível para validar a entrada manual */
  plausible: [number, number]
}

export interface MetricDef {
  id: string
  system: SystemId
  label: string
  unit: string
  decimals: number
  baseline: number
  /** Valor típico no dia 142, quando o astronauta não tem override */
  typical: number
  provenance: Provenance
  threshold: Threshold
  rule: Rule
  cadence: Cadence
  instrument: string
  /** Onde o instrumento já voou */
  heritage: string
  how: string
  minutes: number
  why: string
  /** Linguagem simples, sem jargão */
  plain: string
}

export interface SystemDef {
  id: SystemId
  name: string
  region: string
  /** Para que serve o sistema, numa frase (o enunciado pede "função e status" de cada parte do corpo) */
  role: string
  /** Riscos do HRP que mais pesam sobre o sistema */
  hazards: Hazard[]
  mechanism: string
  evidence: string
  summary: Record<Status, string>
  actions: [string, string]
  /** Posição do hotspot quando o modelo ainda não carregou (altura 1.8, +z para a frente) */
  hotspot: [number, number, number]
  /** Deslocamento aplicado ao centro anatômico para separar hotspots vizinhos */
  hotspotOffset: [number, number, number]
  /** Alvo e distância da câmera ao focar o sistema */
  focus: { target: [number, number, number]; distance: number }
  metrics: string[]
}

export interface ActionDef {
  id: string
  label: string
  resource: string
  protocol: string
  minutes?: number
}

export interface MetricOverride {
  value?: number
  baseline?: number
  /** Valor inicial da série, quando difere do baseline */
  from?: number
  /** Dia da última coleta (métricas periódicas) */
  lastTaken?: number
}

/** Aparência do astronauta fictício (cores e corpo-base). */
export interface Look {
  skin: string
  hair: string
  eyes: string
  /** Corpo-base do atlas é masculino; 'female' aplica uma deformação de proporções. */
  build: 'male' | 'female'
  /** Cor de acento do uniforme (nunca verde, âmbar ou vermelho) */
  accent: string
}

export interface Astronaut {
  id: string
  initials: string
  name: string
  role: string
  isCMO?: boolean
  look: Look
  heightM: number
  headline: Record<Status, string>
  overrides: Record<string, MetricOverride>
}

export interface Measurement {
  astronautId: string
  metric: string
  day: number
  value: number
  ts: string
}

export interface Decision {
  id: string
  ts: string
  missionDay: number
  astronautId: string
  systemId: SystemId
  actionId: string
  decision: 'done' | 'snoozed'
  linkState: 'delayed' | 'blackout'
  statusSnapshot: Status
  autonomous: boolean
}

export interface Sim {
  day: number
  solar: boolean
  /** Traje de EVA vestido: fora do habitat, só o traje blinda */
  suit: boolean
  link: 'delayed' | 'blackout'
  measurements: Measurement[]
  /** Cenário da missão (RF-33); sem ele vale o cruzeiro a Marte, o padrão do projeto */
  scenario?: ScenarioId
}

export interface Point {
  day: number
  value: number
}

export interface Evaluation {
  status: Status
  /** Por que este status, em inglês simples, com números calculados */
  reason: string
  slope?: number
  projected?: number
  daysToLimit?: number | null
}

export interface ResolvedMetric extends MetricDef {
  value: number
  lastDay: number
  points: Point[]
  eval: Evaluation
  status: Status
  /** Taxa de dose atual (mSv/dia), só nas métricas de dose */
  rate?: number
}
