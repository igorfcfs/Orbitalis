import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { OSDR_TERMS, searchStudies } from './src/server/osdr'
import { parseInput, requestExplanation, type ServerEnv } from './src/server/explain'
import type { SystemId } from './src/types'

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

/**
 * Camada molecular (RF-26): estudos públicos do OSDR/GeneLab por sistema. Só termos da lista, nunca texto do cliente.
 * Falha → 502, e o cliente mostra a amostra com o selo SAMPLE.
 */
function osdr(): Plugin {
  const handler = async (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
    try {
      const system = new URL(req.url ?? '', 'http://x').searchParams.get('system') ?? ''
      if (!(system in OSDR_TERMS)) {
        res.statusCode = 400
        res.end('{"error":"unknown system"}')
        return
      }
      const studies = await searchStudies(system as SystemId)
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ fetchedAt: new Date().toISOString(), studies }))
    } catch {
      res.statusCode = 502
      res.end('{"error":"unavailable"}')
    }
  }
  return {
    name: 'osdr',
    configureServer: (s) => void s.middlewares.use('/api/osdr', handler),
    configurePreviewServer: (s) => void s.middlewares.use('/api/osdr', handler),
  }
}

/**
 * Camada explicativa por IA (RF-18). A chave (ANTHROPIC_API_KEY, sem prefixo VITE_) só existe aqui no servidor.
 * Sem chave, falha, timeout de 8 s ou resposta reprovada na validação → 503, e o cliente usa o texto de reserva.
 */
function explain(): Plugin {
  let env: ServerEnv = {}
  const handler = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
    const fail = (code: number) => {
      res.statusCode = code
      res.end('{"error":"unavailable"}')
    }
    if (req.method !== 'POST') return fail(405)
    let body = ''
    req.on('data', (c) => {
      body += c
      if (body.length > 20_000) req.destroy()
    })
    req.on('end', async () => {
      try {
        const input = parseInput(JSON.parse(body))
        if (!input) return fail(400)
        const explanation = await requestExplanation(input, env)
        if (!explanation) return fail(503)
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ explanation }))
      } catch {
        fail(503)
      }
    })
  }
  return {
    name: 'explain',
    configResolved(c) {
      const e = loadEnv(c.mode, c.root, '')
      env = { apiKey: e.ANTHROPIC_API_KEY, model: e.ORBITALIS_MODEL }
    },
    configureServer: (s) => void s.middlewares.use('/api/explain', handler),
    configurePreviewServer: (s) => void s.middlewares.use('/api/explain', handler),
  }
}

export default defineConfig({ plugins: [react(), spaceWeather(), osdr(), explain()] })
