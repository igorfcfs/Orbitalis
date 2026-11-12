import { parseInput, requestExplanation } from '../src/server/explain'
import { clientKey, createLimiter } from '../src/server/rateLimit'

// Função da Vercel (RF-18). A chave ANTHROPIC_API_KEY só existe aqui, nas variáveis de ambiente do projeto.
// Sem chave, falha, limite excedido ou resposta reprovada na validação → erro, e o cliente usa o texto de reserva.
// O ambiente da função é Node; só o que se lê aqui é declarado, sem puxar @types/node.
declare const process: { env: Record<string, string | undefined> }

const limiter = createLimiter()
const fail = (status: number) => Response.json({ error: 'unavailable' }, { status })

export async function POST(request: Request): Promise<Response> {
  if (!limiter.allow(clientKey(request.headers.get('x-forwarded-for')))) return fail(429)
  const raw = await request.text()
  if (raw.length > 20_000) return fail(413)
  try {
    const input = parseInput(JSON.parse(raw))
    if (!input) return fail(400)
    const explanation = await requestExplanation(input, { apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ORBITALIS_MODEL })
    return explanation ? Response.json({ explanation }) : fail(503)
  } catch {
    return fail(503)
  }
}
