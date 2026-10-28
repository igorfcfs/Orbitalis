import { fmt } from '../lib/format'
import type { Cadence, Evaluation, Point, Rule, Status } from '../types'
import { HORIZON_DAYS, daysToCross, project } from './projection'

const RANK: Record<Status, number> = { nominal: 0, watch: 1, critical: 2 }

export const worst = (list: Status[]): Status =>
  list.reduce<Status>((a, b) => (RANK[b] > RANK[a] ? b : a), 'nominal')

export interface MetricInput {
  value: number
  baseline: number
  unit: string
  decimals: number
  points: Point[]
  day: number
  cadence: Cadence
  /** Taxa conhecida (ex.: dose/dia na exposição atual). Substitui a regressão na projeção. */
  rate?: number
}

/**
 * Status de uma métrica. Código puro e determinístico: a IA nunca decide status.
 * 1. Requisito NASA: CRITICAL se viola; WATCH se a projeção de 30 dias viola ou a folga é menor que a margem.
 * 2. Sem requisito: faixas provisórias ou clínicas, sem projeção.
 */
export function evaluateMetric(rule: Rule, m: MetricInput): Evaluation {
  const f = (n: number) => `${fmt(n, m.decimals)} ${m.unit}`.trim()
  const { value } = m

  if (rule.dir === 'none') return { status: 'nominal', reason: 'Tracked for budget only; no limit applies to this number.' }

  if (rule.official && rule.limit !== undefined && (rule.dir === 'min' || rule.dir === 'max')) {
    const dir = rule.dir
    const limit = rule.limit
    const margin = rule.margin ?? 0
    const slack = dir === 'min' ? value - limit : limit - value
    const { slope, projected } = project(m.points, m.cadence.mode, m.day, m.rate)
    const daysToLimit = daysToCross(value, slope, limit, dir)
    const base = { slope, projected, daysToLimit }
    const sign = dir === 'min' ? '≥' : '<'
    if (slack < 0 || (dir === 'max' && value === limit)) {
      return { status: 'critical', reason: `${f(value)} violates the requirement (${sign} ${f(limit)}).`, ...base }
    }
    const violates = dir === 'min' ? projected < limit : projected >= limit
    if (violates) {
      const when = daysToLimit !== null && daysToLimit <= HORIZON_DAYS ? `, reaching it in about ${Math.max(1, Math.round(daysToLimit))} days` : ''
      return {
        status: 'watch',
        reason: `Within the limit, but the ${HORIZON_DAYS}-day projection is ${f(projected)}, past the ${sign} ${f(limit)} requirement${when}.`,
        ...base,
      }
    }
    if (slack < margin) {
      return { status: 'watch', reason: `Within the limit, but only ${f(slack)} of margin remains (watch below ${f(margin)}).`, ...base }
    }
    return { status: 'nominal', reason: `${f(slack)} of margin to the ${sign} ${f(limit)} requirement, and the ${HORIZON_DAYS}-day projection stays inside it.`, ...base }
  }

  if (rule.dir === 'min' && rule.watch !== undefined && rule.crit !== undefined) {
    if (value < rule.crit) return { status: 'critical', reason: `${f(value)} is below the critical bound of ${f(rule.crit)}.` }
    if (value < rule.watch) return { status: 'watch', reason: `${f(value)} is below the provisional threshold of ${f(rule.watch)}.` }
    return { status: 'nominal', reason: `${f(value)} is at or above the provisional threshold of ${f(rule.watch)}.` }
  }

  if (rule.dir === 'max' && rule.watch !== undefined && rule.crit !== undefined) {
    if (value > rule.crit) return { status: 'critical', reason: `${f(value)} is above the critical bound of ${f(rule.crit)}.` }
    if (value > rule.watch) return { status: 'watch', reason: `${f(value)} is above the provisional threshold of ${f(rule.watch)}.` }
    return { status: 'nominal', reason: `${f(value)} is at or below the provisional threshold of ${f(rule.watch)}.` }
  }

  if (rule.dir === 'range' && rule.range && rule.critRange) {
    const [lo, hi] = rule.range
    const [clo, chi] = rule.critRange
    if (value < clo || value > chi) return { status: 'critical', reason: `${f(value)} is far outside the range ${fmt(lo, m.decimals)}–${fmt(hi, m.decimals)}.` }
    if (value < lo || value > hi) return { status: 'watch', reason: `${f(value)} is outside the range ${fmt(lo, m.decimals)}–${fmt(hi, m.decimals)}.` }
    return { status: 'nominal', reason: `${f(value)} is inside the range ${fmt(lo, m.decimals)}–${fmt(hi, m.decimals)}.` }
  }

  if (rule.dir === 'rel' && rule.relWatch !== undefined && rule.relCrit !== undefined) {
    const dev = m.baseline === 0 ? 0 : (Math.abs(value - m.baseline) / Math.abs(m.baseline)) * 100
    const d = `${fmt(dev, 1)}%`
    if (dev > rule.relCrit) return { status: 'critical', reason: `${d} away from the pre-flight value; critical beyond ${rule.relCrit}%.` }
    if (dev > rule.relWatch) return { status: 'watch', reason: `${d} away from the pre-flight value; watch beyond ${rule.relWatch}%.` }
    return { status: 'nominal', reason: `${d} away from the pre-flight value, inside the ${rule.relWatch}% provisional band.` }
  }

  return { status: 'nominal', reason: 'No rule applies.' }
}
