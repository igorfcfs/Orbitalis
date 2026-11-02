import { AI_TIMEOUT_MS, EXPLAIN_SCHEMA, LIMITS, validateExplanation, type ExplainInput, type Explanation } from '../lib/explain'

/**
 * Só roda no servidor (middleware do Vite). A chave de API vem do ambiente do servidor e nunca chega ao cliente.
 * Falha de rede, timeout, resposta fora do esquema ou texto reprovado na validação: devolve null, e o cliente usa o texto de reserva.
 */

const SYSTEM_PROMPT = [
  'You write short plain-English explanations for an astronaut health app. You are given numbers already computed by code.',
  'Rules: never change or question the status; never invent a number, use only numbers present in the input;',
  'never name a medication, dose, diagnosis or procedure; choose actions only by ID from allowedActions;',
  `summary at most ${LIMITS.summary} words, mechanism at most ${LIMITS.mechanism} words, each action reason at most ${LIMITS.reason} words.`,
  'Choose at most two actions. If the status is nominal, choose none.',
].join(' ')

export interface ServerEnv {
  apiKey?: string
  model?: string
}

/** Confere a forma da entrada vinda do cliente antes de mandá-la ao modelo. */
export function parseInput(body: unknown): ExplainInput | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Partial<ExplainInput>
  const okStatus = (s: unknown) => s === 'nominal' || s === 'watch' || s === 'critical'
  if (typeof b.systemId !== 'string' || typeof b.systemName !== 'string' || !okStatus(b.status) || typeof b.day !== 'number') return null
  if (b.link !== 'delayed' && b.link !== 'blackout') return null
  if (!Array.isArray(b.metrics) || b.metrics.length > 3 || !Array.isArray(b.allowedActions) || b.allowedActions.length > 6) return null
  const strs = (o: object, keys: string[]) => keys.every((k) => typeof (o as Record<string, unknown>)[k] === 'string')
  if (!b.metrics.every((m) => m && strs(m, ['id', 'label', 'value', 'unit', 'baseline', 'reason']) && okStatus(m.status))) return null
  if (!b.allowedActions.every((a) => a && strs(a, ['id', 'label']))) return null
  return b as ExplainInput
}

export async function requestExplanation(
  input: ExplainInput,
  env: ServerEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Explanation | null> {
  if (!env.apiKey) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS)
  try {
    const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': env.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: env.model || 'claude-haiku-5-5',
        max_tokens: 700,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(input) }],
        tools: [{ name: 'explain', description: 'Return the explanation for this system.', input_schema: EXPLAIN_SCHEMA }],
        tool_choice: { type: 'tool', name: 'explain' },
      }),
    })
    if (!r.ok) return null
    const j = (await r.json()) as { content?: { type: string; input?: unknown }[] }
    const tool = j.content?.find((c) => c.type === 'tool_use')
    return validateExplanation(tool?.input, input)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
