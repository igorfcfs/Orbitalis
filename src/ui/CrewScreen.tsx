import { ASTRONAUTS } from '../data/astronauts'
import { STATUS_GLYPH, astronautStatus, headline } from '../lib/model'
import { paths } from '../lib/route'
import { useSim } from '../state/store'
import type { Status } from '../types'
import { StatusPill } from './primitives'

const RANK: Record<Status, number> = { critical: 0, watch: 1, nominal: 2 }

export function CrewScreen() {
  const sim = useSim()
  const crew = ASTRONAUTS.map((a) => ({ a, status: astronautStatus(a, sim) })).sort((x, y) => RANK[x.status] - RANK[y.status])
  return (
    <main className="crew">
      <svg className="orbits" viewBox="-400 -400 800 800" aria-hidden="true">
        {[140, 230, 330].map((r, i) => (
          <ellipse key={r} rx={r} ry={r * 0.36} className={`orbit o${i}`} transform={`rotate(${-22 + i * 6})`} />
        ))}
      </svg>
      <div className="crew-inner">
        <h1 className="label">Crew · who needs attention</h1>
        <ul className="cards">
          {crew.map(({ a, status }, i) => (
            <li key={a.id} style={{ ['--i' as string]: i }}>
              <a className={`card s-${status}`} href={paths.body(a.id)} aria-label={`${a.name}, ${a.role}, ${status}`}>
                <div className="card-head">
                  <span className="avatar" aria-hidden="true">{a.initials}</span>
                  <span className="big-glyph" aria-hidden="true">{STATUS_GLYPH[status]}</span>
                </div>
                <div>
                  <h2>{a.name}</h2>
                  <p className="muted role">{a.role}</p>
                </div>
                <p className="headline">{headline(a, sim)}</p>
                <div className="card-foot">
                  <StatusPill status={status} large />
                  <span className="open" aria-hidden="true">Open body map →</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
