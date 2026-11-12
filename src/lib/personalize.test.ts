import { describe, expect, it, vi } from 'vitest'
import { ASTRONAUTS } from '../data/astronauts'
import { FINDINGS, PROFILE_STUDIES } from '../data/profile'
import { METRICS, SYSTEM_IDS } from '../data/systems'
import type { Astronaut, Sim } from '../types'
import { FORBIDDEN } from './explain'
import {
  astronautStatus, packetText, priorityAction, resolveMetric, systemActions, systemStatus,
} from './model'
import { collectedText, contextFor, profileFindings, profilePacketLines, systemFindings } from './personalize'
import { buildExplainInput } from './useExplanation'

const sim: Sim = { day: 142, solar: false, suit: false, link: 'delayed', measurements: [] }
const bare = (a: Astronaut): Astronaut => ({ ...a, profile: undefined })

describe('RF-34 o perfil nunca toca o motor', () => {
  it('status, limiar, projeção e ação idênticos com e sem perfil, nos quatro astronautas, no dia 142', async () => {
    // resolveMetric guarda o resultado pelo id do astronauta: o lado sem perfil roda num módulo novo, com o cache vazio.
    vi.resetModules()
    const fresh = await import('./model')
    for (const a of ASTRONAUTS) {
      expect(a.profile).toBeDefined()
      const b = bare(a)
      expect(fresh.astronautStatus(b, sim)).toBe(astronautStatus(a, sim))
      expect(fresh.priorityAction(b, sim)?.action?.id).toBe(priorityAction(a, sim)?.action?.id)
      for (const s of SYSTEM_IDS) {
        expect(fresh.systemStatus(b, s, sim)).toBe(systemStatus(a, s, sim))
        expect(fresh.systemActions(b, s, sim).map((x) => x.id)).toEqual(systemActions(a, s, sim).map((x) => x.id))
      }
      for (const id of Object.keys(METRICS)) {
        const [m, n] = [resolveMetric(a, id, sim), fresh.resolveMetric(b, id, sim)]
        expect(n).not.toBe(m)
        expect(n.status).toBe(m.status)
        expect(n.threshold).toEqual(m.threshold)
        expect(n.eval.projected).toBe(m.eval.projected)
      }
    }
  })
  it('a explicação por IA não recebe o perfil', () => {
    const input = JSON.stringify(buildExplainInput(ASTRONAUTS[3], 'neuro_ocular', sim))
    for (const f of Object.values(FINDINGS)) expect(input).not.toContain(f.id)
    expect(input).not.toMatch(/profile|MTRR|PER3|methylation/i)
  })
})

describe('RF-34 escolher e ordenar, nunca criar', () => {
  const by = (id: string) => ASTRONAUTS.find((a) => a.id === id)!
  it('a mesma métrica mostra notas diferentes para perfis diferentes', () => {
    const temp = ASTRONAUTS.map((a) => contextFor(a, 'temp').map((f) => f.id).join())
    expect(new Set(temp).size).toBeGreaterThan(1)
    expect(contextFor(by('daniel'), 'disc').map((f) => f.id)).toEqual(['sans-onecarbon'])
    expect(contextFor(by('lena'), 'disc')).toEqual([])
  })
  it('ordena pela ligação com a métrica (a métrica principal do achado vem antes)', () => {
    const a = { ...by('lena'), profile: { collectedDay: -120, findings: ['atopy', 'latent-herpes'] } }
    expect(contextFor(a, 'temp').map((f) => f.id)).toEqual(['atopy', 'latent-herpes'])
    expect(contextFor(a, 'lymph').map((f) => f.id)).toEqual(['latent-herpes'])
    expect(contextFor(a, 'wbc').map((f) => f.id)).toEqual(['atopy', 'latent-herpes'])
  })
  it('sem perfil, ou com ID fora do catálogo, nada aparece e nada quebra', () => {
    const none = bare(by('aiko'))
    expect(contextFor(none, 'sleep')).toEqual([])
    expect(systemFindings(none, 'behavior')).toEqual([])
    expect(profilePacketLines(none, ['behavior'])).toEqual([])
    const odd = { ...by('aiko'), profile: { collectedDay: -90, findings: ['made-up', 'per3-long'] } }
    expect(profileFindings(odd).map((f) => f.id)).toEqual(['per3-long'])
  })
  it('o catálogo só cita estudos da lista, só aponta para métricas e sistemas que existem e não diagnostica', () => {
    for (const f of Object.values(FINDINGS)) {
      expect(f.studies.length).toBeGreaterThan(0)
      for (const s of f.studies) expect(PROFILE_STUDIES[s]).toBeDefined()
      for (const m of f.metrics) expect(METRICS[m]).toBeDefined()
      for (const s of f.systems) expect(SYSTEM_IDS).toContain(s)
      expect(f.metrics.every((m) => f.systems.includes(METRICS[m].system))).toBe(true)
      expect(`${f.label} ${f.note}`).not.toMatch(FORBIDDEN)
      expect(f.note.split(/\s+/).length).toBeLessThanOrEqual(45)
    }
    for (const a of ASTRONAUTS) for (const id of a.profile!.findings) expect(FINDINGS[id]).toBeDefined()
  })
  it('a coleta é de terra, antes do voo, e diz isso', () => {
    expect(collectedText({ collectedDay: -120, findings: [] })).toBe('Collected on the ground 120 days before launch. Not measured in orbit.')
  })
})

describe('RF-34 pacote do flight surgeon', () => {
  const daniel = ASTRONAUTS.find((a) => a.id === 'daniel')!
  it('leva só os achados dos sistemas que já estão no pacote', () => {
    const lines = profilePacketLines(daniel, ['neuro_ocular']).join('\n')
    expect(lines).toContain('MTRR 66 G')
    expect(lines).toContain('doi:10.1096/fj.15-278457')
    expect(lines).not.toContain('herpes')
    expect(profilePacketLines(daniel, ['skeletal'])).toEqual([])
  })
  it('aparece no texto do pacote quando um item do sistema está nele', () => {
    const flagged = packetText(daniel, sim, { 'daniel:disc': true }, [])
    expect(flagged).toContain('Pre-flight profile linked to the items above')
    expect(packetText(daniel, sim, {}, [])).not.toContain('Pre-flight profile')
  })
})
