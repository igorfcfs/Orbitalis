import { useEffect, useMemo, useState } from 'react'
import { SYSTEMS } from '../data/systems'
import type { Astronaut, Sim, SystemId } from '../types'
import { AI_TIMEOUT_MS, explainKey, validateExplanation, type ExplainInput, type Explanation } from './explain'
import { fmt, shortUnit, systemActions, systemMetrics, systemStatus } from './model'

export interface ShownExplanation extends Explanation {
  /** ai: redigido pelo modelo e aprovado na validação. offline: texto de reserva do catálogo */
  source: 'ai' | 'offline'
}

/** Entrada da IA: só números que o código já calculou, e as ações permitidas (catálogo fechado). */
export function buildExplainInput(astro: Astronaut, system: SystemId, sim: Sim): ExplainInput {
  const def = SYSTEMS[system]
  const status = systemStatus(astro, system, sim)
  const allowed = new Map<string, string>()
  for (const a of systemActions(astro, system, sim)) allowed.set(a.id, a.label)
  allowed.set('CMO-CONSULT', astro.isCMO ? 'Consult the backup CMO' : 'Consult the Crew Medical Officer')
  allowed.set('EARTH-PACKET', 'Add to the flight surgeon packet')
  return {
    systemId: system,
    systemName: def.name,
    status,
    day: sim.day,
    link: sim.link,
    metrics: systemMetrics(astro, system, sim).map((m) => ({
      id: m.id, label: m.label, value: fmt(m.value, m.decimals), unit: shortUnit(m.unit), baseline: fmt(m.baseline, m.decimals),
      status: m.status, reason: m.eval.reason,
    })),
    allowedActions: [...allowed].map(([id, label]) => ({ id, label })),
  }
}

/** Texto de reserva: o do catálogo, sem justificativa de ação. */
export function offlineExplanation(system: SystemId, status: ExplainInput['status'], solar: boolean): ShownExplanation {
  const def = SYSTEMS[system]
  return { source: 'offline', summary: def.summary[solar && system === 'radiation' ? 'critical' : status], mechanism: def.mechanism, actions: [] }
}

// Cache por (astronauta, sistema, dia, link): a mesma pergunta não volta ao servidor.
const cache = new Map<string, Promise<Explanation | null>>()

async function ask(input: ExplainInput): Promise<Explanation | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS)
    const r = await fetch('/api/explain', {
      method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
    })
    clearTimeout(timer)
    if (!r.ok) return null
    const j = (await r.json()) as { explanation?: unknown }
    return validateExplanation(j.explanation, input)
  } catch {
    return null
  }
}

/**
 * Explicação do sistema. Começa no texto de reserva e só troca se o servidor devolver uma resposta aprovada na validação.
 * Nunca lança erro para a tela. Durante o evento solar simulado não pede à IA: a ação é fixa (RAD-SHELTER).
 */
export function useExplanation(astro: Astronaut, system: SystemId, sim: Sim): ShownExplanation {
  const input = useMemo(() => buildExplainInput(astro, system, sim), [astro, system, sim])
  const key = explainKey(astro.id, input)
  const fallback = useMemo(() => offlineExplanation(system, input.status, sim.solar), [system, input.status, sim.solar])
  const [ai, setAi] = useState<{ key: string; value: Explanation } | null>(null)
  useEffect(() => {
    if (sim.solar) return
    let alive = true
    let p = cache.get(key)
    if (!p) {
      p = ask(input)
      cache.set(key, p)
    }
    void p.then((e) => alive && e && setAi({ key, value: e }))
    return () => {
      alive = false
    }
    // input muda com as medições, mas o cache é por (astronauta, sistema, dia, link, status), como pede a spec
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sim.solar])
  return !sim.solar && ai?.key === key ? { source: 'ai', ...ai.value } : fallback
}
