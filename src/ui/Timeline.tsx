import { useMemo } from 'react'
import { ASTRONAUTS } from '../data/astronauts'
import { MISSION_LENGTH, STATUS_GLYPH, STATUS_LABEL, astronautStatus } from '../lib/model'
import { paths } from '../lib/route'
import { useSim, useStore } from '../state/store'
import type { Astronaut, Sim, Status } from '../types'

const STEP = 10
export const TIMELINE_DAYS = Array.from({ length: Math.floor((MISSION_LENGTH - 10) / STEP) + 1 }, (_, i) => 10 + i * STEP)

export interface Course {
  statuses: { day: number; status: Status }[]
  firstWatch: number | null
  firstCritical: number | null
}

/** Evolução do status geral do astronauta ao longo da missão, pelo mesmo motor de regras (sem evento solar nem traje). */
export function courseOf(astro: Astronaut, base: Pick<Sim, 'link' | 'measurements'>): Course {
  const statuses = TIMELINE_DAYS.map((day) => ({ day, status: astronautStatus(astro, { ...base, day, solar: false, suit: false }) }))
  return {
    statuses,
    firstWatch: statuses.find((s) => s.status !== 'nominal')?.day ?? null,
    firstCritical: statuses.find((s) => s.status === 'critical')?.day ?? null,
  }
}

function summary(c: Course): string {
  if (c.firstWatch === null) return 'On baseline for the whole mission so far.'
  const w = c.statuses.find((s) => s.day === c.firstWatch)!.status
  const first = w === 'critical' ? `Needs attention from Day ${c.firstWatch}.` : `On watch from Day ${c.firstWatch}.`
  return c.firstCritical !== null && w !== 'critical' ? `${first} Needs attention from Day ${c.firstCritical}.` : first
}

/** Visão temporal da tripulação (RF-25): uma faixa por astronauta, um marcador de status a cada 10 dias. Clicar leva o dia da simulação até ele. */
export function Timeline() {
  const sim = useSim()
  const setDay = useStore((s) => s.setDay)
  const courses = useMemo(() => ASTRONAUTS.map((a) => ({ a, c: courseOf(a, { link: sim.link, measurements: sim.measurements }) })), [sim.link, sim.measurements])
  return (
    <main className="sources timeline">
      <div className="sources-inner">
        <h1 className="label">Crew timeline</h1>
        <p className="muted">How each astronaut’s overall status moved across the mission, by the same rules as every other screen. Select a marker to jump to that day.</p>
        <ul className="legend small">
          {(['nominal', 'watch', 'critical'] as Status[]).map((s) => (
            <li key={s} className={`s-${s}`}><i aria-hidden="true">{STATUS_GLYPH[s]}</i> {STATUS_LABEL[s]}</li>
          ))}
          <li className="muted">Today is Day {sim.day}</li>
        </ul>
        {courses.map(({ a, c }) => (
          <section key={a.id} className="trow" aria-label={`${a.name}: ${summary(c)}`}>
            <div className="trow-head">
              <a href={paths.body(a.id)}><b>{a.name}</b></a>
              <span className="small muted">{summary(c)}</span>
            </div>
            <ol className="strip">
              {c.statuses.map(({ day, status }) => {
                const now = sim.day >= day && sim.day < day + STEP
                return (
                  <li key={day}>
                    <button
                      type="button"
                      className={`cell s-${status}${now ? ' now' : ''}`}
                      aria-label={`${a.name}, Day ${day}: ${STATUS_LABEL[status].toLowerCase()}`}
                      aria-current={now ? 'date' : undefined}
                      title={`Day ${day}: ${STATUS_LABEL[status]}`}
                      onClick={() => setDay(day)}
                    >
                      <span aria-hidden="true">{STATUS_GLYPH[status]}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
            <div className="axis mono small muted" aria-hidden="true"><span>Day 10</span><span>Day {MISSION_LENGTH / 2}</span><span>Day {MISSION_LENGTH}</span></div>
          </section>
        ))}
        <a className="btn" href={paths.crew}>Back to crew</a>
      </div>
    </main>
  )
}
