import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_ANSWERS, type EmergencySession } from '../engine/emergency'
import { getAstronaut } from '../lib/model'

// O zustand lê o estado inicial na renderização no servidor: o teste troca a loja por um estado fixo
let sessions: Record<string, EmergencySession> = {}
vi.mock('../state/store', () => ({
  useStore: (sel: (s: unknown) => unknown) =>
    sel({ emergencies: sessions, openEmergency: () => {}, answerEmergency: () => {}, doneEmergencyStep: () => {}, closeEmergency: () => {} }),
}))

const { EmergencyPanel } = await import('./Emergency')
const sim = { day: 142, solar: false, suit: false, link: 'blackout' as const, measurements: [] }
const make = (patientId: string, answers: Partial<EmergencySession['answers']>, link: 'delayed' | 'blackout'): EmergencySession => ({
  patientId, reporterId: 'daniel', startedTs: '2026-11-02T10:00:00.000Z', startedDay: 142, link, done: {}, answers: { ...EMPTY_ANSWERS, ...answers },
})

describe('RF-29 tela de emergência', () => {
  it('com as respostas, mostra categoria, sinais do registro e os passos em ordem, sem nomear causa', () => {
    sessions = { aiko: make('aiko', { responds: 'no', breathing: 'gasping', injury: 'no', onset: '1to5' }, 'blackout') }
    const html = renderToString(<EmergencyPanel astro={getAstronaut('aiko')} sim={sim} />)
    expect(html).toContain('Cardiorespiratory arrest protocol')
    expect(html).toContain('CRITICAL')
    expect(html).toContain('Start chest compressions')
    expect(html).toContain('Consult the backup CMO')
    expect(html).toContain('Sleep')
    expect(html).toContain('Nothing in the record points to a cause')
    expect(html.indexOf('EMG-CPR')).toBeLessThan(html.indexOf('EMG-AED'))
    expect(html).not.toMatch(/infarction|diagnos(is|ed)/i)
  })
  it('sem respostas decisivas, pede a primeira e não lista passos', () => {
    sessions = { lena: make('lena', {}, 'delayed') }
    const html = renderToString(<EmergencyPanel astro={getAstronaut('lena')} sim={{ ...sim, link: 'delayed' }} />)
    expect(html).toContain('Answer the first question')
    expect(html).not.toContain('EMG-')
  })
})
