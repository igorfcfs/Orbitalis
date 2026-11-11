import { useEffect, useRef, useState } from 'react'
import { ASTRONAUTS } from '../data/astronauts'
import {
  CATEGORY_LABEL, missingAnswers, triage, type Breathing, type EmergencyAnswers, type Onset, type Prior, type Yes,
} from '../engine/emergency'
import {
  linkText, STATUS_GLYPH, STATUS_LABEL, astronautStatus, emergencySignals, emergencySteps, fmt, shortUnit,
} from '../lib/model'
import { paths } from '../lib/route'
import { useSim, useStore } from '../state/store'
import type { Astronaut, Sim } from '../types'
import { Crumbs, MetricBadge, StatusPill } from './primitives'

/**
 * Botão de emergência, presente na barra de todas as telas (Crew, corpo, linha do tempo, fontes). Um toque abre a lista da
 * tripulação, um segundo toque no paciente abre o fluxo dele: sem navegar pelo sistema. Neutro: o vermelho é só de status.
 */
export function EmergencyLauncher() {
  const sim = useSim()
  const emergencies = useStore((s) => s.emergencies)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const away = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', key)
    window.addEventListener('pointerdown', away)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('pointerdown', away)
    }
  }, [open])
  const live = ASTRONAUTS.filter((a) => emergencies[a.id])
  return (
    <div className="emg-launch" ref={box}>
      <button type="button" className="emg-btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 2h4v6h6v4h-6v6H8v-6H2V8h6z" fill="currentColor" /></svg>
        <span>Emergency</span>
        {live.length > 0 && <b className="emg-open mono" aria-label={`${live.length} open`}>{live.length}</b>}
      </button>
      {open && (
        <div className="emg-pop" role="menu" aria-label="Who needs help?">
          <p className="label">Who needs help?</p>
          {ASTRONAUTS.map((a) => {
            const st = astronautStatus(a, sim)
            return (
              <a key={a.id} role="menuitem" href={paths.view(a.id, 'emergency')} onClick={() => setOpen(false)} autoFocus={a === ASTRONAUTS[0]}>
                <span>{a.name}<span className="muted small"> · {a.role}</span></span>
                <span className="small">{emergencies[a.id] ? 'Open · ' : ''}<i className={`s-${st}`} aria-hidden="true">{STATUS_GLYPH[st]}</i> {STATUS_LABEL[st]}</span>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

type Opt<T extends string> = [value: T, label: string]

const YES_NO: Opt<Yes>[] = [['yes', 'Yes'], ['no', 'No']]
const BREATHING: Opt<Breathing>[] = [['normal', 'Yes, normally'], ['none', 'No'], ['gasping', 'Only gasps'], ['unknown', 'Not sure']]
const PRIOR: Opt<Prior>[] = [
  ['chest_pain', 'Chest pain'], ['breathless', 'Shortness of breath'], ['dizzy', 'Dizziness'], ['headache', 'Headache'],
  ['vision', 'Vision change'], ['nothing', 'Nothing'], ['unknown', 'Not sure'],
]
const ONSET: Opt<Onset>[] = [['lt1', 'Under 1 min'], ['1to5', '1 to 5 min'], ['gt5', 'Over 5 min']]

function Choice<T extends string>({ legend, options, value, onChange }: { legend: string; options: Opt<T>[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <fieldset className="choice">
      <legend className="mr-label">{legend}</legend>
      <div className="choice-row">
        {options.map(([v, label]) => (
          <button key={v} type="button" className={`btn${value === v ? ' on' : ''}`} aria-pressed={value === v} onClick={() => onChange(v)}>{label}</button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Fluxo de emergência (RF-29): quem socorre informa o que vê, em campos fechados, e as regras em código escolhem a categoria
 * de protocolo e a ordem das ações do catálogo (RF-28). Funciona em blackout. A tela não nomeia causa, não diagnostica e não
 * indica medicamento: mostra a categoria, o que o registro do paciente mostra e os passos.
 */
export function EmergencyPanel({ astro, sim }: { astro: Astronaut; sim: Sim }) {
  const session = useStore((s) => s.emergencies[astro.id])
  const open = useStore((s) => s.openEmergency)
  const answer = useStore((s) => s.answerEmergency)
  const doneStep = useStore((s) => s.doneEmergencyStep)
  const close = useStore((s) => s.closeEmergency)
  useEffect(() => {
    open(astro.id)
  }, [astro.id, open])
  if (!session) return null

  const a = session.answers
  const set = (patch: Partial<EmergencyAnswers>) => answer(astro.id, patch)
  const t = triage(a)
  const missing = missingAnswers(a)
  const steps = emergencySteps(astro, session)
  const signals = emergencySignals(astro, sim)
  const crew = ASTRONAUTS.filter((x) => x.id !== astro.id)
  const blackout = sim.link === 'blackout'

  return (
    <>
      <Crumbs items={[{ label: astro.name, href: paths.body(astro.id) }]} />
      <div className="panel-head"><h1>Emergency: {astro.name}</h1></div>
      <nav className="patients" aria-label="Change patient">
        <span className="label">Patient</span>
        {ASTRONAUTS.map((c) => (
          <a key={c.id} href={paths.view(c.id, 'emergency')} aria-current={c.id === astro.id ? 'page' : undefined} className={c.id === astro.id ? 'on' : ''}>{c.name.split(' ')[0]}</a>
        ))}
      </nav>
      <p className="muted small">Prototype with a fictional crew, not medical advice. Steps come from a closed catalog and need a flight surgeon’s validation before real use.</p>
      <div className={`linkbox ${sim.link}`}>
        <strong>{blackout ? 'Blackout: act on your own' : `Earth link: ${linkText(sim.scenario, 'delayed').toLowerCase()}`}</strong>
        <span className="small">{blackout ? 'Everything here runs on board. Steps are logged as autonomous.' : 'Do not wait for the ground to start. Everything here runs on board.'}</span>
      </div>

      <div className="form">
        <label className="field">
          <span className="mr-label">Who is reporting</span>
          <select value={session.reporterId ?? ''} onChange={(e) => answer(astro.id, {}, e.target.value || null)}>
            <option value="">Choose a crew member</option>
            {crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <Choice legend="Does the patient respond?" options={YES_NO} value={a.responds} onChange={(v) => set({ responds: v })} />
        {a.responds === 'no' && <Choice legend="Is the patient breathing normally?" options={BREATHING} value={a.breathing} onChange={(v) => set({ breathing: v })} />}
        {a.responds === 'yes' && (
          <>
            <Choice legend="Did the patient collapse?" options={YES_NO} value={a.collapsed} onChange={(v) => set({ collapsed: v })} />
            <Choice legend="Before this, the patient reported" options={PRIOR} value={a.prior} onChange={(v) => set({ prior: v })} />
          </>
        )}
        <Choice legend="Injury or bleeding?" options={YES_NO} value={a.injury} onChange={(v) => set({ injury: v })} />
        <Choice legend="How long ago?" options={ONSET} value={a.onset} onChange={(v) => set({ onset: v })} />
      </div>

      {!t && <p className="small muted" role="status">{missing.includes('responds') ? 'Answer the first question to get the steps.' : 'Answer the remaining questions to get the steps.'}</p>}

      {t && (
        <section className={`emg-result s-${t.status}`} aria-live="polite">
          <div className="mr-top">
            <span className="mr-label">{CATEGORY_LABEL[t.category]}</span>
            <StatusPill status={t.status} />
          </div>
          <p className="small muted">Chosen by rules from your answers. It names no cause. The ground team or the Crew Medical Officer makes the assessment.</p>
          {a.injury === 'yes' && <p className="small">Injury or bleeding reported: tell the Crew Medical Officer. It is recorded in the timeline.</p>}
          {astro.isCMO && <p className="note small">The patient is the Crew Medical Officer, so the consult goes to the backup CMO.</p>}

          <h2 className="label">What the record shows</h2>
          <ul className="signals">
            {signals.metrics.map((m) => (
              <li key={m.id}>
                <span>{m.status !== 'nominal' && <i className={`s-${m.status}`} aria-hidden="true">{STATUS_GLYPH[m.status]} </i>}{m.label}</span>
                <span className="mono">{fmt(m.value, m.decimals)} {shortUnit(m.unit)} <span className="muted">· pre-flight {fmt(m.baseline, m.decimals)}</span></span>
                <MetricBadge m={m} />
              </li>
            ))}
          </ul>
          {signals.cardiacClear && <p className="small muted">Heart rate and blood pressure are within their limits in the record. Nothing in the record points to a cause.</p>}

          <h2 className="label">Do this, in order</h2>
          <ol className="steps-list">
            {steps.map((s, i) => {
              const d = session.done[s.id]
              return (
                <li key={s.id} className={d ? 'done' : ''}>
                  <span className="step-n mono" aria-hidden="true">{i + 1}</span>
                  <div>
                    <b>{s.label}</b>
                    <p className="small muted"><span className="action-id">{s.id}</span> · {s.resource} · {s.protocol}</p>
                    {d && <p className="small mono">Done · Day {d.day} · {d.ts.slice(11, 19)} UTC{d.autonomous ? ' · autonomous' : ''}</p>}
                  </div>
                  {!d && <button type="button" className="btn" onClick={() => doneStep(astro.id, s.id)} aria-label={`Mark done: ${s.label}`}>Done</button>}
                </li>
              )
            })}
          </ol>
          <div className="btn-row wrap">
            <a className="btn primary" href={paths.view(astro.id, 'packet')}>{blackout ? 'Open packet (queued for the next window)' : 'Open flight surgeon packet'}</a>
            <button type="button" className="btn" onClick={() => close(astro.id)}>Close emergency</button>
          </div>
          <p className="small muted">The timeline goes into the packet by itself.</p>
        </section>
      )}
    </>
  )
}
