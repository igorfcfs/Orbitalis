import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Rota de servidor para o clima espacial (spec: chamadas externas só no servidor).
 * Busca flares e eventos de partículas solares do DONKI/CCMC, sem chave, com timeout.
 * Falha → 502, e o cliente mostra a amostra com o selo SAMPLE.
 */
function spaceWeather(): Plugin {
  const handler = async (_req: unknown, res: import('node:http').ServerResponse) => {
    try {
      const end = new Date()
      const start = new Date(end.getTime() - 30 * 86_400_000)
      const q = `startDate=${iso(start)}&endDate=${iso(end)}`
      const get = async (kind: 'FLR' | 'SEP') => {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 5000)
        try {
          const r = await fetch(`https://ccmc.gsfc.nasa.gov/DONKI-API/get/${kind}?${q}`, { signal: ctrl.signal })
          if (!r.ok) throw new Error(String(r.status))
          const body = await r.json()
          return Array.isArray(body) ? body : []
        } finally {
          clearTimeout(timer)
        }
      }
      const [flr, sep] = await Promise.all([get('FLR'), get('SEP')])
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ fetchedAt: new Date().toISOString(), flares: flr, sep }))
    } catch {
      res.statusCode = 502
      res.end('{"error":"unavailable"}')
    }
  }
  return {
    name: 'space-weather',
    configureServer: (s) => void s.middlewares.use('/api/space-weather', handler),
    configurePreviewServer: (s) => void s.middlewares.use('/api/space-weather', handler),
  }
}

export default defineConfig({ plugins: [react(), spaceWeather()] })
