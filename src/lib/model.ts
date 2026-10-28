import { ACTIONS } from '../data/actions'
import { ASTRONAUTS } from '../data/astronauts'
import { NOISE } from '../data/rules'
import { METRICS, PRIORITY_ORDER, SYSTEMS, SYSTEM_IDS } from '../data/systems'
import { evaluateMetric, worst } from '../engine/status'
import { regress, projectionWindow } from '../engine/projection'
import type {
  ActionDef, Astronaut, Decision, MetricDef, Point, ResolvedMetric, Sim, Status, SystemId,
} from '../types'
import { fmt, shortUnit, signed } from './format'

export { fmt, worst }

export const MISSION_DAY = 142
export const MISSION_LENGTH = 250
export const LINK_DELAY_MIN = 21
/** Dose de cruzeiro medida pelo RAD no MSL (mSv/dia) */
export const CRUISE_DOSE_RATE = 1.8
export const SOLAR_FLUX = 1240
/**
 * Fator de blindagem do traje de EVA: fora do casco, só o traje blinda, então a taxa sobe.
 * ASSUNÇÃO DO PROTÓTIPO, sem fonte publicada: substituir pela dosimetria real da missão.
 */
export const SUIT_SHIELD_FACTOR = 2
const DOSE_METRICS = new Set(['mission_dose', 'career_dose'])

/** Taxa de dose da exposição atual (mSv/dia): casco do habitat (medida) ou só o traje (estimada). */
export const doseRate = (sim: Pick<Sim, 'suit'>) => CRUISE_DOSE_RATE * (sim.suit ? SUIT_SHIELD_FACTOR : 1)

export interface Exposure {
  label: string
  rate: number
  provenance: 'CONTINUOUS' | 'ESTIMATED'
  shielding: string
}

export function exposure(sim: Pick<Sim, 'suit'>): Exposure {
  return sim.suit
    ? { label: 'EVA suit', rate: doseRate(sim), provenance: 'ESTIMATED', shielding: 'Outside the hull. Only the suit shields you.' }
    : { label: 'Habitat', rate: doseRate(sim), provenance: 'CONTINUOUS', shielding: 'Inside the hull. The structure shields you.' }
}

/** Dose de carreira projetada para o fim da missão, mantida a exposição atual. */
export function careerAtArrival(value: number, sim: Pick<Sim, 'suit' | 'day'>) {
  return value + doseRate(sim) * Math.max(0, MISSION_LENGTH - sim.day)
}

export const getAstronaut = (id: string) => ASTRONAUTS.find((a) => a.id === id)!

export const STATUS_LABEL: Record<Status, string> = { nominal: 'NOMINAL', watch: 'WATCH', critical: 'CRITICAL' }
export const STATUS_GLYPH: Record<Status, string> = { nominal: '●', watch: '▲', critical: '◆' }

// ---------- Séries sintéticas, determinísticas por (astronauta, métrica, dia) ----------

function mulberry32(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)

/** Dia da última coleta no dia 142 (âncora da série periódica). */
function anchorDay(astro: Astronaut, def: MetricDef): number {
  if (def.cadence.mode === 'continuous') return MISSION_DAY
  const o = astro.overrides[def.id]
  if (o?.lastTaken !== undefined) return o.lastTaken
  const r = mulberry32(hash(astro.id + def.id))()
  return MISSION_DAY - Math.round(def.cadence.step * (0.15 + 0.6 * r))
}

function buildPoints(astro: Astronaut, def: MetricDef, sim: Sim): Point[] {
  const o = astro.overrides[def.id]
  const baseline = o?.baseline ?? def.baseline
  const target = o?.value ?? def.typical
  const from = o?.from ?? baseline
  const periodic = def.cadence.mode === 'periodic'
  const A = anchorDay(astro, def)
  const trend = (d: number) => from + ((target - from) * d) / A
  const amp = NOISE[def.id] ?? 0
  const seed = hash(`${astro.id}:${def.id}`)
  const noise = (d: number) => (mulberry32(seed + d * 7919)() - 0.5) * 2 * amp

  const days: number[] = [0]
  if (periodic) {
    for (let d = A; d > 0; d -= def.cadence.step) if (d <= sim.day) days.push(d)
  } else {
    for (let d = def.cadence.step; d < sim.day; d += def.cadence.step) days.push(d)
    if (sim.day > 0) days.push(sim.day)
  }
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  const last = sorted[sorted.length - 1]
  const pts: Point[] = sorted.map((d) => {
    if (def.id === 'space_weather') {
      const r = mulberry32(seed + d * 31)()
      return { day: d, value: d === last ? target : 0.1 + r * 0.5 + (r > 0.96 ? r * 2 : 0) }
    }
    if (d === 0) return { day: 0, value: from }
    return { day: d, value: trend(d) + (d === last ? 0 : noise(d)) }
  })

  for (const m of sim.measurements) {
    if (m.astronautId !== astro.id || m.metric !== def.id || m.day > sim.day) continue
    const i = pts.findIndex((p) => p.day === m.day)
    if (i >= 0) pts[i] = { day: m.day, value: m.value }
    else pts.push({ day: m.day, value: m.value })
  }
  pts.sort((a, b) => a.day - b.day)
  if (sim.solar && def.id === 'space_weather') {
    const lastPt = pts[pts.length - 1]
    pts[pts.length - 1] = { day: lastPt.day, value: SOLAR_FLUX }
  }
  return pts
}

const cache = new Map<string, ResolvedMetric>()

export function resolveMetric(astro: Astronaut, metricId: string, sim: Sim): ResolvedMetric {
  const def = METRICS[metricId]
  const nMeas = sim.measurements.reduce((n, m) => (m.astronautId === astro.id && m.metric === metricId ? n + 1 : n), 0)
  const isDose = DOSE_METRICS.has(metricId)
  const key = `${astro.id}:${metricId}:${sim.day}:${sim.solar}:${nMeas}:${isDose && sim.suit ? 'suit' : ''}`
  const hit = cache.get(key)
  if (hit) return hit
  if (cache.size > 4000) cache.clear()
  const points = buildPoints(astro, def, sim)
  const lastPt = points[points.length - 1]
  const baseline = astro.overrides[metricId]?.baseline ?? def.baseline
  const rate = isDose ? doseRate(sim) : undefined
  const evaluation = evaluateMetric(def.rule, {
    value: lastPt.value, baseline, unit: shortUnit(def.unit), decimals: def.decimals, points, day: sim.day, cadence: def.cadence, rate,
  })
  const r: ResolvedMetric = {
    ...def, baseline, value: lastPt.value, lastDay: lastPt.day, points, eval: evaluation, status: evaluation.status, rate,
  }
  cache.set(key, r)
  return r
}

export const systemMetrics = (astro: Astronaut, system: SystemId, sim: Sim) =>
  SYSTEMS[system].metrics.map((m) => resolveMetric(astro, m, sim))

export const systemStatus = (astro: Astronaut, system: SystemId, sim: Sim): Status =>
  worst(systemMetrics(astro, system, sim).map((m) => m.status))

export const astronautStatus = (astro: Astronaut, sim: Sim): Status =>
  worst(SYSTEM_IDS.map((s) => systemStatus(astro, s, sim)))

/** Sistema de pior status; desempate pela ordem de risco. Nenhum → sem ação. */
export function prioritySystem(astro: Astronaut, sim: Sim): SystemId | null {
  const rank: Record<Status, number> = { nominal: 0, watch: 1, critical: 2 }
  let best: SystemId | null = null
  let bestRank = 0
  for (const s of PRIORITY_ORDER) {
    const r = rank[systemStatus(astro, s, sim)]
    if (r > bestRank) {
      best = s
      bestRank = r
    }
  }
  return best
}

export function headline(astro: Astronaut, sim: Sim): string {
  if (sim.solar) return 'Solar particle event under way. Move to the storm shelter.'
  const status = astronautStatus(astro, sim)
  if (sim.day === MISSION_DAY && sim.measurements.length === 0) return astro.headline[status]
  const s = prioritySystem(astro, sim)
  return s ? SYSTEMS[s].summary[systemStatus(astro, s, sim)] : 'All systems on baseline.'
}

export interface ActionView extends ActionDef {
  note?: string
  systemId: SystemId
}

/** Até 2 ações do sistema; nada quando nominal. Evento solar → RAD-SHELTER. CMO em CRITICAL → reserva. */
export function systemActions(astro: Astronaut, system: SystemId, sim: Sim): ActionView[] {
  const status = systemStatus(astro, system, sim)
  if (status === 'nominal') return []
  const [primary, second] = SYSTEMS[system].actions
  const primaryId = sim.solar && system === 'radiation' ? 'RAD-SHELTER' : primary
  const secondId = status === 'critical' ? 'CMO-CONSULT' : second
  const list: ActionView[] = [ACTIONS[primaryId], ACTIONS[secondId]].map((a) => ({ ...a, systemId: system }))
  if (astro.isCMO) {
    const consult = list.find((a) => a.id === 'CMO-CONSULT')
    if (consult) {
      consult.label = 'Consult the backup CMO'
      consult.note = 'You are the Crew Medical Officer, so the consult goes to the backup CMO.'
    }
  }
  return list
}

export function priorityAction(astro: Astronaut, sim: Sim) {
  const s = prioritySystem(astro, sim)
  return s ? { system: s, action: systemActions(astro, s, sim)[0] } : null
}

// ---------- Estatísticas ----------

export interface Stats {
  mean: number
  min: number
  max: number
  slope: number
  deltaAbs: number
  deltaPct: number | null
  window: Point[]
}

export function metricStats(m: ResolvedMetric): Stats {
  const window = projectionWindow(m.points, m.cadence.mode)
  const vals = window.map((p) => p.value)
  const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1)
  return {
    mean,
    min: Math.min(...vals),
    max: Math.max(...vals),
    slope: regress(window).slope,
    deltaAbs: m.value - m.baseline,
    deltaPct: m.baseline === 0 ? null : ((m.value - m.baseline) / Math.abs(m.baseline)) * 100,
    window,
  }
}

/** Altura estimada: alongamento da coluna, teto de 3% (NTRS 20090007782). */
export function estimatedHeight(astro: Astronaut, day: number) {
  const growth = 0.03 * (1 - Math.exp(-day / 20))
  return { baseline: astro.heightM, value: astro.heightM * (1 + growth), pct: growth * 100 }
}

// ---------- Fila de medições (RF-04) ----------

export const isLoggable = (def: MetricDef) => def.provenance === 'PERIODIC' || def.provenance === 'LOGGED'

export interface QueueItem {
  key: string
  title: string
  metrics: ResolvedMetric[]
  lastDay: number
  overdueDays: number
}

export function dueItems(astro: Astronaut, sim: Sim): QueueItem[] {
  const groups = new Map<string, ResolvedMetric[]>()
  for (const id of Object.keys(METRICS)) {
    const def = METRICS[id]
    if (def.cadence.mode !== 'periodic' || !isLoggable(def)) continue
    const m = resolveMetric(astro, id, sim)
    if (sim.day - m.lastDay < def.cadence.step) continue
    const key = def.cadence.group ?? id
    groups.set(key, [...(groups.get(key) ?? []), m])
  }
  return [...groups.entries()]
    .map(([key, metrics]) => ({
      key,
      title: key === 'blood' ? 'Blood sample' : metrics[0].label,
      metrics,
      lastDay: Math.min(...metrics.map((m) => m.lastDay)),
      overdueDays: sim.day - Math.min(...metrics.map((m) => m.lastDay)) - metrics[0].cadence.step,
    }))
    .sort((a, b) => b.overdueDays - a.overdueDays)
}

// ---------- Pacote para o flight surgeon (RF-15, RF-17) ----------

export const flagKey = (astroId: string, metric: string) => `${astroId}:${metric}`

export interface PacketItem {
  metric: ResolvedMetric
  flagged: boolean
}

export function packetItems(astro: Astronaut, sim: Sim, flags: Record<string, true>): PacketItem[] {
  const items: PacketItem[] = []
  for (const id of Object.keys(METRICS)) {
    const m = resolveMetric(astro, id, sim)
    const flagged = !!flags[flagKey(astro.id, id)]
    if (flagged || m.status === 'critical') items.push({ metric: m, flagged })
  }
  return items
}

export function packetText(astro: Astronaut, sim: Sim, flags: Record<string, true>, diary: Decision[]): string {
  const items = packetItems(astro, sim, flags)
  const decisions = diary.filter((d) => d.astronautId === astro.id).slice(-10)
  const lines = [
    `ORBITALIS flight surgeon packet`,
    `Astronaut: ${astro.name} (${astro.role})`,
    `Mission Day ${sim.day} of ~${MISSION_LENGTH}. Earth link: ${sim.link === 'blackout' ? 'blackout (autonomous)' : `${LINK_DELAY_MIN} min delay`}.`,
    `Overall status: ${STATUS_LABEL[astronautStatus(astro, sim)]}.`,
    `Data are synthetic and illustrative. Status is computed by deterministic rules, not by AI.`,
    '',
    'Flagged and critical items',
  ]
  if (!items.length) lines.push('  None.')
  for (const { metric: m, flagged } of items) {
    lines.push(
      `  [${STATUS_LABEL[m.status]}] ${SYSTEMS[m.system].name} · ${m.label}: ${fmt(m.value, m.decimals)} ${m.unit} (pre-flight ${fmt(m.baseline, m.decimals)}; ${m.provenance}; ${m.threshold.text})${flagged ? ' · flagged by astronaut' : ''}`,
      `      ${m.eval.reason}`,
    )
  }
  lines.push('', 'Recent decisions')
  if (!decisions.length) lines.push('  None logged.')
  for (const d of decisions) {
    lines.push(`  Day ${d.missionDay} · ${d.actionId} · ${d.decision} · status ${STATUS_LABEL[d.statusSnapshot]}${d.autonomous ? ' · autonomous' : ''}`)
  }
  return lines.join('\n')
}

export { signed, shortUnit }
