import { SCENARIOS, SCENARIO_IDS, profileOf, type ScenarioId } from '../data/scenarios'
import { doseRate, fmt } from '../lib/model'
import { useSim, useStore } from '../state/store'
import { ProvenanceBadge } from './primitives'

/**
 * RF-33: o cenário da missão no Menu. Mostra o que muda no corpo e no entorno (gravidade, dose com a grandeza, link,
 * evacuação, traje), as transições que fazem sentido a partir daqui e, como simulação, o salto direto a qualquer cenário.
 * Valor sem fonte publicada vem marcado como suposição.
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
      <div className="scn-card">
        <strong>{p.name}</strong>
        <p className="small muted">{p.place}. {p.summary}</p>
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
          {p.next.map((n) => (
            <button key={n.to} type="button" className="btn primary" onClick={() => { if (advance(n.to)) onGo?.() }}>
              {n.label}
            </button>
          ))}
        </div>
      )}
      <fieldset>
        <legend className="label">Simulate a scenario</legend>
        {SCENARIO_IDS.map((id: ScenarioId) => (
          <label key={id} className="check">
            <input type="radio" name="scenario" checked={sim.scenario === id} onChange={() => setScenario(id)} />
            <span>{SCENARIOS[id].name}</span>
          </label>
        ))}
      </fieldset>
    </section>
  )
}
