import type { Study } from '../lib/osdr'
import type { SystemId } from '../types'

// Só no servidor (middleware do Vite): a busca ao OSDR passa por aqui e aceita só estes termos.

/** Termo de busca por sistema. Fica aqui para o servidor aceitar só estes e não virar um proxy aberto. */
export const OSDR_TERMS: Record<SystemId, string> = {
  cardiovascular: 'cardiovascular spaceflight',
  skeletal: 'bone loss spaceflight',
  muscular: 'muscle atrophy spaceflight',
  neuro_ocular: 'spaceflight associated neuro-ocular syndrome',
  immune: 'immune spaceflight',
  nutrition: 'metabolism nutrition spaceflight',
  behavior: 'sleep circadian spaceflight',
  radiation: 'space radiation spaceflight',
}

/** Reduz um registro bruto do OSDR ao que a tela usa. */
export function toStudy(src: Record<string, unknown>): Study | null {
  const id = String(src['Accession'] ?? '')
  const title = String(src['Study Title'] ?? '')
  if (!/^OSD-\d+$/.test(id) || !title) return null
  const ts = Number(src['Study Public Release Date'])
  return {
    id,
    title: title.length > 140 ? `${title.slice(0, 137)}...` : title,
    organism: String(src['organism'] ?? '').split(/\s{2,}/)[0],
    kind: /spaceflight/i.test(String(src['Project Type'] ?? '')) ? 'Spaceflight study' : 'Ground study',
    year: ts > 0 ? new Date(ts * 1000).getUTCFullYear() : 0,
  }
}


export async function searchStudies(system: SystemId, fetchImpl: typeof fetch = fetch): Promise<Study[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const q = new URLSearchParams({ term: OSDR_TERMS[system], size: '6', type: 'cgene' })
    const r = await fetchImpl(`https://osdr.nasa.gov/osdr/data/search?${q}`, { signal: ctrl.signal })
    if (!r.ok) throw new Error(String(r.status))
    const j = (await r.json()) as { hits?: { hits?: { _source?: Record<string, unknown> }[] } }
    const all = (j.hits?.hits ?? []).map((h) => toStudy(h._source ?? {})).filter((x): x is Study => x !== null)
    // Estudos de voo primeiro: são os que falam do ambiente que o astronauta vive
    return [...all.filter((x) => x.kind === 'Spaceflight study'), ...all.filter((x) => x.kind !== 'Spaceflight study')].slice(0, 3)
  } finally {
    clearTimeout(timer)
  }
}
