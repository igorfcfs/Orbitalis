import { useState } from 'react'
import { METRICS, SYSTEMS } from '../data/systems'
import { LINK_DELAY_MIN, MISSION_DAY, MISSION_LENGTH, fmt, getAstronaut, resolveMetric } from '../lib/model'
import { go, paths, type Route } from '../lib/route'
import { useSim, useStore } from '../state/store'
import { MetricBadge, ProvenanceBadge } from './primitives'

function Crumbs({ route }: { route: Route }) {
  if (!('id' in route)) {
    return route.page === 'sources' ? (
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href={paths.crew}>Crew</a><span className="sep" aria-hidden="true">/</span><span aria-current="page">Sources and data</span>
      </nav>
    ) : null
  }
  const astro = getAstronaut(route.id)
  const items: { label: string; href?: string }[] = [{ label: 'Crew', href: paths.crew }]
  const atHome = route.level === 1 && route.view === 'home'
  items.push({ label: astro.name, href: atHome ? undefined : paths.body(astro.id) })
  if (route.level === 1 && route.view !== 'home') {
    items.push({ label: { queue: 'Today’s queue', diary: 'Decision diary', packet: 'Flight surgeon packet', home: '' }[route.view] })
  }
  if ('system' in route) {
    items.push({ label: SYSTEMS[route.system].name, href: route.level > 2 ? paths.system(astro.id, route.system) : undefined })
  }
  if (route.level === 3) {
    items.push({ label: METRICS[route.metric].label, href: route.log ? paths.metric(astro.id, route.system, route.metric) : undefined })
    if (route.log) items.push({ label: 'Log measurement' })
  }
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <span key={it.label}>
          {i > 0 && <span className="sep" aria-hidden="true">/</span>}
          {it.href ? <a href={it.href}>{it.label}</a> : <span aria-current="page">{it.label}</span>}
        </span>
      ))}
    </nav>
  )
}

function SimulationMenu() {
  const [open, setOpen] = useState(false)
  const day = useStore((s) => s.day)
  const solar = useStore((s) => s.solar)
  const link = useStore((s) => s.link)
  const setDay = useStore((s) => s.setDay)
  const setSolar = useStore((s) => s.setSolar)
  const setLink = useStore((s) => s.setLink)
  const resetData = useStore((s) => s.resetData)
  return (
    <div className="sim">
      <button type="button" className="btn ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
        Simulation
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Simulation controls">
          <label className="field-row">
            <span className="label">Mission day</span>
            <span className="mono">Day {day}</span>
            <input type="range" min={10} max={MISSION_LENGTH} step={1} value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Mission day" />
          </label>
          <label className="check">
            <input type="checkbox" checked={solar} onChange={(e) => setSolar(e.target.checked)} />
            <span>Solar particle event</span>
          </label>
          <fieldset>
            <legend className="label">Earth link</legend>
            <label className="check">
              <input type="radio" name="link" checked={link === 'delayed'} onChange={() => setLink('delayed')} />
              <span>Delayed ({LINK_DELAY_MIN} min)</span>
            </label>
            <label className="check">
              <input type="radio" name="link" checked={link === 'blackout'} onChange={() => setLink('blackout')} />
              <span>Blackout (conjunction)</span>
            </label>
          </fieldset>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setDay(MISSION_DAY)}>Day {MISSION_DAY}</button>
            <button type="button" className="btn" onClick={resetData}>Clear saved data</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function TopBar({ route }: { route: Route }) {
  const sim = useSim()
  const astro = 'id' in route ? getAstronaut(route.id) : null
  const career = astro ? resolveMetric(astro, 'career_dose', sim) : null
  return (
    <header className="topbar">
      <a className="brand" href={paths.crew} onClick={() => go(paths.crew)}>
        <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="4" fill="currentColor" />
          <ellipse cx="16" cy="16" rx="13" ry="6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" transform="rotate(-25 16 16)" />
        </svg>
        <span>ORBITALIS</span>
      </a>
      <Crumbs route={route} />
      <div className="bar-right">
        {astro && (
          <div className="stat" title="Body temperature is a cross-system acute signal">
            <span className="label">Body temp</span>
            <span className="stat-row">
              <span className="mono">{fmt(astro.tempNow, 1)} <span className="muted">°C</span></span>
              <span className="muted small mono">from {fmt(astro.tempBaseline, 1)}</span>
              <ProvenanceBadge kind="CONTINUOUS" />
            </span>
          </div>
        )}
        {career && (
          <div className="stat" title={`Career dose: ${fmt(career.baseline, 0)} mSv before this mission, plus the mission dose`}>
            <span className="label">Career dose</span>
            <span className="stat-row">
              <span className="mono">{fmt(career.value, 1)} <span className="muted">mSv</span></span>
              <span className="muted small mono">from {fmt(career.baseline, 0)}</span>
              <MetricBadge m={career} />
            </span>
          </div>
        )}
        <div className="stat">
          <span className="label">Mission</span>
          <span className="mono">Day {sim.day} <span className="muted">of ~{MISSION_LENGTH}</span></span>
        </div>
        <div className="stat">
          <span className="label">Earth link</span>
          <span className="mono">{sim.link === 'blackout' ? 'Blackout' : `${LINK_DELAY_MIN} min delay`}</span>
        </div>
        <span className="mode" title="The app works fully on board. Earth is never required to act.">Autonomous mode</span>
        <a className="btn ghost" href={paths.sources}>Sources</a>
        <SimulationMenu />
      </div>
      <div className="progress" style={{ ['--p' as string]: `${Math.min(100, (sim.day / MISSION_LENGTH) * 100)}%` }} aria-hidden="true" />
    </header>
  )
}
