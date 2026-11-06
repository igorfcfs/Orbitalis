import { useState } from 'react'
import { ACTIONS } from '../data/actions'
import { OUTCOME_LABEL, adherenceStreak, decisionOutcome } from '../lib/adherence'
import { METRICS, SYSTEMS } from '../data/systems'
import {
  LINK_DELAY_MIN, MISSION_LENGTH, STATUS_GLYPH, STATUS_LABEL, dueItems, fmt, isLoggable, packetItems, packetText, resolveMetric,
  signed, shortUnit, systemActions,
} from '../lib/model'
import { paths } from '../lib/route'
import { useStore } from '../state/store'
import type { Astronaut, Measurement, Sim } from '../types'
import { CameraCheck } from './CameraCheck'
import { ActionCard, Crumbs, MetricBadge, NoAction, OfflineTag, StatusPill, ThresholdChip } from './primitives'

// ---------- Fila do dia (RF-04) ----------

export function QueuePanel({ astro, sim }: { astro: Astronaut; sim: Sim }) {
  const due = dueItems(astro, sim)
  const upcoming = Object.values(METRICS)
    .filter((d) => d.cadence.mode === 'periodic' && isLoggable(d))
    .map((d) => resolveMetric(astro, d.id, sim))
    .filter((m) => sim.day - m.lastDay < m.cadence.step)
    .map((m) => ({ m, next: m.lastDay + m.cadence.step }))
    .sort((a, b) => a.next - b.next)
    .slice(0, 5)
  return (
    <>
      <Crumbs items={[{ label: astro.name, href: paths.body(astro.id) }]} />
      <div className="panel-head"><h1>Today’s queue</h1></div>
      <p className="muted small">Measurements the schedule is asking for on Day {sim.day}. Each one takes a few minutes and updates your status immediately.</p>
      {due.length ? (
        <ul className="queue">
          {due.map((q) => (
            <li key={q.key}>
              <a className="queue-row" href={paths.log(astro.id, q.metrics[0].system, q.metrics[0].id)}>
                <div className="mr-top">
                  <span className="mr-label">{q.title} due</span>
                  <span className="mono small muted">{q.overdueDays > 0 ? `${q.overdueDays} d overdue` : 'due today'}</span>
                </div>
                <p className="small muted">Last taken Day {q.lastDay} · {q.metrics.map((m) => m.label).join(', ')}</p>
                <p className="small">{q.metrics[0].instrument} · about {Math.max(...q.metrics.map((m) => m.minutes))} min</p>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <NoAction text="No measurement is due. The next ones are listed below." />
      )}
      <h2 className="label">Coming up</h2>
      <ul className="upcoming">
        {upcoming.map(({ m, next }) => (
          <li key={m.id}>
            <span>{m.label}</span>
            <span className="mono muted small">Day {next}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

// ---------- Entrada de medição (RF-03, RF-11) ----------

export function LogPanel({ astro, system, metric, sim }: { astro: Astronaut; system: string; metric: string; sim: Sim }) {
  const def = METRICS[metric]
  const group = def.cadence.group
  const members = Object.values(METRICS).filter((d) => (group ? d.cadence.group === group : d.id === metric))
  const lead = members[0]
  const addMeasurements = useStore((s) => s.addMeasurements)
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string[] | null>(null)
  const back = paths.metric(astro.id, system, metric)
  const crumbs = [
    { label: astro.name, href: paths.body(astro.id) },
    { label: SYSTEMS[def.system].name, href: paths.system(astro.id, system) },
    { label: def.label, href: back },
  ]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const list: Measurement[] = []
    for (const d of members) {
      const raw = values[d.id]?.trim()
      if (!raw) {
        errs[d.id] = 'Enter a value.'
        continue
      }
      const v = Number(raw)
      const [lo, hi] = d.cadence.plausible
      if (!Number.isFinite(v)) errs[d.id] = 'Use a number.'
      else if (v < lo || v > hi) errs[d.id] = `Outside the plausible range ${lo}–${hi} ${shortUnit(d.unit)}. Check the unit and repeat the reading.`
      else list.push({ astronautId: astro.id, metric: d.id, day: sim.day, value: v, ts: new Date().toISOString() })
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    addMeasurements(list)
    setSaved(list.map((l) => l.metric))
  }

  if (saved) {
    return (
      <>
        <Crumbs items={crumbs} />
        <div className="panel-head"><h1>Saved</h1></div>
        <p className="muted small">Recorded at Day {sim.day}. Status was recomputed from the new value.</p>
        {saved.map((id) => {
          const m = resolveMetric(astro, id, sim)
          const actions = systemActions(astro, m.system, sim)
          return (
            <div key={id} className="result">
              <div className="mr-top">
                <span className="mr-label">{m.label}</span>
                <StatusPill status={m.status} />
              </div>
              <div className="reading"><span className="num">{fmt(m.value, m.decimals)}</span><span className="unit">{m.unit}</span></div>
              <p className="muted small mono">
                {signed(m.value - m.baseline, m.decimals)} {shortUnit(m.unit)} vs pre-flight {fmt(m.baseline, m.decimals)} <MetricBadge m={m} />
              </p>
              <ThresholdChip threshold={m.threshold} />
              <p className="small">{m.eval.reason}</p>
              {actions[0] ? <ActionCard astroId={astro.id} action={actions[0]} status={m.status} /> : <NoAction />}
            </div>
          )
        })}
      </>
    )
  }

  return (
    <>
      <Crumbs items={crumbs} />
      <div className="panel-head"><h1>Log {group === 'blood' ? 'blood sample' : def.label.toLowerCase()}</h1></div>
      <div className="steps">
        <div>
          <span className="label">How to do it</span>
          <p className="small">{lead.how}</p>
        </div>
        <div>
          <span className="label">Instrument and time</span>
          <p className="small">{lead.instrument} · about {Math.max(...members.map((d) => d.minutes))} min</p>
        </div>
        <div>
          <span className="label">Why this exam is needed</span>
          <p className="small">{lead.why}</p>
        </div>
      </div>
      {metric === 'rhr' && <CameraCheck onReading={(bpm) => setValues((v) => ({ ...v, rhr: String(bpm) }))} />}
      <form onSubmit={submit} className="form" noValidate>
        {members.map((d) => (
          <label key={d.id} className="field">
            <span className="mr-label">{d.label}</span>
            <span className="inputwrap">
              <input
                inputMode="decimal"
                autoComplete="off"
                value={values[d.id] ?? ''}
                onChange={(e) => setValues({ ...values, [d.id]: e.target.value })}
                aria-invalid={!!errors[d.id]}
                aria-describedby={`${d.id}-hint`}
                placeholder={fmt(d.baseline, d.decimals)}
              />
              <span className="unit-tag mono">{shortUnit(d.unit)}</span>
            </span>
            <span id={`${d.id}-hint`} className={errors[d.id] ? 'err small' : 'muted small'}>
              {errors[d.id] ?? `Pre-flight ${fmt(astro.overrides[d.id]?.baseline ?? d.baseline, d.decimals)} ${shortUnit(d.unit)} · plausible ${d.cadence.plausible[0]}–${d.cadence.plausible[1]}`}
            </span>
          </label>
        ))}
        <button type="submit" className="btn primary">Save measurement</button>
      </form>
    </>
  )
}

// ---------- Diário de decisões (RF-16) ----------

export function DiaryPanel({ astro, sim }: { astro: Astronaut; sim: Sim }) {
  const all = useStore((s) => s.diary)
  const streak = adherenceStreak(all, astro.id, sim.day)
  const diary = useStore((s) => s.diary).filter((d) => d.astronautId === astro.id).slice().reverse()
  const done = diary.filter((d) => d.decision === 'done').length
  const snoozed = diary.length - done
  const auto = diary.filter((d) => d.autonomous).length
  return (
    <>
      <Crumbs items={[{ label: astro.name, href: paths.body(astro.id) }]} />
      <div className="panel-head"><h1>Decision diary</h1></div>
      <p className="muted small">Every action you mark done or snooze, with the status at that moment. Stored on this device only.</p>
      <div className="statgrid">
        <div className="statcell"><span className="label">Done</span><span className="mono val">{done}</span></div>
        <div className="statcell"><span className="label">Snoozed</span><span className="mono val">{snoozed}</span></div>
        <div className="statcell"><span className="label">Autonomous</span><span className="mono val">{auto}</span></div>
      </div>
      <p className="small muted mono">Streak: {streak.current} {streak.current === 1 ? 'day' : 'days'} in a row with the day’s action done · best {streak.best}</p>
      {diary.length === 0 ? (
        <NoAction text="No decisions logged yet. Mark an action done from any screen and it appears here." />
      ) : (
        <ul className="diary">
          {diary.map((d) => {
            const o = decisionOutcome(d, astro, sim)
            return (
            <li key={d.id}>
              <div className="mr-top">
                <span className="mr-label">{ACTIONS[d.actionId].label}</span>
                <StatusPill status={d.statusSnapshot} />
              </div>
              <p className="small muted mono">
                Day {d.missionDay} · {d.decision} · {SYSTEMS[d.systemId].name} · link {d.linkState}{d.autonomous ? ' · autonomous' : ''}
              </p>
              {o.kind !== 'none' && (
                <p className="small outcome">
                  <span className="label">Outcome</span> {SYSTEMS[d.systemId].name}: {STATUS_GLYPH[o.from]} {STATUS_LABEL[o.from]} then, {STATUS_GLYPH[o.to]} {STATUS_LABEL[o.to]} now · {OUTCOME_LABEL[o.kind]}
                </p>
              )}
              <p className="small muted mono">{d.ts}</p>
            </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

// ---------- Pacote para o flight surgeon (RF-15, RF-17) ----------

export function PacketPanel({ astro, sim }: { astro: Astronaut; sim: Sim }) {
  const flags = useStore((s) => s.flags)
  const diary = useStore((s) => s.diary)
  const sent = useStore((s) => s.sent[astro.id])
  const emergency = useStore((s) => s.emergencies[astro.id])
  const sendPacket = useStore((s) => s.sendPacket)
  const toggleFlag = useStore((s) => s.toggleFlag)
  const [copied, setCopied] = useState(false)
  const items = packetItems(astro, sim, flags)
  const text = packetText(astro, sim, flags, diary, emergency)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* sem permissão de área de transferência: o download continua disponível */
    }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `orbitalis-packet-${astro.id}-day-${sim.day}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Crumbs items={[{ label: astro.name, href: paths.body(astro.id) }]} />
      <div className="panel-head"><h1>Flight surgeon packet</h1></div>
      <p className="muted small">What goes to the ground team. Critical items are always included; you choose the rest by flagging a number.</p>
      <div className={`linkbox ${sim.link}`}>
        <strong>{sim.link === 'blackout' ? 'Blackout' : `Earth link delayed ${LINK_DELAY_MIN} min`}</strong>
        <span className="small">
          {sim.link === 'blackout'
            ? 'Nothing can be sent. The packet is queued and decisions are logged as autonomous.'
            : `Sending now arrives after about ${LINK_DELAY_MIN} minutes. You do not need to wait for a reply to act.`}
        </span>
      </div>
      {items.length === 0 ? (
        <NoAction text="Nothing flagged and nothing critical. Flag any number from its metric screen." />
      ) : (
        <ul className="packet">
          {items.map(({ metric: m, flagged }) => (
            <li key={m.id}>
              <div className="mr-top">
                <span className="mr-label">{m.label}</span>
                <StatusPill status={m.status} />
              </div>
              <p className="mono small">
                {fmt(m.value, m.decimals)} {m.unit} <span className="muted">· pre-flight {fmt(m.baseline, m.decimals)}</span> <MetricBadge m={m} />
              </p>
              <p className="small muted">{m.eval.reason}</p>
              <p className="small muted">{flagged ? 'Flagged by you' : 'Included automatically (critical)'}</p>
              {flagged && <button type="button" className="linkbtn small" onClick={() => toggleFlag(`${astro.id}:${m.id}`)}>Remove from packet</button>}
            </li>
          ))}
        </ul>
      )}
      <pre className="packet-text" aria-label="Packet preview">{text}</pre>
      <div className="btn-row wrap">
        <button type="button" className="btn primary" onClick={() => sendPacket(astro.id)}>
          {sim.link === 'blackout' ? 'Queue for next window' : 'Send to flight surgeon'}
        </button>
        <button type="button" className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy text'}</button>
        <button type="button" className="btn" onClick={download}>Download</button>
      </div>
      {sent && (
        <p className="small mono muted">
          {sent.link === 'blackout' ? 'Queued' : 'Sent'} at Day {sent.day} · {sent.ts}
        </p>
      )}
      <details className="why">
        <summary>About this packet <OfflineTag /></summary>
        <p className="small">The packet is assembled by rules from the same numbers you see. Status in it is computed by code, so the flight surgeon can reproduce it. Mission length is about {MISSION_LENGTH} days.</p>
      </details>
    </>
  )
}

