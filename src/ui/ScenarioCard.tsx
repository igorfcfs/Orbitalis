import { SCENARIOS, SCENARIO_IDS, profileOf, type ScenarioId } from '../data/scenarios'
import { doseRate, fmt } from '../lib/model'
import { useSim, useStore } from '../state/store'
import { ProvenanceBadge } from './primitives'

/** Ícones de traço dos três lugares (cor do texto: nunca a cor de status) */
const ICON_PATHS: Record<ScenarioId, React.ReactNode> = {
  // Foguete de pé, com a janela da cápsula, as aletas e o escape
  launch: (
    <>
      <path d="M12 2.5c2.9 2.3 4.4 5.6 4.4 9.6v4.4H7.6v-4.4c0-4 1.5-7.3 4.4-9.6z" />
      <circle cx="12" cy="9.2" r="1.7" />
      <path d="M7.6 13.4l-2.6 2.8v3.3l2.6-1.6M16.4 13.4l2.6 2.8v3.3l-2.6-1.6M10.2 19.4L12 21.6l1.8-2.2" />
    </>
  ),
  // Módulo com painéis solares dos dois lados
  station: (
    <>
      <rect x="9.2" y="9.6" width="5.6" height="4.8" rx="1.2" />
      <path d="M12 9.6V6.2M10.4 6.2h3.2M7.2 12h2M14.8 12h2" />
      <rect x="2.6" y="8.2" width="4.6" height="7.6" rx="0.8" />
      <rect x="16.8" y="8.2" width="4.6" height="7.6" rx="0.8" />
      <path d="M2.6 12h4.6M16.8 12h4.6" />
    </>
  ),
  // Cúpula no solo, com a porta e a Terra pequena no céu
  lunar: (
    <>
      <path d="M2.5 19.2h19" />
      <path d="M5.2 19.2a6.8 6.8 0 0 1 13.6 0" />
      <path d="M10.6 19.2v-2.8h2.8v2.8" />
      <circle cx="18.6" cy="5.4" r="1.9" />
    </>
  ),
}

export function ScenarioIcon({ id, size = 22 }: { id: ScenarioId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[id]}
    </svg>
  )
}

/**
 * RF-33: o cenário da missão no Menu. Primeiro a escolha do lugar (três blocos com ícone, nome e gravidade, como simulação),
 * depois o que muda no corpo e no entorno do lugar atual (gravidade, dose com a grandeza, link, evacuação, traje) e as
 * transições que fazem sentido a partir daqui. Valor sem fonte publicada vem marcado como suposição.
 */
export function ScenarioSection({ onGo }: { onGo?: () => void }) {
  const sim = useSim()
  const advance = useStore((s) => s.advance)
  const setScenario = useStore((s) => s.setScenario)
  const p = profileOf(sim.scenario)
  const rate = doseRate({ suit: false, scenario: sim.scenario })
  return (
    <section aria-label="Scenario">
      <h3 className="label">Scenario</h3>
      <fieldset className="scn-pick">
        <legend className="sr-only">Simulate a scenario</legend>
        <div className="scn-tiles">
          {SCENARIO_IDS.map((id) => {
            const s = SCENARIOS[id]
            const on = sim.scenario === id
            return (
              <label key={id} className={`scn-tile${on ? ' on' : ''}`}>
                <input type="radio" name="scenario" className="sr-only" checked={on} onChange={() => setScenario(id)} />
                <span className="scn-ico">
                  <ScenarioIcon id={id} />
                </span>
                <span className="scn-name">{s.name}</span>
                {/* No bloco, a microgravidade vai na notação curta (µg); o nome inteiro fica no cartão do lugar */}
                <span className="scn-g mono" title={s.gravity.label}>{s.gravity.g === 0 ? 'µg' : s.gravity.label}</span>
              </label>
            )
          })}
        </div>
        <p className="scn-hint">Jump straight to a place. This is a simulation: the day and the suit reset.</p>
      </fieldset>

      <div className="scn-card">
        <div className="scn-card-head">
          <span className="scn-ico lg">
            <ScenarioIcon id={p.id} size={24} />
          </span>
          <div>
            <strong>{p.name}</strong>
            <p className="small muted">{p.place}</p>
          </div>
        </div>
        <p className="small">{p.summary}</p>
        <dl className="scn-list">
          <dt>Gravity</dt>
          <dd>
            <span className="mono">{p.gravity.label}</span>
            {p.gravity.assumed && <span className="chip-assumed">Assumption</span>}
            <small>{p.gravity.detail}</small>
          </dd>
          <dt>Dose rate</dt>
          <dd>
            <span className="mono">{fmt(rate, rate < 1 ? 2 : 1)} mSv/day</span> <ProvenanceBadge kind={p.dose.provenance} />
            <small>{p.dose.quantity === 'equivalent' ? 'Dose equivalent. ' : 'Effective dose. '}{p.dose.source}. {p.dose.note}</small>
          </dd>
          <dt>Earth link</dt>
          <dd>
            <span>{p.link.delayText}</span>
            <small>{p.link.note}</small>
          </dd>
          <dt>Evacuation</dt>
          <dd>
            <span>{p.evacuation.available ? 'Possible' : 'Not possible'}</span>
            <small>{p.evacuation.text}</small>
          </dd>
          <dt>Spacewalk</dt>
          <dd>
            <span>{p.eva.available ? 'Available' : 'Not available'}</span>
            <small>{p.eva.note}</small>
          </dd>
        </dl>
      </div>

      {p.next.length > 0 && (
        <div className="scn-next">
          <span className="label">From here</span>
          {p.next.map((n) => (
            <button key={n.to} type="button" className="scn-go" onClick={() => { if (advance(n.to)) onGo?.() }}>
              <span className="scn-ico">
                <ScenarioIcon id={n.to} />
              </span>
              <span className="scn-go-text">{n.label}</span>
              <svg className="scn-go-arrow" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 10h11M11 5.5l4.5 4.5L11 14.5" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
