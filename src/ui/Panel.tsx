import { HAZARD_LABEL, METRICS, SYSTEMS } from '../data/systems'
import { HORIZON_DAYS } from '../engine/projection'
import {
  SUIT_SHIELD_FACTOR, missionLength, profileOf, STATUS_GLYPH, STATUS_LABEL, astronautStatus, careerAtArrival, dueItems, estimatedHeight,
  exposure, flagKey, fmt, getAstronaut, headline, isLoggable, metricStats, priorityAction, resolveMetric, shortUnit, signed, systemActions,
  systemMetrics, systemStatus,
} from '../lib/model'
import { deviceLine } from '../lib/device'
import { paths, type Route } from '../lib/route'
import { adherenceStreak } from '../lib/adherence'
import { studyUrl, useStudies } from '../lib/osdr'
import { collectedText, contextFor, doiUrl, studiesOf, systemFindings } from '../lib/personalize'
import { KIND_LABEL, type Finding } from '../data/profile'
import { useFeed } from '../lib/spaceWeather'
import { useExplanation } from '../lib/useExplanation'
import { useSim, useStore } from '../state/store'
import type { Astronaut, ResolvedMetric, Sim, Status, SystemId } from '../types'
import { EmergencyPanel } from './Emergency'
import { DiaryPanel, LogPanel, PacketPanel, QueuePanel } from './panels'
import {
  ActionCard, AiTag, Crumbs, MetricBadge, MetricChart, NoAction, OfflineTag, PROVENANCE_HELP, ProvenanceBadge, Reading, Sparkline, StatusPill,
  ThresholdChip,
} from './primitives'

type BodyRoute = Exclude<Route, { level: 0 }>

const STATUS_WORD: Record<Status, string> = { nominal: 'All good', watch: 'On watch', critical: 'Needs attention' }

// ---------- Nível 1: o astronauta ----------

/** Os seis indicadores que o enunciado da NASA cita, com rótulo curto para caber na tabela */
const KEY_INDICATORS: [id: string, label: string][] = [
  ['rhr', 'Heart rate'], ['sbp', 'Systolic BP'], ['glucose', 'Glucose'],
  ['temp', 'Temperature'], ['sleep', 'Sleep'], ['mood', 'Mood'],
]

/** Uma linha da tabela de indicadores: valor, pré-voo e selo alinhados em colunas; fora do nominal, a palavra e o motivo. */
function Indicator({ astro, m, label }: { astro: Astronaut; m: ResolvedMetric; label: string }) {
  const setRailSys = useStore((s) => s.setRailSys)
  const word = STATUS_LABEL[m.status]
  return (
    <a
      className={`ind s-${m.status}`}
      href={paths.metric(astro.id, m.system, m.id)}
      aria-label={`${m.label}: ${fmt(m.value, m.decimals)} ${m.unit}, ${word.toLowerCase()}. Pre-flight ${fmt(m.baseline, m.decimals)}, ${m.provenance.toLowerCase()}.`}
      onPointerEnter={() => setRailSys(m.system)}
      onPointerLeave={() => setRailSys(null)}
    >
      <span className="ind-glyph" aria-hidden="true">{STATUS_GLYPH[m.status]}</span>
      <span className="ind-label">{label}</span>
      <span className="ind-val"><span className="num">{fmt(m.value, m.decimals)}</span> <span className="unit">{shortUnit(m.unit)}</span></span>
      <span className="ind-base mono">{fmt(m.baseline, m.decimals)}</span>
      <MetricBadge m={m} />
      {m.status !== 'nominal' && <span className="ind-why"><em>{word}</em> · {m.eval.reason}</span>}
    </a>
  )
}

/** Medições pendentes na própria tela, com o atalho para registrar (até duas; o resto fica na fila). */
function DueList({ astro, sim }: { astro: Astronaut; sim: Sim }) {
  const due = dueItems(astro, sim)
  if (!due.length) return null
  return (
    <ul className="due" aria-label="Measurements due">
      {due.slice(0, 2).map((q) => (
        <li key={q.key}>
          <a
            href={paths.log(astro.id, q.metrics[0].system, q.metrics[0].id)}
            aria-label={`${q.title} due, with ${q.metrics[0].instrument}, last taken Day ${q.lastDay}${q.overdueDays > 0 ? `, ${q.overdueDays} days overdue` : ''}. Log it.`}
          >
            <span className="due-name">{q.title} due<span className="due-dev"> · {q.metrics[0].instrument}</span></span>
            <span className="due-last mono">last Day {q.lastDay}</span>
            <span className="due-go" aria-hidden="true">Log</span>
          </a>
        </li>
      ))}
      {due.length > 2 && (
        <li><a className="due-more" href={paths.view(astro.id, 'queue')}>{due.length - 2} more in today’s queue</a></li>
      )}
    </ul>
  )
}

/** Sequência de adesão (RF-23): dias seguidos com a ação do dia feita. Só aparece quando há algo a contar. */
function StreakLine({ astro, day }: { astro: Astronaut; day: number }) {
  const diary = useStore((s) => s.diary)
  const st = adherenceStreak(diary, astro.id, day)
  if (st.current === 0 && st.best === 0) return null
  return (
    <p className="streak small mono" aria-label={`Action streak: ${st.current} days in a row, best ${st.best}`}>
      <span className="label">Streak</span> {st.current} {st.current === 1 ? 'day' : 'days'} in a row{st.doneToday ? '' : st.current ? ' · do today’s action to extend it' : ''} · best {st.best}
    </p>
  )
}

function Home({ astro, sim }: { astro: Astronaut; sim: Sim }) {
  const status = astronautStatus(astro, sim)
  const pa = priorityAction(astro, sim)
  return (
    <>
      <header className="who">
        <span className="avatar" aria-hidden="true">{astro.initials}</span>
        <div>
          <h1>{astro.name}</h1>
          <p>{astro.role}</p>
        </div>
        <StatusPill status={status} />
      </header>

      <section className={`verdict s-${status}`} aria-live="polite">
        <span className="verdict-glyph" aria-hidden="true">{STATUS_GLYPH[status]}</span>
        <div>
          <b>{STATUS_WORD[status]}</b>
          <p>{headline(astro, sim)}</p>
        </div>
      </section>

      <section aria-label="Key indicators">
        <div className="inds">
          <div className="ind-head" aria-hidden="true">
            <span className="label">Key indicators</span>
            <span>Now</span>
            <span>Pre-flight</span>
            <span>Source</span>
          </div>
          {KEY_INDICATORS.map(([id, label]) => <Indicator key={id} astro={astro} m={resolveMetric(astro, id, sim)} label={label} />)}
        </div>
      </section>

      <section aria-labelledby="today-h">
        <h2 id="today-h" className="label">Today</h2>
        {pa && pa.action ? (
          <ActionCard astroId={astro.id} action={pa.action} status={systemStatus(astro, pa.system, sim)} compact />
        ) : (
          <NoAction />
        )}
        <DueList astro={astro} sim={sim} />
        <StreakLine astro={astro} day={sim.day} />
      </section>
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
        <button type="button" aria-pressed={!sim.suit} onClick={() => setSuit(false)}>{profileOf(sim.scenario).inside}</button>
        {profileOf(sim.scenario).eva.available && <button type="button" aria-pressed={sim.suit} onClick={() => setSuit(true)}>EVA suit</button>}
      </div>
      <div className="rate">
        <span className="num">{fmt(ex.rate, 1)}</span>
        <span className="unit">mSv/day</span>
        <ProvenanceBadge kind={ex.provenance} />
      </div>
      <p className="small">{ex.shielding}</p>
      <p className="small muted">{profileOf(sim.scenario).dose.quantity === 'equivalent' ? 'Dose equivalent. ' : 'Effective dose. '}{profileOf(sim.scenario).dose.source}.{profileOf(sim.scenario).dose.assumed ? ' Not a published value for this crew.' : ''}</p>
      <dl className="exp-list">
        <dt>Career dose at Day {missionLength(sim)}</dt>
        <dd className={`mono ${over ? 's-watch' : ''}`}>
          {fmt(arrival, 0)} mSv <span className="muted small">pre-flight {fmt(career.baseline, 0)} mSv</span> <ProvenanceBadge kind="ESTIMATED" />
        </dd>
        <dt>Career limit [V1 4030]</dt>
        <dd className="mono">&lt; {fmt(limit, 0)} mSv</dd>
      </dl>
      {sim.suit && (
        <p className="small muted">
          Suit shielding is a prototype assumption: {SUIT_SHIELD_FACTOR}× the {fmt(profileOf(sim.scenario).dose.rate, 2)} mSv/day of the scenario. Replace it with the mission’s dosimetry.
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

/** Camada molecular (RF-26): estudos públicos do OSDR/GeneLab sobre o sistema. Contexto; nunca entra no status. */
function StudiesCard({ system }: { system: SystemId }) {
  const feed = useStudies(system)
  if (!feed.studies.length) return null
  return (
    <div className="feed">
      <div className="mr-top">
        <span className="label">Space biology · OSDR</span>
        <span className={`prov${feed.live ? ' live' : ''}`}>{feed.live ? 'LIVE' : 'SAMPLE'}</span>
      </div>
      <p className="small muted">Public NASA GeneLab studies on this system. Most use animals or cells, so they explain the mechanism and do not set any status.</p>
      <ul className="studies small">
        {feed.studies.map((st) => (
          <li key={st.id}>
            <a href={studyUrl(st.id)} target="_blank" rel="noreferrer">{st.title}</a>
            <span className="muted mono">{st.id} · {st.kind}{st.organism ? ` · ${st.organism}` : ''}{st.year ? ` · ${st.year}` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Perfil pré-voo (RF-34): notas de contexto do catálogo fechado, só para o próprio astronauta (níveis 2 e 3).
 * Coletado em terra, sintético, e nunca muda status, limite nem ação. Sem perfil ou sem nota, nada aparece.
 */
function ProfileNotes({ astro, findings }: { astro: Astronaut; findings: Finding[] }) {
  if (!astro.profile || !findings.length) return null
  return (
    <div className="feed" aria-label="Your pre-flight profile">
      <div className="mr-top">
        <span className="label">Your pre-flight profile</span>
        <span className="prov" title="Exam taken on the ground before flight, not on board">PERIODIC</span>
      </div>
      <p className="small muted">{collectedText(astro.profile)} Synthetic profile for this prototype. It explains; it never changes a status, a limit or an action.</p>
      <ul className="studies small">
        {findings.map((f) => (
          <li key={f.id}>
            <strong>{f.label}</strong>
            <span className="muted mono">{KIND_LABEL[f.kind]}</span>
            <span>{f.note}</span>
            {studiesOf(f).map((st) => (
              <a key={st.doi} href={doiUrl(st.doi)} target="_blank" rel="noreferrer">{st.cite} · {st.who}</a>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- Nível 2: o sistema ----------

/** Medidor do nível 2: o valor com a tendência ao lado, o motivo do status e o limite que o julga, sem precisar abrir nada. */
function Tile({ astro, system, m }: { astro: Astronaut; system: SystemId; m: ResolvedMetric }) {
  return (
    <a className={`tile s-${m.status}`} href={paths.metric(astro.id, system, m.id)} aria-label={`${m.label}, ${STATUS_LABEL[m.status].toLowerCase()}. ${m.eval.reason}`}>
      <div className="tile-top">
        <span>{m.label}</span>
        <StatusPill status={m.status} />
      </div>
      <div className="tile-mid">
        <Reading m={m} />
        <Sparkline m={m} />
      </div>
      <p className="tile-why">{m.eval.reason}</p>
      <p className="tile-dev small muted">{deviceLine(m)}{contextFor(astro, m.id).length ? ' · pre-flight profile note' : ''}</p>
      <div className="tile-foot">
        <span className="mono">pre-flight {fmt(m.baseline, m.decimals)} {shortUnit(m.unit)}</span>
        <MetricBadge m={m} />
      </div>
      <ThresholdChip threshold={m.threshold} />
    </a>
  )
}

function System({ astro, system, sim }: { astro: Astronaut; system: SystemId; sim: Sim }) {
  const def = SYSTEMS[system]
  const status = systemStatus(astro, system, sim)
  const metrics = systemMetrics(astro, system, sim)
  const actions = systemActions(astro, system, sim)
  const height = system === 'skeletal' ? estimatedHeight(astro, sim.day) : null
  const ex = useExplanation(astro, system, sim)
  const reasons = new Map(ex.actions.map((a) => [a.id, a.reason]))
  return (
    <>
      <Crumbs items={[{ label: astro.name, href: paths.body(astro.id) }]} />
      <header className="sys-head">
        <div>
          <h1>{def.name}</h1>
          <p>{def.region} · {def.role}</p>
        </div>
        <StatusPill status={status} />
      </header>
      <p className="lede-sm">{ex.summary}</p>
      <p className="hazards">
        <span className="label">NASA HRP hazards</span>
        {def.hazards.map((h) => <span key={h} className="chip">{HAZARD_LABEL[h]}</span>)}
      </p>
      <div className="tiles">
        {metrics.map((m) => <Tile key={m.id} astro={astro} system={system} m={m} />)}
      </div>
      {system === 'radiation' && <ExposureCard astro={astro} sim={sim} />}
      {actions.length > 0 && (
        <section>
          <h2 className="label">Do this</h2>
          <div className="stack">
            {actions.map((a) => <ActionCard key={a.id} astroId={astro.id} action={a} status={status} why={reasons.get(a.id)} />)}
          </div>
        </section>
      )}
      {actions.length === 0 && <NoAction />}
      <details className="why">
        <summary>How it works {ex.source === 'ai' ? <AiTag /> : <OfflineTag />}</summary>
        <div className="why-body">
          <p className="small">{ex.mechanism}</p>
          <h3 className="label">Evidence</h3>
          <p className="small">{def.evidence}</p>
          {height && (
            <div className="feed">
              <div className="mr-top"><span className="label">Height</span><span className="prov">ESTIMATED</span></div>
              <div className="reading"><span className="num">{fmt(height.value * 100, 1)}</span><span className="unit">cm</span></div>
              <p className="small muted mono">Pre-flight {fmt(height.baseline * 100, 1)} cm · {signed((height.value - height.baseline) * 100, 1)} cm</p>
              <p className="small">The spine lengthens without gravity, by up to 3% (NTRS 20090007782). It returns to normal after landing.</p>
            </div>
          )}
          {system === 'radiation' && <FeedCard />}
          <ProfileNotes astro={astro} findings={systemFindings(astro, system)} />
          <StudiesCard system={system} />
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
  const feed = useFeed()
  const flagged = !!flags[flagKey(astro.id, metric)]
  const projected = m.eval.projected ?? m.value + st.slope * HORIZON_DAYS
  const trend = `${signed(st.slope, Math.abs(st.slope) < 0.1 ? 3 : 2)} ${shortUnit(m.unit)} per day · ${HORIZON_DAYS}-day projection ${fmt(projected, m.decimals)}`
  return (
    <>
      <Crumbs items={[{ label: astro.name, href: paths.body(astro.id) }, { label: SYSTEMS[system].name, href: paths.system(astro.id, system) }]} />
      <header className="sys-head">
        <div>
          <h1>{m.label}</h1>
          <p>{PROVENANCE_HELP[m.id === 'space_weather' && feed.live ? 'LIVE' : m.provenance]}</p>
        </div>
        <StatusPill status={m.status} />
      </header>

      <div className="big">
        <Reading m={m} />
        <p className="caption mono">
          pre-flight {fmt(m.baseline, m.decimals)} {shortUnit(m.unit)}
          {st.deltaPct !== null ? ` · ${signed(st.deltaPct, 1)}%` : ''} <MetricBadge m={m} />
        </p>
        <ThresholdChip threshold={m.threshold} />
      </div>

      <MetricChart m={m} day={sim.day} />
      <p className="trend mono">{trend}</p>

      <section className={`why-status s-${m.status}`}>
        <h2 className="label">Why {STATUS_LABEL[m.status]}</h2>
        <p>{m.eval.reason}</p>
      </section>

      {actions.length ? <ActionCard astroId={astro.id} action={actions[0]} status={m.status} /> : <NoAction />}

      <details className="why" open>
        <summary>About this number <OfflineTag /></summary>
        <div className="why-body">
          <h3 className="label">In plain words</h3>
          <p className="small">{m.plain}</p>
          <h3 className="label">Why it matters</h3>
          <p className="small">{m.why}</p>
          <h3 className="label">Where it comes from</h3>
          <p className="small">{m.instrument}<span className="muted"> · {m.heritage}</span></p>
          <h3 className="label">How it is collected</h3>
          <p className="small">{m.how}{m.minutes > 0 ? ` About ${m.minutes} min.` : ''}</p>
          <ProfileNotes astro={astro} findings={contextFor(astro, m.id)} />
        </div>
      </details>

      <div className="btn-row wrap">
        {isLoggable(METRICS[metric]) && <a className="btn" href={paths.log(astro.id, system, metric)}>Log a measurement</a>}
        {metric === 'rhr' && <a className="btn" href={paths.log(astro.id, system, metric)}>Check with camera</a>}
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
        {route.level === 1 && route.view === 'diary' && <DiaryPanel astro={astro} sim={sim} />}
        {route.level === 1 && route.view === 'packet' && <PacketPanel astro={astro} sim={sim} />}
        {route.level === 1 && route.view === 'emergency' && <EmergencyPanel astro={astro} sim={sim} />}
        {route.level === 2 && <System astro={astro} system={route.system} sim={sim} />}
        {route.level === 3 && !route.log && <Metric astro={astro} system={route.system} metric={route.metric} sim={sim} />}
        {route.level === 3 && route.log && <LogPanel astro={astro} system={route.system} metric={route.metric} sim={sim} />}
      </div>
    </aside>
  )
}

