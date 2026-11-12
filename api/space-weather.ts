import { fetchSpaceWeather } from '../src/server/spaceWeather'

// Função da Vercel: mesma lógica do middleware do Vite. Falha → 502, e o cliente mostra a amostra com o selo SAMPLE.
export async function GET(): Promise<Response> {
  try {
    return Response.json(await fetchSpaceWeather())
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 502 })
  }
}
