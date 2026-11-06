import type { MetricDef } from '../types'

/** RF-32: o aparelho que produz o dado, em uma linha curta, para a tela onde o astronauta decide medir.
 *  Só instrumentos reais (CLAUDE.md §5); o que nenhum aparelho mede a bordo diz isso em vez de inventar um. */
export function deviceLine(m: Pick<MetricDef, 'provenance' | 'instrument'>): string {
  if (m.provenance === 'ESTIMATED') return 'Not measured on board · estimated'
  if (m.provenance === 'CONTINUOUS') return `${m.instrument} · worn, automatic`
  return m.instrument
}
