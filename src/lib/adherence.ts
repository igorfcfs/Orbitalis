import type { Astronaut, Decision, Sim, Status } from '../types'
import { systemStatus } from './model'

/** Dias da missão em que o astronauta marcou ao menos uma ação como feita. */
function doneDays(diary: Decision[], astroId: string): Set<number> {
  return new Set(diary.filter((d) => d.astronautId === astroId && d.decision === 'done').map((d) => d.missionDay))
}

export interface Streak {
  /** Dias seguidos com a ação feita, terminando hoje (ou ontem, se hoje ainda não foi feita) */
  current: number
  best: number
  doneToday: boolean
}

/**
 * Sequência de adesão (RF-23): dias consecutivos da missão com a ação do dia feita.
 * Sai só do diário, sem pontos nem ranking. Hoje ainda aberto não quebra a sequência.
 */
export function adherenceStreak(diary: Decision[], astroId: string, day: number): Streak {
  const days = doneDays(diary, astroId)
  const doneToday = days.has(day)
  let current = 0
  for (let d = doneToday ? day : day - 1; days.has(d); d--) current++
  let best = 0
  let run = 0
  for (const d of [...days].sort((a, b) => a - b)) {
    run = days.has(d - 1) ? run + 1 : 1
    best = Math.max(best, run)
  }
  return { current, best, doneToday }
}

const RANK: Record<Status, number> = { nominal: 0, watch: 1, critical: 2 }

export interface Outcome {
  /** pending: ainda não passou um dia da decisão; none: adiada, não há desfecho a medir */
  kind: 'improved' | 'unchanged' | 'worsened' | 'pending' | 'none'
  from: Status
  /** Status atual do sistema, calculado pelo motor (nunca pela IA) */
  to: Status
}

/**
 * Desfecho da ação (RF-27): compara o status do sistema no momento da decisão com o status de hoje.
 * É só leitura do motor determinístico; não afirma que a ação causou a mudança.
 */
export function decisionOutcome(d: Decision, astro: Astronaut, sim: Sim): Outcome {
  const to = systemStatus(astro, d.systemId, sim)
  if (d.decision !== 'done') return { kind: 'none', from: d.statusSnapshot, to }
  if (sim.day <= d.missionDay) return { kind: 'pending', from: d.statusSnapshot, to }
  const diff = RANK[to] - RANK[d.statusSnapshot]
  return { kind: diff < 0 ? 'improved' : diff > 0 ? 'worsened' : 'unchanged', from: d.statusSnapshot, to }
}

export const OUTCOME_LABEL: Record<Outcome['kind'], string> = {
  improved: 'Improved',
  unchanged: 'No change yet',
  worsened: 'Worsened',
  pending: 'Check tomorrow',
  none: '',
}
