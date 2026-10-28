import { useState } from 'react'
import { HORIZON_DAYS, regress, projectionWindow } from '../engine/projection'
import {
  MISSION_DAY, STATUS_GLYPH, STATUS_LABEL, fmt, shortUnit, type ActionView,
} from '../lib/model'
import { useFeed } from '../lib/spaceWeather'
import { useSim, useStore } from '../state/store'
import type { Point, Provenance, ResolvedMetric, Status, Threshold } from '../types'

export function StatusPill({ status, large }: { status: Status; large?: boolean }) {
  return (
    <span className={`pill s-${status}${large ? ' large' : ''}`}>
      <span aria-hidden="true">{STATUS_GLYPH[status]}</span> {STATUS_LABEL[status]}
    </span>
  )
}

export const PROVENANCE_HELP: Record<Provenance, string> = {
  CONTINUOUS: 'Wearable sensor, continuous reading',
  PERIODIC: 'Exam or sample taken on board at intervals',
  ESTIMATED: 'Model estimate from pre-flight baseline and a published rate',
  LOGGED: 'Entered by the astronaut or an app',
  LIVE: 'Real public feed, live',
  SAMPLE: 'Stored sample of a public feed (offline)',
}

export function ProvenanceBadge({ kind }: { kind: Provenance }) {
  return (
    <span className={`prov${kind === 'LIVE' ? ' live' : ''}`} title={PROVENANCE_HELP[kind]}>
      {kind}
    </span>
  )
}

/** Selo de uma métrica; o clima espacial vira LIVE só quando o feed real respondeu. */
export function MetricBadge({ m }: { m: ResolvedMetric }) {
  const feed = useFeed()
  return <ProvenanceBadge kind={m.id === 'space_weather' && feed.live ? 'LIVE' : m.provenance} />
}

export function ThresholdChip({ threshold }: { threshold: Threshold }) {
  return (
    <span className={`chip ${threshold.kind}`}>
      {threshold.kind === 'nasa' ? '◈ ' : ''}
      {threshold.text}
    </span>
  )
}

/** Valor + unidade. Sempre acompanhado de baseline e selo no ponto de uso. */
export function Reading({ m }: { m: ResolvedMetric }) {
  return (
    <div className="reading">
      <span className="num">{fmt(m.value, m.decimals)}</span>
      <span className="unit">{m.unit}</span>
    </div>
  )
}

export function OfflineTag() {
  return <span className="offline" title="Fallback text from the closed catalog; no model call was made">Offline explanation</span>
}

/** Medidor: onde o valor está entre o baseline pré-voo e o limite. Não depende só da cor. */
export function Gauge({ m }: { m: ResolvedMetric }) {
  const limit = m.threshold.limit
  const range = m.threshold.range
  const marks = [m.baseline, m.value, limit, ...(range ?? [])].filter((v): v is number => v !== undefined)
  let lo = Math.min(...marks)
  let hi = Math.max(...marks)
  const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.18
  lo -= pad
  hi += pad
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`
  const dir = m.rule.dir
  const safe: [number, number] | null = range
    ? range
    : limit !== undefined && dir === 'min'
      ? [limit, hi]
      : limit !== undefined && dir === 'max'
        ? [lo, limit]
        : null
  const from = Math.min(m.baseline, m.value)
  const to = Math.max(m.baseline, m.value)
  return (
    <div className={`gauge s-${m.status}`} aria-hidden="true">
      <div className="gauge-track">
        {safe && <i className="gauge-safe" style={{ left: pos(safe[0]), width: `calc(${pos(safe[1])} - ${pos(safe[0])})` }} />}
        <i className="gauge-fill" style={{ left: pos(from), width: `calc(${pos(to)} - ${pos(from)})` }} />
        <i className="gauge-base" style={{ left: pos(m.baseline) }} />
        {limit !== undefined && <i className="gauge-limit" style={{ left: pos(limit) }} />}
        <i className="gauge-dot" style={{ left: pos(m.value) }} />
      </div>
    </div>
  )
}

/** Gráfico de evolução: série, baseline pré-voo, limiar e projeção de 30 dias. */
export function MetricChart({ m, day }: { m: ResolvedMetric; day: number }) {
  const [hover, setHover] = useState<Point | null>(null)
  const W = 400
  const H = 210
  const pad = { l: 38, r: 10, t: 12, b: 26 }
  const last = m.points[m.points.length - 1]
  const win = projectionWindow(m.points, m.cadence.mode)
  const { slope } = regress(win)
  const canProject = m.rule.dir !== 'none' && m.id !== 'space_weather' && win.length >= 2
  const endDay = day + HORIZON_DAYS
  const projEnd = last.value + slope * (endDay - last.day)
  const xMax = canProject ? endDay : Math.max(day, MISSION_DAY)

  const refs = [m.baseline, m.threshold.limit, ...(m.threshold.range ?? []), ...(canProject ? [projEnd] : [])].filter((v): v is number => v !== undefined)
  const all = [...m.points.map((p) => p.value), ...refs]
  let min = Math.min(...all)
  let max = Math.max(...all)
  const margin = (max - min || 1) * 0.12
  min -= margin
  max += margin
  const x = (d: number) => pad.l + (d / xMax) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)
  const path = m.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const ticks = [min + margin, (min + max) / 2, max - margin]
  const dec = m.decimals
  const xTicks = [0, Math.round(xMax * 0.25), Math.round(xMax * 0.5), Math.round(xMax * 0.75)].concat(canProject ? [] : [xMax])

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const d = ((px - pad.l) / (W - pad.l - pad.r)) * xMax
    setHover(m.points.reduce((a, b) => (Math.abs(b.day - d) < Math.abs(a.day - d) ? b : a)))
  }

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${m.label}, Day 0 to Day ${last.day}. Pre-flight ${fmt(m.baseline, dec)} ${m.unit}, now ${fmt(m.value, dec)} ${m.unit}.${canProject ? ` Projected ${fmt(projEnd, dec)} ${m.unit} by Day ${endDay}.` : ''}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {m.threshold.range && (
          <rect x={pad.l} width={W - pad.l - pad.r} y={y(m.threshold.range[1])} height={y(m.threshold.range[0]) - y(m.threshold.range[1])} className="band" />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="axis">{fmt(t, dec > 1 ? 1 : dec)}</text>
          </g>
        ))}
        {xTicks.map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle" className="axis">{d === 0 ? 'Day 0' : d}</text>
        ))}
        {canProject && (
          <>
            <rect x={x(day)} y={pad.t} width={x(endDay) - x(day)} height={H - pad.t - pad.b} className="horizon" />
            <text x={x(endDay) - 4} y={pad.t + 10} textAnchor="end" className="axis">Day {endDay}</text>
          </>
        )}
        <line x1={pad.l} x2={W - pad.r} y1={y(m.baseline)} y2={y(m.baseline)} className="ref baseline" />
        {m.threshold.limit !== undefined && (
          <line x1={pad.l} x2={W - pad.r} y1={y(m.threshold.limit)} y2={y(m.threshold.limit)} className="ref limit" />
        )}
        <line x1={x(day)} x2={x(day)} y1={pad.t} y2={H - pad.b} className="today" />
        <path d={path} fill="none" className={`line s-${m.status}`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {canProject && (
          <line x1={x(last.day)} y1={y(last.value)} x2={x(endDay)} y2={y(projEnd)} className={`proj s-${m.status}`} />
        )}
        {m.points.length < 40 && m.points.map((p) => <circle key={p.day} cx={x(p.day)} cy={y(p.value)} r="2.2" className={`dot s-${m.status}`} />)}
        {hover && (
          <g>
            <line x1={x(hover.day)} x2={x(hover.day)} y1={pad.t} y2={H - pad.b} className="cursor" />
            <circle cx={x(hover.day)} cy={y(hover.value)} r="4" className={`dot s-${m.status}`} />
          </g>
        )}
      </svg>
      <figcaption className="legend">
        <span><i className="swatch line-sw" /> {hover ? `Day ${hover.day} · ${fmt(hover.value, dec)} ${shortUnit(m.unit)}` : 'Reading'}</span>
        <span><i className="swatch base-sw" /> Pre-flight {fmt(m.baseline, dec)}</span>
        {m.threshold.limit !== undefined && <span><i className="swatch limit-sw" /> Limit {fmt(m.threshold.limit, dec)}</span>}
        {m.threshold.range && <span><i className="swatch band-sw" /> Range {m.threshold.range[0]}–{m.threshold.range[1]}</span>}
        {canProject && <span><i className="swatch proj-sw" /> {HORIZON_DAYS}-day projection {fmt(projEnd, dec)}</span>}
      </figcaption>
    </figure>
  )
}

const DASHES = ['', '6 3', '2 3']

/** Métricas de um sistema em % do baseline pré-voo, diferenciadas por estilo de linha (não só por cor). */
export function TrendCompare({ metrics }: { metrics: ResolvedMetric[] }) {
  const usable = metrics.filter((m) => m.baseline !== 0)
  if (!usable.length) return null
  const W = 400
  const H = 150
  const pad = { l: 38, r: 10, t: 10, b: 22 }
  const series = usable.map((m) => m.points.map((p) => ({ day: p.day, v: (p.value / m.baseline) * 100 })))
  const vals = series.flat().map((p) => p.v).concat(100)
  const min = Math.min(...vals) - 1
  const max = Math.max(...vals) + 1
  const xMax = Math.max(...series.flat().map((p) => p.day), 1)
  const x = (d: number) => pad.l + (d / xMax) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Metrics as a percentage of their pre-flight value over the mission">
        {[min + 1, 100, max - 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={t === 100 ? 'ref baseline' : 'grid'} />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="axis">{Math.round(t)}%</text>
          </g>
        ))}
        {series.map((s, i) => (
          <path
            key={usable[i].id}
            d={s.map((p, j) => `${j ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')}
            fill="none" className="neutral-line" strokeWidth="1.8" strokeDasharray={DASHES[i % 3]}
          />
        ))}
        {[0, Math.round(xMax / 2), xMax].map((d) => (
          <text key={d} x={x(d)} y={H - 6} textAnchor="middle" className="axis">{d === 0 ? 'Day 0' : d}</text>
        ))}
      </svg>
      <figcaption className="legend">
        {usable.map((m, i) => (
          <span key={m.id}>
            <svg width="22" height="6" aria-hidden="true"><line x1="0" x2="22" y1="3" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray={DASHES[i % 3]} /></svg>
            {m.label}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

export function ActionCard({
  astroId, action, status, why,
}: { astroId: string; action: ActionView; status: Status; why?: string }) {
  const sim = useSim()
  const diary = useStore((s) => s.diary)
  const decide = useStore((s) => s.decide)
  const today = [...diary].reverse().find((d) => d.astronautId === astroId && d.actionId === action.id && d.missionDay === sim.day)
  const hours = action.minutes && action.minutes >= 60 ? `${action.minutes / 60} h` : action.minutes ? `${action.minutes} min` : null
  const record = (decision: 'done' | 'snoozed') => decide({ astronautId: astroId, systemId: action.systemId, actionId: action.id, decision, statusSnapshot: status })
  return (
    <div className="action">
      <div className="action-top">
        <span className="action-id">{action.id}</span>
        {hours && <span className="mono muted">{hours}</span>}
      </div>
      <h3>{action.label}</h3>
      <p className="muted small">{action.resource} · {action.protocol}</p>
      {why && <p className="small">{why}</p>}
      {action.note && <p className="note small">{action.note}</p>}
      {today ? (
        <p className="logged small mono">
          {today.decision === 'done' ? 'Logged as done' : 'Snoozed'} · Day {today.missionDay}{today.autonomous ? ' · autonomous' : ''}
        </p>
      ) : (
        <div className="btn-row">
          <button type="button" className="btn primary" onClick={() => record('done')}>Done</button>
          <button type="button" className="btn" onClick={() => record('snoozed')}>Snooze</button>
        </div>
      )}
    </div>
  )
}

export function NoAction({ text }: { text?: string }) {
  return (
    <div className="action none">
      <h3>No action needed today</h3>
      <p className="muted small">{text ?? 'Everything in this view is inside its limits.'}</p>
    </div>
  )
}
