import type { Status } from '../types'

/**
 * Triagem de emergência por regras (RF-29), código puro e determinístico, que funciona em blackout.
 * Entrada fechada (sem texto livre) → categoria de protocolo → ações do catálogo fechado, em ordem (RF-28).
 * Não nomeia causa, não diagnostica e não sugere medicamento: a regra 3 vale também na emergência.
 */

export type Yes = 'yes' | 'no'
export type Breathing = 'normal' | 'none' | 'gasping' | 'unknown'
export type Prior = 'chest_pain' | 'breathless' | 'dizzy' | 'headache' | 'vision' | 'nothing' | 'unknown'
export type Onset = 'lt1' | '1to5' | 'gt5'

export interface EmergencyAnswers {
  responds: Yes | null
  breathing: Breathing | null
  collapsed: Yes | null
  prior: Prior | null
  injury: Yes | null
  onset: Onset | null
}

export const EMPTY_ANSWERS: EmergencyAnswers = { responds: null, breathing: null, collapsed: null, prior: null, injury: null, onset: null }

export type EmergencyCategory = 'arrest' | 'unconscious' | 'chest_pain' | 'syncope' | 'general'

export const CATEGORY_LABEL: Record<EmergencyCategory, string> = {
  arrest: 'Cardiorespiratory arrest protocol',
  unconscious: 'Unresponsive, breathing protocol',
  chest_pain: 'Chest pain protocol',
  syncope: 'Fainting protocol',
  general: 'General assessment',
}

/** Ações de cada categoria, na ordem em que aparecem (catálogo do RF-28). */
export const CATEGORY_STEPS: Record<EmergencyCategory, string[]> = {
  arrest: ['EMG-SAFE', 'EMG-HELP', 'EMG-CHECK', 'EMG-RESTRAIN', 'EMG-CPR', 'EMG-AED', 'CMO-CONSULT', 'EMG-GROUND', 'EMG-LOG'],
  unconscious: ['EMG-SAFE', 'EMG-HELP', 'EMG-CHECK', 'EMG-RESTRAIN', 'EMG-MONITOR', 'EMG-STANDBY', 'CMO-CONSULT', 'EMG-GROUND', 'EMG-LOG'],
  chest_pain: ['EMG-REST', 'EMG-MONITOR', 'EMG-STANDBY', 'CMO-CONSULT', 'EMG-GROUND', 'EMG-LOG'],
  syncope: ['EMG-REST', 'EMG-MONITOR', 'CMO-CONSULT', 'EMG-GROUND', 'EMG-LOG'],
  general: ['EMG-MONITOR', 'CMO-CONSULT', 'EMG-LOG'],
}

export interface Triage {
  category: EmergencyCategory
  /** Status da emergência, por regra: nunca decidido por IA */
  status: Status
}

/**
 * Classifica as respostas. Devolve null enquanto faltar resposta para decidir.
 * "Não sei" sobre a respiração conta como respiração anormal: na dúvida, trata-se como parada (AHA 2025 Part 7).
 */
export function triage(a: EmergencyAnswers): Triage | null {
  if (a.responds === null) return null
  if (a.responds === 'no') {
    if (a.breathing === null) return null
    return { category: a.breathing === 'normal' ? 'unconscious' : 'arrest', status: 'critical' }
  }
  if (a.collapsed === null || a.prior === null) return null
  // Dor no peito antes do desmaio sobe a categoria
  if (a.prior === 'chest_pain') return { category: 'chest_pain', status: 'critical' }
  if (a.collapsed === 'yes') return { category: 'syncope', status: 'critical' }
  return { category: 'general', status: 'watch' }
}

/** O que falta responder, para a tela dizer. */
export function missingAnswers(a: EmergencyAnswers): (keyof EmergencyAnswers)[] {
  const need: (keyof EmergencyAnswers)[] = ['responds']
  if (a.responds === 'no') need.push('breathing')
  if (a.responds === 'yes') need.push('collapsed', 'prior')
  need.push('injury', 'onset')
  return need.filter((k) => a[k] === null)
}

export interface EmergencySession {
  patientId: string
  /** Quem socorre e informa (lista fechada de tripulantes) */
  reporterId: string | null
  answers: EmergencyAnswers
  startedTs: string
  startedDay: number
  link: 'delayed' | 'blackout'
  /** Ações marcadas como feitas, com carimbo de tempo */
  done: Record<string, { ts: string; day: number; autonomous: boolean }>
}
