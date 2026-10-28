import { useEffect, useMemo } from 'react'
import { ASTRONAUTS } from '../data/astronauts'
import { METRICS, SYSTEMS, SYSTEM_IDS } from '../data/systems'
import { HORIZON_DAYS } from '../engine/projection'
import {
  CRUISE_DOSE_RATE, MISSION_LENGTH, STATUS_LABEL, astronautStatus, dueItems, estimatedHeight, flagKey, fmt, getAstronaut,
  headline, isLoggable, metricStats, priorityAction, resolveMetric, shortUnit, signed, systemActions, systemMetrics, systemStatus,
} from '../lib/model'
import { go, parentPath, paths, type Route } from '../lib/route'
import { useFeed } from '../lib/spaceWeather'
import { ATTRIBUTION, INITIAL_LAYERS, LAYERS, SYSTEM_LAYERS } from '../scene/anatomy'
import { BodyCanvas } from '../scene/BodyCanvas'
import { useAnatomy } from '../scene/useAnatomy'
import { useSim, useStore } from '../state/store'
import type { Astronaut, ResolvedMetric, Sim, Status, SystemId } from '../types'
import { DiaryPanel, LogPanel, PacketPanel, QueuePanel } from './panels'
import {
  ActionCard, MetricBadge, MetricChart, NoAction, OfflineTag, Reading, Sparkline, Stat, StatusPill, ThresholdChip, TrendCompare,
} from './primitives'

type BodyRoute = Exclude<Route, { level: 0 }>

// ---------- Nível 1: Body ----------

function BodyHome({ astro, sim }: { astro: Astronaut; sim: Sim }) {
  const status = astronautStatus(astro, sim)
  const pa = priorityAction(astro, sim)
  const due = dueItems(astro, sim).length
  const flags = useStore((s) => s.flags)
  const flagged = Object.keys(flags).filter((k) => k.startsWith(`${astro.id}:`)).length
  return (
    <>
      <div className="panel-head">
        <span className={`avatar sm s-${status}`} aria-hidden="true">{astro.initials}</span>
        <div>
          <h1>{astro.name}</h1>
          <p className="muted small">{astro.role}</p>
        </div>
        <StatusPill status={status} />
      </div>
      <p className="summary">{headline(astro, sim)}</p>
      <h2 className="label">Today’s action</h2>
      {pa && pa.action ? (
        <ActionCard
          astroId={astro.id}
          action={pa.action}
          status={systemStatus(astro, pa.system, sim)}
          why={`${SYSTEMS[pa.system].name} is ${STATUS_LABEL[systemStatus(astro, pa.system, sim)]}.`}
        />
      ) : (
        <NoAction />
      )}
      <p className="muted small">Select a system on the body to see why.</p>
      <nav className="shortcuts" aria-label="Crew tools">
        <a href={paths.view(astro.id, 'queue')}><span>Today’s queue</span><span className="mono">{due}</span></a>
        <a href={paths.view(astro.id, 'packet')}><span>Flight surgeon packet</span><span className="mono">{flagged}</span></a>
        <a href={paths.view(astro.id, 'diary')}><span>Decision diary</span></a>
      </nav>
    </>
  )
}

// ---------- Nível 2: System ----------

function FeedCard() {
  const feed = useFeed()
  return (
    <div className="feed">
      <div className="mr-top">
        <span className="label">Space weather, last 30 days</span>
        <span className={`prov${feed.live ? ' live' : ''}`}>{feed.live ? 'LIVE' : 'SAMPLE'}</span>
      </div>
      <p className="small muted">NASA DONKI (CCMC). {feed.live ? `Fetched ${feed.fetchedAt.slice(0, 16).replace('T', ' ')} UTC.` : 'Feed unreachable, so this is a stored sample.'}</p>
      <ul className="small mono">
        {feed.flares.slice(-3).map((f) => (
          <li key={f.peakTime}>Flare {f.classType} · peak {f.peakTime.slice(0, 16).replace('T', ' ')}</li>
        ))}
        <li>Solar energetic particle events: {feed.sepCount}</li>
      </ul>
    </div>
  )
}

function SystemPanel({ astro, system, sim }: { astro: Astronaut; system: SystemId; sim: Sim }) {
  const def = SYSTEMS[system]
  const status = systemStatus(astro, system, sim)
  const metrics = systemMetrics(astro, system, sim)
  const actions = systemActions(astro, system, sim)
  const height = system === 'skeletal' ? estimatedHeight(astro, sim.day) : null
  return (
    <>
      <a className="back" href={paths.body(astro.id)}>← {astro.name}</a>
      <div className="panel-head">
        <div>
          <h1>{def.name}</h1>
          <p className="muted small">{def.region}</p>
        </div>
        <StatusPill status={status} />
      </div>
      <p className="summary">{def.summary[sim.solar && system === 'radiation' ? 'critical' : status]}</p>
      <ul className="metric-list">
        {metrics.map((m) => (
          <li key={m.id}>
            <a className={`metric-row s-${m.status}`} href={paths.metric(astro.id, system, m.id)} aria-label={`${m.label}, ${STATUS_LABEL[m.status].toLowerCase()}`}>
              <div className="mr-top">
                <span className="mr-label">{m.label}</span>
                <StatusPill status={m.status} />
              </div>
              <div className="mr-mid">
                <Reading m={m} />
                <Sparkline m={m} />
              </div>
              <div className="mr-bot">
                <span className="muted small mono">Pre-flight {fmt(m.baseline, m.decimals)} {shortUnit(m.unit)}</span>
                <MetricBadge m={m} />
              </div>
              <ThresholdChip threshold={m.threshold} />
            </a>
          </li>
        ))}
      </ul>
      {actions.length ? (
        <>
          <h2 className="label">Actions</h2>
          {actions.map((a) => <ActionCard key={a.id} astroId={astro.id} action={a} status={status} />)}
        </>
      ) : (
        <NoAction />
      )}
      <details className="why">
        <summary>How this system works <OfflineTag /></summary>
        <div className="why-body">
          <p className="small">{def.mechanism}</p>
          <span className="label">Evidence</span>
          <p className="small">{def.evidence}</p>
          <span className="label">Why each number has its status</span>
          <ul className="reasons small">
            {metrics.map((m) => (
              <li key={m.id}><strong>{m.label}</strong> <StatusPill status={m.status} /><br />{m.eval.reason}</li>
            ))}
          </ul>
          <span className="label">Metrics against their pre-flight value</span>
          <TrendCompare metrics={metrics} />
          {height && (
            <div className="feed">
              <div className="mr-top">
                <span className="label">Height</span>
                <span className="prov">ESTIMATED</span>
              </div>
              <div className="reading"><span className="num">{fmt(height.value * 100, 1)}</span><span className="unit">cm</span></div>
              <p className="small muted mono">Pre-flight {fmt(height.baseline * 100, 1)} cm · {signed((height.value - height.baseline) * 100, 1)} cm</p>
              <p className="small">The spine lengthens without gravity, by up to 3% (NTRS 20090007782). It returns to normal after landing.</p>
            </div>
          )}
          {system === 'radiation' && <FeedCard />}
        </div>
      </details>
    </>
  )
}

// ---------- Nível 3: Metric ----------

function CrewCompare({ metricId, sim, current }: { metricId: string; sim: Sim; current: string }) {
  return (
    <ul className="crewcmp">
      {ASTRONAUTS.map((a) => {
        const m = resolveMetric(a, metricId, sim)
        const pct = m.baseline === 0 ? null : ((m.value - m.baseline) / Math.abs(m.baseline)) * 100
        return (
          <li key={a.id} className={a.id === current ? 'me' : ''}>
            <span className="avatar xs" aria-hidden="true">{a.initials}</span>
            <span className="small">{a.name.split(' ')[0]}</span>
            <span className="mono small">{fmt(m.value, m.decimals)} <span className="muted">{shortUnit(m.unit)}</span></span>
            <span className="mono small muted">{pct === null ? '—' : `${signed(pct, 1)}%`}</span>
            <StatusPill status={m.status} />
          </li>
        )
      })}
    </ul>
  )
}

function DoseBudget({ m, sim }: { m: ResolvedMetric; sim: Sim }) {
  const { slope } = metricStats(m)
  const atArrival = m.value + slope * (MISSION_LENGTH - sim.day)
  const limit = m.threshold.limit ?? 600
  const scale = Math.max(limit, atArrival) * 1.05
  const pct = (v: number) => Math.max(0, Math.min(100, (v / scale) * 100))
  const pre = m.baseline
  const mission = m.value - m.baseline
  return (
    <div className="budget">
      <div className="mr-top">
        <span className="label">Dose budget to arrival</span>
        <span className="prov">ESTIMATED</span>
      </div>
      <div className="bar" role="img" aria-label={`Before mission ${fmt(pre, 0)}, this mission ${fmt(mission, 0)}, projected at Day ${MISSION_LENGTH} ${fmt(atArrival, 0)}, limit ${fmt(limit, 0)} mSv`}>
        <i className="seg pre" style={{ left: 0, width: `${pct(pre)}%` }} />
        <i className="seg mission" style={{ left: `${pct(pre)}%`, width: `${pct(mission)}%` }} />
        <i className="seg proj" style={{ left: `${pct(m.value)}%`, width: `${Math.max(0, pct(atArrival) - pct(m.value))}%` }} />
        <i className="limit-mark" style={{ left: `${pct(limit)}%` }} />
      </div>
      <dl className="small mono budget-list">
        <dt>Before this mission</dt><dd>{fmt(pre, 1)} mSv</dd>
        <dt>This mission so far</dt><dd>{fmt(mission, 1)} mSv</dd>
        <dt>Projected at Day {MISSION_LENGTH}</dt><dd>{fmt(atArrival, 1)} mSv</dd>
        <dt>Career limit [V1 4030]</dt><dd>&lt; {fmt(limit, 0)} mSv</dd>
      </dl>
      <p className="small muted">At the cruise rate of {CRUISE_DOSE_RATE} mSv/day (RAD, Mars Science Laboratory), the limit is {atArrival >= limit ? 'reached before arrival' : 'not reached before arrival'}.</p>
    </div>
  )
}

function MetricPanel({ astro, system, metric, sim }: { astro: Astronaut; system: SystemId; metric: string; sim: Sim }) {
  const m = resolveMetric(astro, metric, sim)
  const st = metricStats(m)
  const actions = systemActions(astro, system, sim)
  const flags = useStore((s) => s.flags)
  const toggleFlag = useStore((s) => s.toggleFlag)
  const flagged = !!flags[flagKey(astro.id, metric)]
  const limit = m.threshold.limit
  const slope = st.slope
  return (
    <>
      <a className="back" href={paths.system(astro.id, system)}>← {SYSTEMS[system].name}</a>
      <div className="panel-head">
        <h1>{m.label}</h1>
        <StatusPill status={m.status} />
      </div>
      <div className="m-hero">
        <Reading m={m} />
        <div className="m-meta">
          <span className="muted small mono">
            Pre-flight {fmt(m.baseline, m.decimals)} {shortUnit(m.unit)} · {signed(st.deltaAbs, m.decimals)}{st.deltaPct !== null ? ` (${signed(st.deltaPct, 1)}%)` : ''}
          </span>
          <MetricBadge m={m} />
        </div>
        <ThresholdChip threshold={m.threshold} />
      </div>
      <MetricChart m={m} day={sim.day} />
      <div className="why-status">
        <span className="label">Why {STATUS_LABEL[m.status]}</span>
        <p className="small">{m.eval.reason}</p>
        <p className="small muted">Computed by deterministic rules from the numbers above, not by AI.</p>
      </div>
      <div className="statgrid">
        <Stat label="Last reading" value={`Day ${m.lastDay}`} sub={sim.day - m.lastDay > 0 ? `${sim.day - m.lastDay} d ago` : 'today'} />
        <Stat label="Recent mean" value={fmt(st.mean, m.decimals)} sub={shortUnit(m.unit)} />
        <Stat label="Recent range" value={`${fmt(st.min, m.decimals)}–${fmt(st.max, m.decimals)}`} sub={shortUnit(m.unit)} />
        <Stat label="Trend per day" value={signed(slope, Math.abs(slope) < 0.1 ? 3 : 2)} sub={shortUnit(m.unit)} />
        <Stat label={`In ${HORIZON_DAYS} days`} value={fmt(m.eval.projected ?? m.value + slope * HORIZON_DAYS, m.decimals)} sub={`${shortUnit(m.unit)} · projection`} />
        <Stat
          label={limit !== undefined ? 'Days to limit' : 'Pre-flight'}
          value={limit !== undefined ? (m.eval.daysToLimit != null ? `~${Math.round(m.eval.daysToLimit)}` : 'No crossing') : fmt(m.baseline, m.decimals)}
          sub={limit !== undefined ? (m.rule.official ? 'NASA requirement' : 'provisional') : shortUnit(m.unit)}
        />
      </div>
      {metric === 'career_dose' && <DoseBudget m={m} sim={sim} />}
      <dl className="facts">
        <dt className="label">Source</dt>
        <dd>{m.instrument}<span className="muted small"> · {m.heritage}</span></dd>
        <dt className="label">How it is collected</dt>
        <dd>{m.how}{m.minutes > 0 ? ` About ${m.minutes} min.` : ''}</dd>
        <dt className="label">In plain words <OfflineTag /></dt>
        <dd>{m.plain}</dd>
        <dt className="label">Why it matters <OfflineTag /></dt>
        <dd>{m.why}</dd>
      </dl>
      <span className="label">Across the crew</span>
      <CrewCompare metricId={metric} sim={sim} current={astro.id} />
      {actions.length ? <ActionCard astroId={astro.id} action={actions[0]} status={m.status} /> : <NoAction />}
      <div className="btn-row wrap">
        {isLoggable(METRICS[metric]) && <a className="btn" href={paths.log(astro.id, system, metric)}>Log a measurement</a>}
        <button type="button" className={`btn${flagged ? ' on' : ''}`} aria-pressed={flagged} onClick={() => toggleFlag(flagKey(astro.id, metric))}>
          {flagged ? 'Flagged for flight surgeon' : 'Flag for flight surgeon'}
        </button>
      </div>
    </>
  )
}

// ---------- Tela ----------

export function BodyScreen({ route }: { route: BodyRoute }) {
  const sim = useSim()
  const astro = getAstronaut(route.id)
  const selected = 'system' in route ? route.system : null
  const layers = useStore((s) => s.layers)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const setCredits = useStore((s) => s.setCredits)

  const visible = useMemo(() => {
    const v = { ...layers }
    if (selected) for (const l of SYSTEM_LAYERS[selected]) v[l] = true
    return v
  }, [layers, selected])
  const wanted = useMemo(() => LAYERS.map((l) => l.id).filter((id) => INITIAL_LAYERS.includes(id) || visible[id]), [visible])
  const anatomy = useAnatomy(wanted)

  const statuses = useMemo(
    () => Object.fromEntries(SYSTEM_IDS.map((s) => [s, systemStatus(astro, s, sim)])) as Record<SystemId, Status>,
    [astro, sim],
  )
  const rhr = resolveMetric(astro, 'rhr', sim).value
  const mass = resolveMetric(astro, 'mass', sim)
  // Proporção derivada da massa e da altura registradas; altura cresce com o alongamento da coluna
  const widthScale = Math.min(1.15, Math.max(0.87, Math.sqrt(mass.value / (astro.heightM * astro.heightM) / 22)))
  const heightScale = estimatedHeight(astro, sim.day).value / 1.8

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return
      go(parentPath(route))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route])

  const loading = !anatomy.norm && !anatomy.failed
  const pending = LAYERS.filter((l) => anatomy.status[l.id] === 'loading').map((l) => l.label.toLowerCase())
  const panelKey = route.level === 1 ? route.view : route.level === 2 ? route.system : `${route.metric}${route.log ? '-log' : ''}`

  return (
    <main className="stage">
      <div className="canvas-wrap">
        <BodyCanvas
          astroId={astro.id}
          anatomy={anatomy}
          visible={visible}
          selected={selected}
          statuses={statuses}
          bpm={rhr}
          heightScale={heightScale}
          widthScale={widthScale}
          labels={route.level === 1 && route.view === 'home'}
        />
        {(loading || pending.length > 0 || anatomy.failed) && (
          <p className="loading" role="status">
            {anatomy.failed ? 'Anatomy model unavailable, showing a simplified body' : `Loading anatomy · ${pending.join(', ') || 'skin'}`}
          </p>
        )}
        <div className="layers" role="group" aria-label="Anatomy layers">
          {LAYERS.map((l) => (
            <button key={l.id} type="button" className={`layer${visible[l.id] ? ' on' : ''}`} aria-pressed={visible[l.id]} title={l.blurb} onClick={() => toggleLayer(l.id)}>
              {l.label}
              {anatomy.status[l.id] === 'loading' && <span className="dotload" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <p className="credit">
          {ATTRIBUTION} <button type="button" className="linkbtn" onClick={() => setCredits(true)}>Credits</button>
        </p>
      </div>
      <aside className="panel" aria-label="Details">
        <div key={`${astro.id}-${route.level}-${panelKey}`} className="panel-in">
          {route.level === 1 && route.view === 'home' && <BodyHome astro={astro} sim={sim} />}
          {route.level === 1 && route.view === 'queue' && <QueuePanel astro={astro} sim={sim} />}
          {route.level === 1 && route.view === 'diary' && <DiaryPanel astro={astro} />}
          {route.level === 1 && route.view === 'packet' && <PacketPanel astro={astro} sim={sim} />}
          {route.level === 2 && <SystemPanel astro={astro} system={route.system} sim={sim} />}
          {route.level === 3 && !route.log && <MetricPanel astro={astro} system={route.system} metric={route.metric} sim={sim} />}
          {route.level === 3 && route.log && <LogPanel astro={astro} system={route.system} metric={route.metric} sim={sim} />}
        </div>
      </aside>
      <p className="sr-only" aria-live="polite">{astro.name} is {STATUS_LABEL[astronautStatus(astro, sim)].toLowerCase()}</p>
    </main>
  )
}
