import { useEffect, useRef } from 'react'
import { ASTRONAUTS } from '../data/astronauts'
import { BODY_ORDER, SYSTEMS } from '../data/systems'
import {
  LINK_DELAY_MIN, MISSION_DAY, MISSION_LENGTH, STATUS_GLYPH, STATUS_LABEL, astronautStatus, attentionSystems, dueItems, getAstronaut, headline,
  systemDrivers, systemStatus,
} from '../lib/model'
import { go, paths, type Route } from '../lib/route'
import { ATTRIBUTION, LAYERS } from '../scene/anatomy'
import { useSim, useStore } from '../state/store'
import type { Astronaut, Status } from '../types'
import { StatusPill } from './primitives'

const WORDS = ['No one', 'One', 'Two', 'Three', 'Four']
const STATUS_WORD: Record<Status, string> = { nominal: 'All good', watch: 'On watch', critical: 'Needs attention' }

// ---------- Barra mínima ----------

export function Hud() {
  const sim = useSim()
  const setMenu = useStore((s) => s.setMenu)
  const menuOpen = useStore((s) => s.menuOpen)
  return (
    <header className="hud">
      <a className="brand" href={paths.crew} aria-label="Orbitalis, back to the crew">
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="4.2" fill="currentColor" />
          <ellipse cx="16" cy="16" rx="13.5" ry="5.8" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.75" transform="rotate(-28 16 16)" />
        </svg>
        <span>ORBITALIS</span>
      </a>
      <div className="hud-right">
        <div className="chip-day" title="Mission day">
          <span className="label">Day</span>
          <span className="mono"><b>{sim.day}</b><i>/{MISSION_LENGTH}</i></span>
          <span className="bar" style={{ ['--p' as string]: `${Math.min(100, (sim.day / MISSION_LENGTH) * 100)}%` }} />
        </div>
        <div className={`chip-link${sim.link === 'blackout' ? ' off' : ''}`} title="The app works fully on board. Earth is never required to act.">
          <i aria-hidden="true" />
          <span>{sim.link === 'blackout' ? 'Blackout · autonomous' : `Earth ${LINK_DELAY_MIN} min`}</span>
        </div>
        <button type="button" className="icon-btn" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenu(!menuOpen)}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
    </header>
  )
}

// ---------- Tripulação ----------

const firstName = (a: Astronaut) => a.name.split(' ')[0]
const joinNames = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

export function CrewOverlay() {
  const sim = useSim()
  const hoverCrew = useStore((s) => s.hoverCrew)
  const list = ASTRONAUTS.map((a) => ({ a, status: astronautStatus(a, sim), off: attentionSystems(a, sim) }))
  const critical = list.filter((x) => x.status === 'critical')
  const watch = list.filter((x) => x.status === 'watch')
  const lead = critical[0] ?? watch[0]
  const title = lead
    ? critical.length
      ? <><em className="s-critical">{lead.a.name}</em> needs attention.</>
      : <>{WORDS[watch.length]} on <em className="s-watch">watch</em>.</>
    : <>Everyone is <em className="s-nominal">on baseline</em>.</>
  const first = lead ? headline(lead.a, sim).split(/(?<=\.)\s/)[0] : ''
  // Quem mais está fora do nominal, pelo nome (cada placa diz o sistema)
  const otherCrit = critical.filter((x) => x !== lead).map((x) => firstName(x.a))
  const otherWatch = watch.filter((x) => x !== lead).map((x) => firstName(x.a))
  const sub = lead
    ? [
        critical.length ? first : `${firstName(lead.a)}: ${first}`,
        otherCrit.length ? `${joinNames(otherCrit)} also ${otherCrit.length === 1 ? 'needs' : 'need'} attention.` : '',
        otherWatch.length ? `${joinNames(otherWatch)} ${otherWatch.length === 1 ? 'is' : 'are'} on watch.` : '',
      ].filter(Boolean).join(' ')
    : 'No system is outside its limits.'
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Crew status</p>
        <h1>{title}</h1>
        <p className="sub">{sub}</p>
      </section>
      {list.map(({ a, status, off }) => (
        <div key={a.id} data-plate={a.id} className={`plate s-${status}${hoverCrew === a.id ? ' hot' : ''}`} style={{ opacity: 0 }}>
          <span className="plate-head">
            <span className="plate-name"><span className="full">{a.name}</span><span className="short">{firstName(a)}</span></span>
            <StatusPill status={status} />
          </span>
          <span className="plate-sys">
            {off.length === 0 && <span className="muted">All systems nominal</span>}
            {off.slice(0, 2).map((x) => (
              <span key={x.system}><i className={`s-${x.status}`} aria-hidden="true">{STATUS_GLYPH[x.status]}</i>{SYSTEMS[x.system].name}</span>
            ))}
            {off.length > 2 && <span className="muted">+{off.length - 2}</span>}
          </span>
        </div>
      ))}
      <nav className="a11y-rail" aria-label="Crew">
        {list.map(({ a, status, off }) => (
          <a key={a.id} href={paths.body(a.id)}>
            {a.name}, {STATUS_LABEL[status].toLowerCase()}
            {off.length > 0 && `: ${off.map((x) => `${SYSTEMS[x.system].name} ${STATUS_LABEL[x.status].toLowerCase()}`).join(', ')}`}
          </a>
        ))}
      </nav>
    </>
  )
}

// ---------- Corpo: dock, dica sob o cursor, trilho de teclado ----------

/** Controles da cena, só da cena: o estado de cada sistema, inclusive a radiação, fica na lista ao lado do corpo. */
export function Dock({ route }: { route: Exclude<Route, { level: 0 }> }) {
  const suit = useStore((s) => s.suit)
  const xray = useStore((s) => s.xray)
  const setSuit = useStore((s) => s.setSuit)
  const setXray = useStore((s) => s.setXray)
  const atHome = route.level === 1 && route.view === 'home'
  return (
    <div className="dock" role="toolbar" aria-label="View tools">
      <button type="button" className={`dock-btn${suit ? ' on' : ''}`} aria-pressed={suit} aria-label={suit ? 'Take off the EVA suit' : 'Put on the EVA suit'} onClick={() => setSuit(!suit)}>
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5v2.2c0 3.2 2.1 5.9 5 6.6V20H8.5a1 1 0 0 0 0 2h7a1 1 0 0 0 0-2H13v-2.2c2.9-.7 5-3.4 5-6.6V9A6.5 6.5 0 0 0 12 2.5Zm-4.5 6.8c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5v1.6H7.5V9.3Z" fill="currentColor" /></svg>
        <span>{suit ? 'Take off suit' : 'EVA suit'}</span>
      </button>
      {!suit && <button type="button" className={`dock-btn${xray ? ' on' : ''}`} aria-pressed={xray} aria-label="X-ray view, all anatomy layers" onClick={() => setXray(!xray)}>
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a3 3 0 0 1 3 3c0 1.2-.7 2.2-1.7 2.7V9h3.2a1 1 0 1 1 0 2H13v2h3.5a1 1 0 1 1 0 2H13v2.3l2.6 3.7a1 1 0 1 1-1.6 1.2L12 19.4 10 22.2a1 1 0 1 1-1.6-1.2l2.6-3.7V15H7.5a1 1 0 1 1 0-2H11v-2H7.5a1 1 0 1 1 0-2h3.2V7.7A3 3 0 0 1 12 2Z" fill="currentColor" /></svg>
        <span>X-ray</span>
      </button>}
      {!atHome && (
        <button type="button" className="dock-btn" aria-label="Reset view" onClick={() => go(paths.body(route.id))}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 1 0 7 7h-2a5 5 0 1 1-1.5-3.5L13 11h7V4l-2.6 2.6A6.97 6.97 0 0 0 12 5Z" fill="currentColor" /></svg>
          <span>Reset view</span>
        </button>
      )}
    </div>
  )
}

/**
 * Camadas do atlas, só com o raio-X ligado, numa fileira acima do dock: são controles de visualização, não dados.
 * O raio-X liga todas de uma vez; aqui cada uma liga, desliga e, com o cursor em cima, aparece inteira enquanto as outras esmaecem.
 */
export function LayersRail() {
  const layers = useStore((s) => s.layers)
  const toggle = useStore((s) => s.toggleLayer)
  const setAll = useStore((s) => s.setAllLayers)
  const setHover = useStore((s) => s.setHoverLayer)
  const all = layers.length === LAYERS.length
  return (
    <nav className="layers" aria-label="Anatomy layers" onPointerLeave={() => setHover(null)}>
      <span className="label layers-title">Anatomy layers</span>
      <button type="button" className={`layer-btn all${all ? ' on' : ''}`} aria-pressed={all} onClick={() => setAll(!all)}>
        <i aria-hidden="true" />
        <span>All</span>
      </button>
      <hr className="layers-sep" />
      {LAYERS.map((l) => {
        const on = layers.includes(l.id)
        return (
          <button
            key={l.id}
            type="button"
            className={`layer-btn${on ? ' on' : ''}`}
            aria-pressed={on}
            title={l.blurb}
            onClick={() => toggle(l.id)}
            onPointerEnter={() => setHover(l.id)}
            onFocus={() => setHover(l.id)}
            onBlur={() => setHover(null)}
          >
            <i style={{ ['--layer' as string]: l.color }} aria-hidden="true" />
            <span>{l.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function HoverTip({ route }: { route: Route }) {
  const sim = useSim()
  const hoverSys = useStore((s) => s.hoverSys)
  const hoverCrew = useStore((s) => s.hoverCrew)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ref.current) ref.current.style.transform = `translate3d(${e.clientX + 18}px, ${e.clientY + 20}px, 0)`
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])
  let text: React.ReactNode = null
  if (route.level === 0 && hoverCrew) {
    const a = getAstronaut(hoverCrew)
    const st = astronautStatus(a, sim)
    text = <><span className={`s-${st}`}>{STATUS_GLYPH[st]}</span> {a.name} · {STATUS_WORD[st]}</>
  } else if ('id' in route && hoverSys) {
    const st = systemStatus(getAstronaut(route.id), hoverSys, sim)
    text = <><span className={`s-${st}`}>{STATUS_GLYPH[st]}</span> {SYSTEMS[hoverSys].name} · {STATUS_LABEL[st].toLowerCase()}</>
  }
  return (
    <div ref={ref} className="tip" style={{ opacity: text ? 1 : 0 }} role="status">
      {text}
    </div>
  )
}

/**
 * O índice dos dados, ao lado do corpo e da cabeça aos pés: cada sistema com o status em forma e palavra e, fora do nominal,
 * a métrica que o causa. O corpo é o mapa, a lista é o índice: o cursor numa linha realça a região no corpo (railSys) e o
 * cursor no corpo marca a linha (hoverSys). Também é a navegação por teclado e o caminho até os dados enquanto a cena carrega.
 */
export function SystemsRail({ route }: { route: Exclude<Route, { level: 0 }> }) {
  const sim = useSim()
  const hoverSys = useStore((s) => s.hoverSys)
  const setRailSys = useStore((s) => s.setRailSys)
  const astro = getAstronaut(route.id)
  const open = 'system' in route ? route.system : null
  return (
    <nav className="sysrail" aria-label="Body systems" onPointerLeave={() => setRailSys(null)}>
      <span className="label sysrail-title">Systems</span>
      <ul>
        {BODY_ORDER.map((s) => {
          const st = systemStatus(astro, s, sim)
          const [driver, ...more] = systemDrivers(astro, s, sim)
          return (
            <li key={s}>
              <a
                href={paths.system(astro.id, s)}
                className={`sys-row s-${st}${hoverSys === s ? ' hot' : ''}`}
                aria-current={open === s ? 'page' : undefined}
                aria-label={`${SYSTEMS[s].name}, ${STATUS_LABEL[st].toLowerCase()}${driver ? `: ${[driver, ...more].map((m) => m.label).join(', ')}` : ''}`}
                onPointerEnter={() => setRailSys(s)}
                onFocus={() => setRailSys(s)}
                onBlur={() => setRailSys(null)}
              >
                <i className="sys-glyph" aria-hidden="true">{STATUS_GLYPH[st]}</i>
                <span className="sys-name">{SYSTEMS[s].name}</span>
                <span className="sys-state">
                  <em>{STATUS_LABEL[st]}</em>
                  {driver && <span className="sys-drv"> · {driver.label}{more.length > 0 && ` +${more.length}`}</span>}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ---------- Menu ----------

export function MenuSheet({ route }: { route: Route }) {
  const open = useStore((s) => s.menuOpen)
  const setMenu = useStore((s) => s.setMenu)
  const day = useStore((s) => s.day)
  const solar = useStore((s) => s.solar)
  const link = useStore((s) => s.link)
  const flags = useStore((s) => s.flags)
  const setDay = useStore((s) => s.setDay)
  const setSolar = useStore((s) => s.setSolar)
  const setLink = useStore((s) => s.setLink)
  const resetData = useStore((s) => s.resetData)
  const setCredits = useStore((s) => s.setCredits)
  const sim = useSim()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setMenu])
  const astro = 'id' in route ? getAstronaut(route.id) : null
  const due = astro ? dueItems(astro, sim).length : 0
  const flagged = astro ? Object.keys(flags).filter((k) => k.startsWith(`${astro.id}:`)).length : 0
  const close = () => setMenu(false)
  return (
    <>
      <div className={`scrim${open ? ' on' : ''}`} onClick={close} aria-hidden="true" />
      <aside className={`sheet${open ? ' on' : ''}`} aria-label="Menu" aria-hidden={!open} inert={!open}>
        <div className="sheet-head">
          <h2>Menu</h2>
          <button type="button" className="icon-btn" aria-label="Close menu" onClick={close}>
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        {astro && (
          <section>
            <h3 className="label">{astro.name}</h3>
            <a className="sheet-item" href={paths.view(astro.id, 'queue')} onClick={close}><span>Today’s queue</span><b className="mono">{due}</b></a>
            <a className="sheet-item" href={paths.view(astro.id, 'packet')} onClick={close}><span>Flight surgeon packet</span><b className="mono">{flagged}</b></a>
            <a className="sheet-item" href={paths.view(astro.id, 'diary')} onClick={close}><span>Decision diary</span></a>
          </section>
        )}
        <section>
          <h3 className="label">Mission</h3>
          <a className="sheet-item" href={paths.timeline} onClick={close}><span>Crew timeline</span></a>
          <a className="sheet-item" href={paths.sources} onClick={close}><span>Sources, data and features</span></a>
          <button type="button" className="sheet-item" onClick={() => { close(); setCredits(true) }}><span>Credits</span></button>
        </section>
        <section>
          <h3 className="label">Simulation</h3>
          <label className="sim-row">
            <span>Mission day</span><span className="mono">Day {day}</span>
            <input type="range" min={10} max={MISSION_LENGTH} step={1} value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Mission day" />
          </label>
          <label className="check">
            <input type="checkbox" checked={solar} onChange={(e) => setSolar(e.target.checked)} />
            <span>Solar particle event</span>
          </label>
          <fieldset>
            <legend className="label">Earth link</legend>
            <label className="check"><input type="radio" name="link" checked={link === 'delayed'} onChange={() => setLink('delayed')} /><span>Delayed ({LINK_DELAY_MIN} min)</span></label>
            <label className="check"><input type="radio" name="link" checked={link === 'blackout'} onChange={() => setLink('blackout')} /><span>Blackout (conjunction)</span></label>
          </fieldset>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setDay(MISSION_DAY)}>Day {MISSION_DAY}</button>
            <button type="button" className="btn" onClick={resetData}>Clear saved data</button>
          </div>
        </section>
      </aside>
    </>
  )
}

export function Credits() {
  const open = useStore((s) => s.creditsOpen)
  const setCredits = useStore((s) => s.setCredits)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCredits(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setCredits])
  if (!open) return null
  return (
    <div className="modal-back" onClick={() => setCredits(false)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Credits" onClick={(e) => e.stopPropagation()}>
        <h2>Credits</h2>
        <p className="small">{ATTRIBUTION}</p>
        <p className="small muted">The body is built from the Z-Anatomy skin layer (Shandon’s Body Atlas), recolored and tailored for each crew member. The layers stay under CC BY-SA 4.0. Orbitalis code is original.</p>
        <p className="small muted">EVA suit: the Z-2 prototype planetary suit model from NASA 3D Resources (public domain), with the insignia and baked dirt removed, fitted to each astronaut.</p>
        <p className="small muted">Faces and hair: generic avatars from the Microsoft Rocketbox library (MIT license), which depict no real person. The crew is fictional.</p>
        <p className="small muted">Mars and the sky: Solar System Scope textures (CC BY 4.0), based on NASA and ESA data. Studio lighting and fabric textures: Poly Haven (CC0).</p>
        <p className="small muted">Crew, names and signals are fictional. Hair, eyes, skin, uniforms, suit and the habitat are drawn for this prototype.</p>
        <button type="button" className="btn primary" onClick={() => setCredits(false)}>Close</button>
      </div>
    </div>
  )
}
