/**
 * Camada explicativa por IA (RF-18): contrato e validação, compartilhados entre o servidor e o cliente.
 * A IA só redige texto sobre números que o código já calculou. Ela nunca define status, nunca cria número
 * e só escolhe ações do catálogo fechado, por ID. Qualquer desvio descarta a resposta inteira.
 */

export interface ExplainMetric {
  id: string
  label: string
  /** Já formatado como o astronauta vê */
  value: string
  unit: string
  baseline: string
  status: 'nominal' | 'watch' | 'critical'
  reason: string
}

export interface ExplainInput {
  systemId: string
  systemName: string
  status: 'nominal' | 'watch' | 'critical'
  day: number
  link: 'delayed' | 'blackout'
  metrics: ExplainMetric[]
  /** Ações permitidas do sistema, mais CMO-CONSULT e EARTH-PACKET */
  allowedActions: { id: string; label: string }[]
}

export interface Explanation {
  summary: string
  mechanism: string
  actions: { id: string; reason: string }[]
}

export const LIMITS = { summary: 22, mechanism: 45, reason: 18, maxActions: 2 } as const
export const AI_TIMEOUT_MS = 8000

/** Esquema da resposta (usado como input_schema da ferramenta no servidor) */
export const EXPLAIN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: `One sentence, at most ${LIMITS.summary} words, on how this system is doing.` },
    mechanism: { type: 'string', description: `At most ${LIMITS.mechanism} words: why spaceflight affects this system.` },
    actions: {
      type: 'array',
      maxItems: LIMITS.maxActions,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'An ID from allowedActions, copied exactly.' },
          reason: { type: 'string', description: `At most ${LIMITS.reason} words on why this action fits.` },
        },
        required: ['id', 'reason'],
      },
    },
  },
  required: ['summary', 'mechanism', 'actions'],
} as const

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const numbersIn = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)

/** Termos que a IA nunca pode usar: medicamento, dose, diagnóstico (regra 3). */
export const FORBIDDEN = /\b(diagnos\w*|prescri\w*|medicat\w*|medicine|tablets?|pills?|\d+\s?(mg|mcg|ml|iu)\b|ibuprofen|aspirin|antibiotic\w*|steroid\w*)\b/i

/** Números que o texto da IA pode citar: só os que estão na entrada. */
export function allowedNumbers(input: ExplainInput): Set<number> {
  const text = [
    String(input.day), input.systemName,
    ...input.metrics.flatMap((m) => [m.label, m.value, m.baseline, m.reason, m.unit]),
    ...input.allowedActions.map((a) => a.label),
  ].join(' ')
  return new Set(numbersIn(text))
}

/** Valida uma resposta bruta. Devolve a explicação limpa ou null se qualquer regra for violada. */
export function validateExplanation(raw: unknown, input: ExplainInput): Explanation | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.summary !== 'string' || typeof r.mechanism !== 'string' || !Array.isArray(r.actions)) return null
  const summary = r.summary.trim()
  const mechanism = r.mechanism.trim()
  if (!summary || !mechanism || words(summary) > LIMITS.summary || words(mechanism) > LIMITS.mechanism) return null
  if (r.actions.length > LIMITS.maxActions) return null
  const allowedIds = new Set(input.allowedActions.map((a) => a.id))
  const actions: Explanation['actions'] = []
  for (const a of r.actions) {
    if (!a || typeof a !== 'object') return null
    const { id, reason } = a as Record<string, unknown>
    if (typeof id !== 'string' || typeof reason !== 'string' || !allowedIds.has(id)) return null
    if (!reason.trim() || words(reason) > LIMITS.reason) return null
    actions.push({ id, reason: reason.trim() })
  }
  const texts = [summary, mechanism, ...actions.map((a) => a.reason)]
  if (texts.some((t) => FORBIDDEN.test(t))) return null
  const ok = allowedNumbers(input)
  if (texts.some((t) => numbersIn(t).some((n) => !ok.has(n)))) return null
  return { summary, mechanism, actions }
}

/** Chave do cache: a mesma pergunta não é refeita (astronauta, sistema, dia, link). */
export const explainKey = (astroId: string, input: ExplainInput) => `${astroId}:${input.systemId}:${input.day}:${input.link}:${input.status}`
