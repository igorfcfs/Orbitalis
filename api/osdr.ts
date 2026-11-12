import { OSDR_TERMS, searchStudies } from '../src/server/osdr'
import type { SystemId } from '../src/types'

// Função da Vercel: só termos da lista, nunca texto do cliente. Falha → 502 (o cliente mostra a amostra, selo SAMPLE).
export async function GET(request: Request): Promise<Response> {
  const system = new URL(request.url).searchParams.get('system') ?? ''
  if (!(system in OSDR_TERMS)) return Response.json({ error: 'unknown system' }, { status: 400 })
  try {
    const studies = await searchStudies(system as SystemId)
    return Response.json({ fetchedAt: new Date().toISOString(), studies })
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 502 })
  }
}
