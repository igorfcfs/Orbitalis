import { METRICS, SYSTEMS } from '../data/systems'
import { HORIZON_DAYS } from '../engine/projection'
import {
  CRUISE_DOSE_RATE, MISSION_LENGTH, STATUS_GLYPH, STATUS_LABEL, astronautStatus, careerAtArrival, dueItems, estimatedHeight,
  exposure, flagKey, fmt, getAstronaut, headline, isLoggable, metricStats, priorityAction, resolveMetric, shortUnit, signed, systemActions,
  systemMetrics, systemStatus,
} from '../lib/model'
import { paths, type Route } from '../lib/route'
import { useFeed } from '../lib/spaceWeather'
import { useSim, useStore } from '../state/store'
import type { Astronaut, Sim, Status, SystemId } from '../types'
import { DiaryPanel, LogPanel, PacketPanel, QueuePanel } from './panels'
import { ActionCard, Gauge, MetricBadge, MetricChart, NoAction, OfflineTag, ProvenanceBadge, Reading, StatusPill, ThresholdChip, TrendCompare } from './primitives'

type BodyRoute = Exclude<Route, { level: 0 }>

const STATUS_WORD: Record<Status, string> = { nominal: 'All good', watch: 'On watch', critical: 'Needs attention' }

// ---------- Nível 1: o astronauta ----------

function Home({ astro, sim }: { astro: Astronaut; sim: Sim }) {
  const status = astronautStatus(astro, sim)
  const pa = priorityAction(astro, sim)
  const due = dueItems(astro, sim).length
  return (
    <>
      <header className="who">
        <span className={`avatar s-${status}`} aria-hidden="true">{astro.initials}</span>
        <div>
          <h1>{astro.name}</h1>
          <p>{astro.role}</p>
        </div>
      </header>

      <section className={`verdict s-${status}`} aria-live="polite">
        <span className="verdict-glyph" aria-hidden="true">{STATUS_GLYPH[status]}</span>
        <div>
          <b>{STATUS_WORD[status]}</b>
          <p>{headline(astro, sim)}</p>
        </div>
      </section>

      <section>
        <h2 className="label">Today</h2>
        {pa && pa.action ? (
          <ActionCard astroId={astro.id} action={pa.action} status={systemStatus(astro, pa.system, sim)} />
        ) : (
          <NoAction />
        )}
      </section>

      {due > 0 && (
        <a className="nudge" href={paths.view(astro.id, 'queue')}>
          <span>{due === 1 ? 'A measurement is due' : `${due} measurements are due`}</span>
          <span aria-hidden="true">→</span>
        </a>
      )}
      <p className="hint"><i className="hint-dot" aria-hidden="true" />Click the body to see why. Drag to turn.</p>
    </>
  )
}

// ---------- Radiação: o traje muda a exposição ----------

function ExposureCard({ astro, sim }: { astro: Astronaut; sim: Sim }) {
  const setSuit = useStore((s) => s.setSuit)
  const ex = exposure(sim)
  const career = resolveMetric(astro, 'career_dose', sim)
  const arrival = careerAtArrival(career.value, sim)
  const limit = career.threshold.limit ?? 600
  const over = arrival >= limit
  return (
    <section className={`exposure${sim.suit ? ' eva' : ''}`} aria-label="Radiation exposure">
      <div className="seg" role="group" aria-label="Exposure">
        <button type="button" aria-pressed={!sim.suit} onClick={() => setSuit(false)}>Habitat</button>
        <button type="button" aria-pressed={sim.suit} onClick={() => setSuit(true)}>EVA suit</button>
      </div>
      <div className="rate">
        <span className="num">{fmt(ex.rate, 1)}</span>
        <span className="unit">mSv/day</span>
        <ProvenanceBadge kind={ex.provenance} />
      </div>
      <p className="small">{ex.shielding}</p>
      <dl className="exp-list">
        <dt>Career dose at Day {MISSION_LENGTH}</dt>
        <dd className={`mono ${over ? 's-watch' : ''}`}>{fmt(arrival, 0)} mSv</dd>
        <dt>Career limit [V1 4030]</dt>
        <dd className="mono">&lt; {fmt(limit, 0)} mSv</dd>
      </dl>
      {sim.suit && (
        <p className="small muted">
          Suit shielding is a prototype assumption: {fmt(ex.rate / CRUISE_DOSE_RATE, 0)}× the {CRUISE_DOSE_RATE} mSv/day measured inside the hull. Replace it with the mission’s dosimetry.
        </p>
      )}
    </section>
  )
}

function FeedCard() {
  const feed = useFeed()
  return (
    <div className="feed">
      <div className="mr-top">
        <span className="label">Space weather · 30 days</span>
        <span className={`prov${feed.live ? ' live' : ''}`}>{feed.live ? 'LIVE' : 'SAMPLE'}</span>
      </div>
      <p className="small muted">NASA DONKI. {feed.live ? 'Real feed.' : 'Feed unreachable, so this is a stored sample.'}</p>
      <ul className="small mono">
        {feed.flares.slice(-3).map((f) => (
          <li key={f.peakTime}>Flare {f.classType} · {f.peakTime.slice(0, 10)}</li>
        ))}
        <li>Particle events: {feed.sepCount}</li>
      </ul>
    </div>
  )
}

// ---------- Nível 2: o sistema ----------

function Tile({ astro, system, m }: { astro: Astronaut; system: SystemId; m: ReturnType<typeof resolveMetric> }) {
  return (
    <a className={`tile s-${m.status}`} href={paths.metric(astro.id, system, m.id)} aria-label={`${m.label}, ${STATUS_LABEL[m.status].toLowerCase()}`}>
      <div className="tile-top">
        <span>{m.label}</span>
        <span className="glyph" aria-hidden="true">{STATUS_GLYPH[m.status]}</span>
      </div>
      <Reading m={m} />
      <Gauge m={m} />
      <div className="tile-foot">
        <span className="mono">pre-flight {fmt(m.baseline, m.decimals)}</span>
        <MetricBadge m={m} />
      </div>
    </a>
  )
}

function System({ astro, system, sim }: { astro: Astronaut; system: SystemId; sim: Sim }) {
  const def = SYSTEMS[system]
  const status = systemStatus(astro, system, sim)
  const metrics = systemMetrics(astro, system, sim)
  const actions = systemActions(astro, system, sim)
  const height = system === 'skeletal' ? estimatedHeight(astro, sim.day) : null
  return (
    <>
      <a className="back" href={paths.body(astro.id)}>← {astro.name}</a>
      <header className="sys-head">
        <div>
          <h1>{def.name}</h1>
          <p>{def.region}</p>
        </div>
        <StatusPill status={status} />
      </header>
      <p className="lede-sm">{def.summary[sim.solar && system === 'radiation' ? 'critical' : status]}</p>
      {system === 'radiation' && <ExposureCard astro={astro} sim={sim} />}
      <div className="tiles">
        {metrics.map((m) => <Tile key={m.id} astro={astro} system={system} m={m} />)}
      </div>
      {actions.length > 0 && (
        <section>
          <h2 className="label">Do this</h2>
          <div className="stack">
            {actions.map((a) => <ActionCard key={a.id} astroId={astro.id} action={a} status={status} />)}
          </div>
        </section>
      )}
      {actions.length === 0 && <NoAction />}
      <details className="why">
        <summary>How it works <OfflineTag /></summary>
        <div className="why-body">
          <p className="small">{def.mechanism}</p>
          <h3 className="label">Evidence</h3>
          <p className="small">{def.evidence}</p>
          <h3 className="label">Why each number has its status</h3>
          <ul className="reasons small">
            {metrics.map((m) => (
              <li key={m.id}><strong>{m.label}</strong> <StatusPill status={m.status} /><br />{m.eval.reason}</li>
            ))}
          </ul>
          <h3 className="label">Against their pre-flight values</h3>
          <TrendCompare metrics={metrics} />
          {height && (
            <div className="feed">
              <div className="mr-top"><span className="label">Height</span><span className="prov">ESTIMATED</span></div>
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

// ---------- Nível 3: o número ----------

function Metric({ astro, system, metric, sim }: { astro: Astronaut; system: SystemId; metric: string; sim: Sim }) {
  const m = resolveMetric(astro, metric, sim)
  const st = metricStats(m)
  const actions = systemActions(astro, system, sim)
  const flags = useStore((s) => s.flags)
  const toggleFlag = useStore((s) => s.toggleFlag)
  const flagged = !!flags[flagKey(astro.id, metric)]
  const projected = m.eval.projected ?? m.value + st.slope * HORIZON_DAYS
  const trend = `${signed(st.slope, Math.abs(st.slope) < 0.1 ? 3 : 2)} ${shortUnit(m.unit)} per day · ${HORIZON_DAYS}-day projection ${fmt(projected, m.decimals)}`
  return (
    <>
      <a className="back" href={paths.system(astro.id, system)}>← {SYSTEMS[system].name}</a>
      <header className="sys-head">
        <div>
          <h1>{m.label}</h1>
          <p>{astro.name}</p>
        </div>
        <StatusPill status={m.status} />
      </header>

      <div className="big">
        <Reading m={m} />
        <p className="caption mono">
          pre-flight {fmt(m.baseline, m.decimals)} {shortUnit(m.unit)}
          {st.deltaPct !== null ? ` · ${signed(st.deltaPct, 1)}%` : ''} <MetricBadge m={m} />
        </p>
      </div>

      <MetricChart m={m} day={sim.day} />
      <p className="trend mono">{trend}</p>

      <section className={`why-status s-${m.status}`}>
        <h2 className="label">Why {STATUS_LABEL[m.status]}</h2>
        <p>{m.eval.reason}</p>
      </section>

      {actions.length ? <ActionCard astroId={astro.id} action={actions[0]} status={m.status} /> : <NoAction />}

      <details className="why">
        <summary>About this number <OfflineTag /></summary>
        <div className="why-body">
          <ThresholdChip threshold={m.threshold} />
          <h3 className="label">In plain words</h3>
          <p className="small">{m.plain}</p>
          <h3 className="label">Why it matters</h3>
          <p className="small">{m.why}</p>
          <h3 className="label">Where it comes from</h3>
          <p className="small">{m.instrument}<span className="muted"> · {m.heritage}</span></p>
          <h3 className="label">How it is collected</h3>
          <p className="small">{m.how}{m.minutes > 0 ? ` About ${m.minutes} min.` : ''}</p>
        </div>
      </details>

      <div className="btn-row wrap">
        {isLoggable(METRICS[metric]) && <a className="btn" href={paths.log(astro.id, system, metric)}>Log a measurement</a>}
        <button type="button" className={`btn${flagged ? ' on' : ''}`} aria-pressed={flagged} onClick={() => toggleFlag(flagKey(astro.id, metric))}>
          {flagged ? 'Flagged for flight surgeon' : 'Flag for flight surgeon'}
        </button>
      </div>
    </>
  )
}

// ---------- Painel ----------

export function Panel({ route }: { route: BodyRoute }) {
  const sim = useSim()
  const astro = getAstronaut(route.id)
  const key = route.level === 1 ? route.view : route.level === 2 ? route.system : `${route.metric}${route.log ? '-log' : ''}`
  return (
    <aside className="panel" aria-label="Details">
      <div key={`${astro.id}-${route.level}-${key}`} className="panel-in">
        {route.level === 1 && route.view === 'home' && <Home astro={astro} sim={sim} />}
        {route.level === 1 && route.view === 'queue' && <QueuePanel astro={astro} sim={sim} />}
        {route.level === 1 && route.view === 'diary' && <DiaryPanel astro={astro} />}
        {route.level === 1 && route.view === 'packet' && <PacketPanel astro={astro} sim={sim} />}
        {route.level === 2 && <System astro={astro} system={route.system} sim={sim} />}
        {route.level === 3 && !route.log && <Metric astro={astro} system={route.system} metric={route.metric} sim={sim} />}
        {route.level === 3 && route.log && <LogPanel astro={astro} system={route.system} metric={route.metric} sim={sim} />}
      </div>
    </aside>
  )
}

