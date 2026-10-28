import { useEffect, useState } from 'react'

export interface FlareEvent {
  classType: string
  peakTime: string
}

export interface Feed {
  /** true: dado real do DONKI. false: amostra armazenada, declarada como SAMPLE. */
  live: boolean
  fetchedAt: string
  flares: FlareEvent[]
  sepCount: number
}

// Amostra ilustrativa usada quando o feed não responde. Nunca é apresentada como LIVE.
const SAMPLE: Feed = {
  live: false,
  fetchedAt: '',
  sepCount: 0,
  flares: [
    { classType: 'C8.6', peakTime: '2026-09-30T02:46Z' },
    { classType: 'M1.2', peakTime: '2026-10-04T06:19Z' },
  ],
}

let promise: Promise<Feed> | null = null

function fetchFeed(): Promise<Feed> {
  promise ??= (async () => {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const r = await fetch('/api/space-weather', { signal: ctrl.signal })
      clearTimeout(timer)
      if (!r.ok) throw new Error(String(r.status))
      const j = (await r.json()) as { fetchedAt: string; flares: FlareEvent[]; sep: unknown[] }
      return { live: true, fetchedAt: j.fetchedAt, flares: j.flares.slice(-5), sepCount: j.sep.length }
    } catch {
      return SAMPLE
    }
  })()
  return promise
}

/** Nunca lança erro para a tela: sem feed, devolve a amostra. */
export function useFeed(): Feed {
  const [feed, setFeed] = useState<Feed>(SAMPLE)
  useEffect(() => {
    let alive = true
    void fetchFeed().then((f) => alive && setFeed(f))
    return () => {
      alive = false
    }
  }, [])
  return feed
}
