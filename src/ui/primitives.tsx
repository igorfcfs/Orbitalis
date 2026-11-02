import { useState } from 'react'
import { HORIZON_DAYS, regress, projectionWindow } from '../engine/projection'
import {
  MISSION_DAY, STATUS_GLYPH, STATUS_LABEL, flagKey, fmt, getAstronaut, shortUnit, systemMetrics, type ActionView,
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

export function AiTag() {
  return <span className="offline ai" title="Written by an AI model from numbers the code computed, then checked by rules. Status never comes from AI.">AI explanation</span>
}

export function OfflineTag() {
  return <span className="offline" title="Fallback text from the closed catalog; no model call was made">Offline explanation</span>
}

/**
 * Minigráfico do medidor: a missão inteira até hoje, com a linha pré-voo tracejada, o limite (ou a faixa) e o último
 * ponto na cor do status. O texto do medidor diz o mesmo em palavras, por isso o desenho é aria-hidden.
 */
export function Sparkline({ m }: { m: ResolvedMetric }) {
  const W = 136
  const H = 46
  const pad = 4
  const pts = m.points
  const limit = m.threshold.limit
  const range = m.threshold.range
  const vals = [...pts.map((p) => p.value), m.baseline, ...(limit !== undefined ? [limit] : []), ...(range ?? [])]
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  const margin = (max - min || Math.abs(max) * 0.1 || 1) * 0.12
  min -= margin
  max += margin
  const first = pts[0].day
  const last = pts[pts.length - 1].day
  const x = (d: number) => pad + ((d - first) / Math.max(1, last - first)) * (W - pad * 2)
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (H - pad * 2)
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const end = pts[pts.length - 1]
  return (
    <svg className={`spark s-${m.status}`} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {range && <rect x={pad} width={W - pad * 2} y={y(range[1])} height={y(range[0]) - y(range[1])} className="band" />}
      <line x1={pad} x2={W - pad} y1={y(m.baseline)} y2={y(m.baseline)} className="base" />
      {limit !== undefined && <line x1={pad} x2={W - pad} y1={y(limit)} y2={y(limit)} className="limit" />}
      <path d={path} className="line" />
      <circle cx={x(end.day)} cy={y(end.value)} r="3.2" className="dot" />
    </svg>
  )
}

/** Trilha de navegação: os níveis acima do atual, cada um um link. */
export function Crumbs({ items }: { items: { label: string; href: string }[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={c.href}>
          {i > 0 && <i aria-hidden="true">›</i>}
          <a href={c.href}>{c.label}</a>
        </span>
      ))}
    </nav>
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
  const limitY = m.threshold.limit !== undefined ? y(m.threshold.limit) : null

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
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="axis">{fmt(t, dec > 1 ? 1 : dec)}</text>
          </g>
        ))}
        {xTicks.map((d, i) => (
          <text key={i} x={x(d)} y={H - 8} textAnchor="middle" className="axis">{d === 0 ? 'Day 0' : d}</text>
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
        {/* Rótulos diretos nas linhas de referência, por cima da série (o contorno escuro os separa da linha) */}
        <text x={pad.l + 4} y={y(m.baseline) - 5} className="axis tag">Pre-flight {fmt(m.baseline, dec)}</text>
        {limitY !== null && (
          <text x={W - pad.r - 4} y={limitY < pad.t + 26 ? limitY + 14 : limitY - 5} textAnchor="end" className="axis tag">
            Limit {fmt(m.threshold.limit!, dec)}
          </text>
        )}
        {m.threshold.range && (
          <text x={W - pad.r - 4} y={y(m.threshold.range[1]) + 14} textAnchor="end" className="axis tag">
            Range {m.threshold.range[0]}–{m.threshold.range[1]}
          </text>
        )}
        <text x={x(day) - 4} y={pad.t + 10} textAnchor="end" className="axis tag">Today</text>
      </svg>
      <figcaption className="legend">
        <span><i className="swatch line-sw" /> {hover ? `Day ${hover.day} · ${fmt(hover.value, dec)} ${shortUnit(m.unit)}` : 'Reading'}</span>
        <span><i className="swatch base-sw" /> Pre-flight</span>
        {m.threshold.limit !== undefined && <span><i className="swatch limit-sw" /> Limit</span>}
        {canProject && <span><i className="swatch proj-sw" /> {HORIZON_DAYS}-day projection {fmt(projEnd, dec)}</span>}
      </figcaption>
    </figure>
  )
}

export function ActionCard({
  astroId, action, status, why, compact,
}: { astroId: string; action: ActionView; status: Status; why?: string; compact?: boolean }) {
  const sim = useSim()
  const diary = useStore((s) => s.diary)
  const decide = useStore((s) => s.decide)
  const flags = useStore((s) => s.flags)
  const toggleFlag = useStore((s) => s.toggleFlag)
  const today = [...diary].reverse().find((d) => d.astronautId === astroId && d.actionId === action.id && d.missionDay === sim.day)
  const hours = action.minutes && action.minutes >= 60 ? `${action.minutes / 60} h` : action.minutes ? `${action.minutes} min` : null
  // "Add to packet" põe de fato no pacote as métricas fora do nominal do sistema, além de gravar a decisão no diário
  const packet = action.id === 'EARTH-PACKET'
  const record = (decision: 'done' | 'snoozed') => {
    if (packet && decision === 'done') {
      for (const m of systemMetrics(getAstronaut(astroId), action.systemId, sim)) {
        const key = flagKey(astroId, m.id)
        if (m.status !== 'nominal' && !flags[key]) toggleFlag(key)
      }
    }
    decide({ astronautId: astroId, systemId: action.systemId, actionId: action.id, decision, statusSnapshot: status })
  }
  const doneText = packet ? 'Added to packet' : 'Logged as done'
  return (
    <div className={`action${compact ? ' compact' : ''}`}>
      {compact ? (
        <>
          <h3>{action.label}</h3>
          <p className="muted small"><span className="action-id">{action.id}</span>{hours && ` · ${hours}`} · {action.resource} · {action.protocol}</p>
        </>
      ) : (
        <>
          <div className="action-top">
            <span className="action-id">{action.id}</span>
            {hours && <span className="mono muted">{hours}</span>}
          </div>
          <h3>{action.label}</h3>
          <p className="muted small">{action.resource} · {action.protocol}</p>
        </>
      )}
      {why && <p className="small">{why}</p>}
      {action.note && <p className="note small">{action.note}</p>}
      {today ? (
        <p className="logged small mono">
          {today.decision === 'done' ? doneText : 'Snoozed'} · Day {today.missionDay}{today.autonomous ? ' · autonomous' : ''}
        </p>
      ) : (
        <div className="btn-row">
          <button type="button" className="btn primary" onClick={() => record('done')}>{packet ? 'Add to packet' : 'Done'}</button>
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
