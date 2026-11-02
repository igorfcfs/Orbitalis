import { METRICS, SYSTEMS, SYSTEM_IDS } from '../data/systems'
import { LINK_DELAY_MIN } from '../lib/model'
import { paths } from '../lib/route'
import { ATTRIBUTION } from '../scene/anatomy'
import { PROVENANCE_HELP, ProvenanceBadge, ThresholdChip } from './primitives'
import type { Provenance } from '../types'

const SOURCES: { name: string; use: string; href: string }[] = [
  { name: 'NASA-STD-3001 Vol. 1 Rev. C', use: 'Limits with IDs: [V1 4003], [V1 4020], [V1 4024], [V1 4027], [V1 4030]', href: 'https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf' },
  { name: 'NASA DONKI / CCMC', use: 'Live flares and solar particle events, fetched by the server only', href: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/' },
  { name: 'NASA OSDR / GeneLab', use: 'Public space biology studies shown as explanatory context per system, fetched by the server only', href: 'https://osdr.nasa.gov/bio/' },
  { name: 'NASA Human Research Program', use: 'Countermeasure protocols and evidence by system', href: 'https://www.nasa.gov/humans-in-space/counteracting-bone-and-muscle-loss-in-microgravity/' },
  { name: 'Human adaptation to spaceflight: the role of nutrition', use: 'Vitamin D 800 IU/day, ISS standard since 2006', href: 'https://www.nasa.gov/wp-content/uploads/2024/10/human-adaptation-to-spaceflight-the-role-of-nutrition.pdf' },
  { name: 'Z-Anatomy / Shandon’s Body Atlas', use: '3D anatomy in six layers, CC BY-SA 4.0', href: 'https://github.com/ryanjardine95/shandons-body-atlas' },
  { name: 'Microsoft Rocketbox avatars', use: 'Faces and hair of the four crew members: generic characters that depict no real person (MIT license). Only the head was kept and fitted to the body', href: 'https://github.com/microsoft/Microsoft-Rocketbox' },
  { name: 'NASA 3D Resources: Z-2 spacesuit', use: 'EVA suit model, public domain. Textures reduced, flag, NASA insignia and baked dirt removed; re-posed and fitted per astronaut at load', href: 'https://github.com/nasa/NASA-3D-Resources' },
  { name: 'Solar System Scope textures', use: 'Mars and the Milky Way seen from the window, CC BY 4.0, based on NASA and ESA data', href: 'https://www.solarsystemscope.com/textures/' },
  { name: 'Poly Haven', use: 'Studio lighting HDRI and fabric and paint textures, CC0', href: 'https://polyhaven.com/' },
]

const CALIBRATIONS: { label: string; value: string; source: string; href: string }[] = [
  { label: 'Cruise radiation dose', value: '1.8 mSv/day', source: 'RAD instrument, Mars Science Laboratory cruise (SwRI)', href: 'https://www.swri.org/newsroom/press-releases/swri-led-team-calculates-the-radiation-exposure-associated-trip-mars' },
  { label: 'Lower-limb bone loss', value: '−0.8% per month', source: 'Stavnichuk et al., 2020, npj Microgravity', href: 'https://www.nature.com/articles/s41526-020-0103-2' },
  { label: 'Height gain from spine lengthening', value: 'up to 3%', source: 'NTRS 20090007782', href: 'https://ntrs.nasa.gov/citations/20090007782' },
  { label: 'Exercise adherence on the ISS', value: 'T2 47%, CEVIS 37% of days', source: 'NASA HRP evidence report', href: 'https://ntrs.nasa.gov/api/citations/20220019338/downloads/Evidence%20report%20aerobic%20and%20muscle_FINAL%209-21-22%20Pubpress%20accepted_v2.pdf' },
  { label: 'Earth link delay', value: `${LINK_DELAY_MIN}–22 min, conjunction blackout of 2–3 weeks`, source: 'Mars mission communication geometry', href: 'https://www.nasa.gov/' },
]

const COVERAGE: { id: string; text: string; where: string }[] = [
  { id: 'RF-01', text: 'Seven systems plus radiation, each tied to an instrument that has flown', where: 'System screen, Source row' },
  { id: 'RF-02', text: 'Every value against the individual pre-flight baseline', where: 'Every number, and the dashed chart line' },
  { id: 'RF-03', text: 'Manual measurement entry by the astronaut', where: 'Metric → Log a measurement' },
  { id: 'RF-04', text: 'Queue of pending measurements', where: 'Body → Today’s queue' },
  { id: 'RF-05', text: 'Deterministic three-level status engine', where: 'src/engine/status.ts, with tests' },
  { id: 'RF-06', text: 'Linear projection over 30 days', where: 'Metric chart and statistics' },
  { id: 'RF-07', text: 'One catalog action per screen, with its protocol cited', where: 'Action cards' },
  { id: 'RF-08', text: 'Provenance badge on every number', where: 'Badges beside values' },
  { id: 'RF-09', text: 'Threshold chip with NASA ID or “Provisional”', where: 'Metric rows and Metric screen' },
  { id: 'RF-10', text: 'Plain-language mechanism', where: 'System details and Metric facts' },
  { id: 'RF-11', text: 'How and why to take each measurement', where: 'Log screen' },
  { id: 'RF-12', text: 'Evolution chart per indicator', where: 'Metric screen' },
  { id: 'RF-13', text: 'Autonomous mode by default, with blackout simulation', where: 'Link chip and Menu → Simulation' },
  { id: 'RF-14', text: 'Clickable body map', where: 'Click any region of the 3D body' },
  { id: 'RF-15', text: 'Flag what goes to the flight surgeon', where: 'Metric → Flag, and the Packet screen' },
  { id: 'RF-16', text: 'Decision diary with timestamp, status snapshot and the autonomous mark in blackout', where: 'Menu → Decision diary' },
  { id: 'RF-17', text: 'Handover packet for the flight surgeon', where: 'Menu → Flight surgeon packet' },
  { id: 'RF-18', text: 'AI explanation layer with a rule-checked fallback', where: 'System → How it works (AI explanation or Offline explanation)' },
  { id: 'RF-19', text: 'Live space weather feed (NASA DONKI), with a stored sample as fallback', where: 'Radiation → How it works, LIVE or SAMPLE seal' },
  { id: 'RF-20', text: 'Graceful degradation: no error on screen when a feed, storage or the face model fails', where: 'Partial: no fallback yet when WebGL is unavailable' },
  { id: 'RF-21', text: 'Crew Medical Officer as patient: the consult goes to the backup CMO', where: 'Aiko Sato, any critical system' },
  { id: 'RF-22', text: 'Scenario controls: mission day, solar event, Earth link', where: 'Menu → Simulation' },
  { id: 'RF-23', text: 'Streak of days with the day’s action done', where: 'Body → Today, and Decision diary' },
  { id: 'RF-24', text: 'Camera input: pulse from a fingertip over the lens', where: 'Resting heart rate → Check with camera' },
  { id: 'RF-25', text: 'Crew status across the whole mission', where: 'Menu → Crew timeline' },
  { id: 'RF-26', text: 'Space biology studies from NASA OSDR', where: 'System → How it works' },
  { id: 'RF-27', text: 'Outcome of each action: system status then and now', where: 'Decision diary' },
]

const PROVS = Object.keys(PROVENANCE_HELP) as Provenance[]

export function SourcesScreen() {
  return (
    <main className="sources">
      <div className="sources-inner">
        <h1 className="label">Sources and data</h1>
        <p className="lede">Every number in Orbitalis says whether it was measured, estimated or logged, which instrument produced it, and which limit it is judged by.</p>

        <section aria-labelledby="prov-h">
          <h2 id="prov-h" className="label">Provenance seals</h2>
          <ul className="prov-legend">
            {PROVS.map((p) => (
              <li key={p}><ProvenanceBadge kind={p} /> <span className="small">{PROVENANCE_HELP[p]}</span></li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="metrics-h">
          <h2 id="metrics-h" className="label">All indicators</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>System</th><th>Indicator</th><th>Seal</th><th>Instrument</th><th>Limit</th></tr>
              </thead>
              <tbody>
                {SYSTEM_IDS.flatMap((s) =>
                  SYSTEMS[s].metrics.map((id, i) => {
                    const m = METRICS[id]
                    return (
                      <tr key={id}>
                        <td>{i === 0 ? SYSTEMS[s].name : ''}</td>
                        <td>{m.label}</td>
                        <td><ProvenanceBadge kind={m.provenance} /></td>
                        <td className="small">{m.instrument}<br /><span className="muted">{m.heritage}</span></td>
                        <td><ThresholdChip threshold={m.threshold} /></td>
                      </tr>
                    )
                  }),
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="src-h">
          <h2 id="src-h" className="label">Official sources</h2>
          <ul className="srclist">
            {SOURCES.map((s) => (
              <li key={s.name}><a href={s.href} target="_blank" rel="noreferrer">{s.name}</a><span className="small muted">{s.use}</span></li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="cal-h">
          <h2 id="cal-h" className="label">Calibrations with a source</h2>
          <ul className="srclist">
            {CALIBRATIONS.map((c) => (
              <li key={c.label}>
                <span><strong>{c.label}</strong> <span className="mono">{c.value}</span></span>
                <a className="small" href={c.href} target="_blank" rel="noreferrer">{c.source}</a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="decl-h">
          <h2 id="decl-h" className="label">Declarations</h2>
          <ul className="decl small">
            <li>The crew is fictional. Apart from the calibrations above, all physiological signals are synthetic and illustrative.</li>
            <li>Status is computed by deterministic code and never by AI. Explanations are written by an AI model only when the server has an API key, from numbers the code computed. The model picks actions by ID from the closed catalog, and its text is rejected if it adds a number, names a medication or diagnosis, or breaks the length limits. Without a key, or on any failure, the fixed catalog text is shown, marked “Offline explanation”.</li>
            <li>Actions come from a closed catalog. The app gives no diagnosis, medication or dose.</li>
            <li>Prototype assumption, not a published value: outside the hull only the EVA suit shields you, modeled as twice the 1.8 mSv/day measured inside a spacecraft. Replace it with the mission’s own dosimetry.</li>
            <li>The characters, their hair, eyes, skin and uniforms, the suit and the habitat are drawn for this prototype. The anatomical body is a male atlas model; the two women use reshaped proportions, not a female anatomy model.</li>
            <li>Each body reflects the day’s measurements: limbs thin as strength and exercise fall below plan, the build follows body mass, and short sleep shows as shadows under the eyes. This is a drawing aid. It never sets a status.</li>
            <li>{ATTRIBUTION}</li>
          </ul>
        </section>

        <section aria-labelledby="cov-h">
          <h2 id="cov-h" className="label">Required features and where to find them</h2>
          <ul className="coverage">
            {COVERAGE.map((c) => (
              <li key={c.id}><span className="mono muted">{c.id}</span><span>{c.text}</span><span className="small muted">{c.where}</span></li>
            ))}
          </ul>
        </section>
        <a className="btn" href={paths.crew}>Back to crew</a>
      </div>
    </main>
  )
}
