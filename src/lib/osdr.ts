import { useEffect, useState } from 'react'
import type { SystemId } from '../types'

/**
 * Camada molecular do OSDR/GeneLab (RF-26): estudos públicos de biologia espacial ligados a cada sistema.
 * É contexto explicativo: não entra no motor de status nem alimenta nenhum número do app.
 */

export interface Study {
  id: string
  title: string
  organism: string
  /** 'Spaceflight Study' | 'Ground Study' */
  kind: string
  /** Ano de liberação pública; 0 quando o registro não traz */
  year: number
}

export interface StudyFeed {
  /** true: busca real ao OSDR. false: amostra guardada (selo SAMPLE) */
  live: boolean
  studies: Study[]
}

export const studyUrl = (id: string) => `https://osdr.nasa.gov/bio/repo/data/studies/${encodeURIComponent(id)}`

// Amostra usada quando a rota não responde: estudos reais do OSDR, rotulados SAMPLE na tela.
const SAMPLE: Partial<Record<SystemId, Study[]>> = {
  skeletal: [
    { id: 'OSD-342', title: 'Targeting myostatin/activin A protects against skeletal muscle and bone loss during spaceflight', organism: 'Mus musculus', kind: 'Spaceflight study', year: 2020 },
    { id: 'OSD-396', title: 'Gene-metabolite networks associated with impediment of bone fracture repair in spaceflight', organism: 'Mus musculus', kind: 'Spaceflight study', year: 2021 },
  ],
  cardiovascular: [{ id: 'OSD-599', title: 'Transcriptomic effects on the mouse heart following 30 days on the International Space Station', organism: 'Mus musculus', kind: 'Spaceflight study', year: 2024 }],
  neuro_ocular: [{ id: 'OSD-397', title: 'RNA-seq and RRBS sequencing on spaceflight mouse retina', organism: 'Mus musculus', kind: 'Spaceflight study', year: 2021 }],
}

const cache = new Map<SystemId, Promise<StudyFeed>>()

function fetchStudies(system: SystemId): Promise<StudyFeed> {
  let p = cache.get(system)
  if (!p) {
    p = (async () => {
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 8000)
        const r = await fetch(`/api/osdr?system=${system}`, { signal: ctrl.signal })
        clearTimeout(timer)
        if (!r.ok) throw new Error(String(r.status))
        const j = (await r.json()) as { studies: Study[] }
        return { live: true, studies: j.studies.slice(0, 3) }
      } catch {
        return { live: false, studies: SAMPLE[system] ?? [] }
      }
    })()
    cache.set(system, p)
  }
  return p
}

/** Nunca lança erro para a tela: sem rota, devolve a amostra. */
export function useStudies(system: SystemId): StudyFeed {
  const [feed, setFeed] = useState<StudyFeed>({ live: false, studies: SAMPLE[system] ?? [] })
  useEffect(() => {
    let alive = true
    setFeed({ live: false, studies: SAMPLE[system] ?? [] })
    void fetchStudies(system).then((f) => alive && setFeed(f))
    return () => {
      alive = false
    }
  }, [system])
  return feed
}
