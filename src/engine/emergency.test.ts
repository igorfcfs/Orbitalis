import { describe, expect, it } from 'vitest'
import { ACTIONS, EMERGENCY_IDS } from '../data/actions'
import { ASTRONAUTS } from '../data/astronauts'
import { emergencyPacketLines, emergencySignals, emergencySteps, packetText } from '../lib/model'
import { CATEGORY_STEPS, EMPTY_ANSWERS, missingAnswers, triage, type EmergencyAnswers, type EmergencySession } from './emergency'

const ans = (p: Partial<EmergencyAnswers>): EmergencyAnswers => ({ ...EMPTY_ANSWERS, injury: 'no', onset: '1to5', ...p })
const sim = { day: 142, solar: false, suit: false, link: 'blackout' as const, measurements: [] }
const session = (a: EmergencyAnswers, patientId = 'aiko'): EmergencySession => ({
  patientId, reporterId: 'daniel', answers: a, startedTs: '2026-11-02T10:00:00.000Z', startedDay: 142, link: 'blackout', done: {},
})

describe('RF-29 triagem por regras', () => {
  it('sem resposta decisiva, sem categoria', () => {
    expect(triage(EMPTY_ANSWERS)).toBeNull()
    expect(triage(ans({ responds: 'no' }))).toBeNull()
    expect(triage(ans({ responds: 'yes', collapsed: 'no' }))).toBeNull()
  })
  it('não responde e não respira normalmente: parada; "não sei" conta como parada', () => {
    for (const b of ['none', 'gasping', 'unknown'] as const) expect(triage(ans({ responds: 'no', breathing: b }))).toEqual({ category: 'arrest', status: 'critical' })
  })
  it('não responde mas respira: inconsciente respirando', () => expect(triage(ans({ responds: 'no', breathing: 'normal' }))?.category).toBe('unconscious'))
  it('responde com dor no peito: dor no peito, mesmo depois de desmaiar', () => {
    expect(triage(ans({ responds: 'yes', collapsed: 'no', prior: 'chest_pain' }))?.category).toBe('chest_pain')
    expect(triage(ans({ responds: 'yes', collapsed: 'yes', prior: 'chest_pain' }))?.category).toBe('chest_pain')
  })
  it('desmaiou sem dor no peito: síncope; sem nada: avaliação geral em WATCH', () => {
    expect(triage(ans({ responds: 'yes', collapsed: 'yes', prior: 'dizzy' }))?.category).toBe('syncope')
    expect(triage(ans({ responds: 'yes', collapsed: 'no', prior: 'nothing' }))).toEqual({ category: 'general', status: 'watch' })
  })
  it('missingAnswers lista só o que falta', () => {
    expect(missingAnswers(EMPTY_ANSWERS)).toEqual(['responds', 'injury', 'onset'])
    expect(missingAnswers(ans({ responds: 'no' }))).toEqual(['breathing'])
  })
})

describe('RF-28 catálogo de emergência', () => {
  const all = Object.values(CATEGORY_STEPS).flat()
  it('toda ação das categorias existe no catálogo fechado', () => {
    for (const id of all) expect(ACTIONS[id], id).toBeDefined()
    expect(EMERGENCY_IDS).toHaveLength(11)
  })
  it('toda ação cita protocolo ou diz "No protocol cited"', () => {
    for (const id of EMERGENCY_IDS) expect(ACTIONS[id].protocol.length).toBeGreaterThan(0)
  })
  it('nenhuma ação cita medicamento, dose ou diagnóstico', () => {
    const bad = /\b(mg|mcg|aspirin|epinephrine|adrenaline|amiodarone|nitroglycerin|drug|medication|dose|diagnos\w*|infarction|arrhythmia)\b/i
    for (const id of EMERGENCY_IDS) expect(`${ACTIONS[id].label} ${ACTIONS[id].protocol}`).not.toMatch(bad)
  })
  it('a parada vem na ordem do catálogo, com a RCP antes do desfibrilador', () => {
    const steps = CATEGORY_STEPS.arrest
    expect(steps.indexOf('EMG-CPR')).toBeLessThan(steps.indexOf('EMG-AED'))
    expect(steps[0]).toBe('EMG-SAFE')
  })
  it('paciente CMO: a consulta vira a do CMO reserva', () => {
    const aiko = ASTRONAUTS.find((a) => a.id === 'aiko')!
    const lena = ASTRONAUTS.find((a) => a.id === 'lena')!
    const s = (id: string) => session(ans({ responds: 'no', breathing: 'none' }), id)
    expect(emergencySteps(aiko, s('aiko')).find((x) => x.id === 'CMO-CONSULT')!.label).toBe('Consult the backup CMO')
    expect(emergencySteps(lena, s('lena')).find((x) => x.id === 'CMO-CONSULT')!.label).toBe('Consult the Crew Medical Officer')
  })
})

describe('RF-29 o que o registro mostra', () => {
  it('Aiko no dia 142: sono crítico aparece e nada aponta para o coração', () => {
    const aiko = ASTRONAUTS.find((a) => a.id === 'aiko')!
    const sig = emergencySignals(aiko, sim)
    expect(sig.metrics.some((m) => m.id === 'sleep' && m.status === 'critical')).toBe(true)
    expect(sig.cardiacClear).toBe(true)
    expect(sig.metrics.some((m) => m.id === 'rhr')).toBe(true)
  })
  it('a linha do tempo entra no pacote e não nomeia causa', () => {
    const aiko = ASTRONAUTS.find((a) => a.id === 'aiko')!
    const s = { ...session(ans({ responds: 'no', breathing: 'gasping' })), done: { 'EMG-CPR': { ts: '2026-11-02T10:01:00.000Z', day: 142, autonomous: true } } }
    const text = packetText(aiko, sim, {}, [], s)
    expect(text).toContain('Emergency timeline')
    expect(text).toContain('Cardiorespiratory arrest protocol')
    expect(text).toContain('EMG-CPR')
    expect(text).toContain('autonomous')
    expect(emergencyPacketLines(aiko, s).join('\n')).toContain('No cause was named')
    expect(packetText(aiko, sim, {}, [], session(EMPTY_ANSWERS))).not.toContain('Emergency timeline')
  })
})
