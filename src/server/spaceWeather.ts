// Clima espacial do DONKI/CCMC (sem chave). Só roda no servidor: o middleware do Vite e a função da Vercel chamam esta mesma função.
const iso = (d: Date) => d.toISOString().slice(0, 10)

export interface SpaceWeatherPayload {
  fetchedAt: string
  flares: unknown[]
  sep: unknown[]
}

/** Últimos 30 dias de flares (FLR) e eventos de partículas solares (SEP). Falha ou timeout de 5 s → lança erro. */
export async function fetchSpaceWeather(fetchImpl: typeof fetch = fetch): Promise<SpaceWeatherPayload> {
  const end = new Date()
  const start = new Date(end.getTime() - 30 * 86_400_000)
  const q = `startDate=${iso(start)}&endDate=${iso(end)}`
  const get = async (kind: 'FLR' | 'SEP') => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    try {
      const r = await fetchImpl(`https://ccmc.gsfc.nasa.gov/DONKI-API/get/${kind}?${q}`, { signal: ctrl.signal })
      if (!r.ok) throw new Error(String(r.status))
      const body = await r.json()
      return Array.isArray(body) ? body : []
    } finally {
      clearTimeout(timer)
    }
  }
  const [flares, sep] = await Promise.all([get('FLR'), get('SEP')])
  return { fetchedAt: new Date().toISOString(), flares, sep }
}
