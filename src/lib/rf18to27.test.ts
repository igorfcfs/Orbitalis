import { describe, expect, it } from 'vitest'
import { ASTRONAUTS } from '../data/astronauts'
import { courseOf } from '../ui/Timeline'
import { adherenceStreak, decisionOutcome } from './adherence'
import { validateExplanation, type ExplainInput } from './explain'
import { MISSION_DAY } from './model'
import { MIN_QUALITY, estimateBpm } from './ppg'
import { parseInput, requestExplanation } from '../server/explain'
import { toStudy } from '../server/osdr'
import type { Decision, Sim } from '../types'

const input: ExplainInput = {
  systemId: 'behavior', systemName: 'Sleep & Behavior', status: 'critical', day: 142, link: 'delayed',
  metrics: [{ id: 'sleep', label: 'Sleep', value: '5.3', unit: 'h', baseline: '7.4', status: 'critical', reason: 'Sleep 5.3 h is below 6 h.' }],
  allowedActions: [{ id: 'SLP-EXT', label: 'Protect an 8-hour sleep window' }, { id: 'CMO-CONSULT', label: 'Consult' }],
}
const good = { summary: 'Sleep is 5.3 h, well below your 7.4 h pre-flight level.', mechanism: 'Isolation and shifting light disturb the sleep cycle.', actions: [{ id: 'SLP-EXT', reason: 'Protects recovery sleep tonight.' }] }

describe('RF-18 validação da explicação por IA', () => {
  it('aceita uma resposta dentro das regras', () => expect(validateExplanation(good, input)).toEqual(good))
  it('rejeita ação fora da lista permitida', () => expect(validateExplanation({ ...good, actions: [{ id: 'NUT-D', reason: 'x' }] }, input)).toBeNull())
  it('rejeita número que não está na entrada', () => expect(validateExplanation({ ...good, summary: 'Sleep fell to 4.1 h.' }, input)).toBeNull())
  it('rejeita medicamento, dose e diagnóstico', () => {
    expect(validateExplanation({ ...good, mechanism: 'Consider melatonin tablets.' }, input)).toBeNull()
    expect(validateExplanation({ ...good, mechanism: 'This looks like a diagnosis of insomnia.' }, input)).toBeNull()
    expect(validateExplanation({ ...good, mechanism: 'Take 5 mg tonight.' }, input)).toBeNull()
  })
  it('rejeita textos acima do limite de palavras', () => expect(validateExplanation({ ...good, summary: Array(30).fill('sleep').join(' ') }, input)).toBeNull())
  it('rejeita formato inválido', () => expect(validateExplanation({ summary: 1 }, input)).toBeNull())
})

describe('RF-18 servidor', () => {
  const reply = (content: unknown) => (async () => ({ ok: true, json: async () => ({ content }) })) as unknown as typeof fetch
  it('sem chave não chama o modelo', async () => {
    let called = false
    const f = (async () => { called = true; return { ok: true } }) as unknown as typeof fetch
    expect(await requestExplanation(input, {}, f)).toBeNull()
    expect(called).toBe(false)
  })
  it('devolve a resposta aprovada e manda temperatura 0.2 com ferramenta forçada', async () => {
    let sent: Record<string, unknown> = {}
    const f = (async (_u: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body))
      return { ok: true, json: async () => ({ content: [{ type: 'tool_use', input: good }] }) }
    }) as unknown as typeof fetch
    expect(await requestExplanation(input, { apiKey: 'k' }, f)).toEqual(good)
    expect(sent.temperature).toBe(0.2)
    expect(sent.tool_choice).toEqual({ type: 'tool', name: 'explain' })
  })
  it('descarta resposta reprovada e erro de rede', async () => {
    expect(await requestExplanation(input, { apiKey: 'k' }, reply([{ type: 'tool_use', input: { ...good, summary: 'Sleep fell to 4.1 h.' } }]))).toBeNull()
    const boom = (async () => { throw new Error('net') }) as unknown as typeof fetch
    expect(await requestExplanation(input, { apiKey: 'k' }, boom)).toBeNull()
  })
  it('parseInput recusa forma inválida', () => {
    expect(parseInput(input)).not.toBeNull()
    expect(parseInput({ ...input, status: 'fine' })).toBeNull()
    expect(parseInput(null)).toBeNull()
  })
})

const dec = (day: number, kind: Decision['decision'] = 'done', status: Decision['statusSnapshot'] = 'watch', sys: Decision['systemId'] = 'skeletal'): Decision => ({
  id: `${day}${kind}`, ts: '', missionDay: day, astronautId: 'rafael', systemId: sys, actionId: 'EX-RES', decision: kind, linkState: 'delayed', statusSnapshot: status, autonomous: false,
})

describe('RF-23 sequência de adesão', () => {
  it('conta dias seguidos terminando hoje', () => {
    expect(adherenceStreak([dec(140), dec(141), dec(142)], 'rafael', 142)).toEqual({ current: 3, best: 3, doneToday: true })
  })
  it('hoje em aberto não quebra a sequência', () => expect(adherenceStreak([dec(140), dec(141)], 'rafael', 142).current).toBe(2))
  it('um dia sem ação quebra a sequência mas guarda a melhor', () => {
    const s = adherenceStreak([dec(130), dec(131), dec(132), dec(140)], 'rafael', 141)
    expect(s.current).toBe(1)
    expect(s.best).toBe(3)
  })
  it('adiar não conta, e outro astronauta não entra', () => {
    expect(adherenceStreak([dec(142, 'snoozed')], 'rafael', 142).current).toBe(0)
    expect(adherenceStreak([dec(142)], 'lena', 142).current).toBe(0)
  })
})

describe('RF-27 desfecho da ação', () => {
  const astro = ASTRONAUTS.find((a) => a.id === 'rafael')!
  const sim = (day: number): Sim => ({ day, solar: false, suit: false, link: 'delayed', measurements: [] })
  it('é pendente no próprio dia da decisão', () => expect(decisionOutcome(dec(MISSION_DAY), astro, sim(MISSION_DAY)).kind).toBe('pending'))
  it('adiada não tem desfecho', () => expect(decisionOutcome(dec(100, 'snoozed'), astro, sim(MISSION_DAY)).kind).toBe('none'))
  it('compara o status do sistema na decisão com o de hoje, pelo motor', () => {
    const now = decisionOutcome(dec(100, 'done', 'watch'), astro, sim(MISSION_DAY))
    expect(now.to).toBe('watch')
    expect(now.kind).toBe('unchanged')
    expect(decisionOutcome(dec(100, 'done', 'critical'), astro, sim(MISSION_DAY)).kind).toBe('improved')
    expect(decisionOutcome(dec(100, 'done', 'nominal'), astro, sim(MISSION_DAY)).kind).toBe('worsened')
  })
})

describe('RF-25 visão temporal', () => {
  it('a faixa reproduz o motor no dia 140 e acha o primeiro dia fora do nominal', () => {
    const c = courseOf(ASTRONAUTS.find((a) => a.id === 'aiko')!, { link: 'delayed', measurements: [] })
    expect(c.statuses.find((s) => s.day === 140)!.status).toBe('critical')
    expect(c.firstWatch).not.toBeNull()
    expect(c.firstWatch!).toBeLessThanOrEqual(c.firstCritical!)
  })
})

describe('RF-24 pulso pela câmera', () => {
  const synth = (bpm: number, fps: number, seconds: number, noise = 0) =>
    Array.from({ length: Math.round(fps * seconds) }, (_, i) => 150 + 3 * Math.sin((2 * Math.PI * (bpm / 60) * i) / fps) + noise * Math.sin(i * 12.9898) * 2 + i * 0.01)
  it('recupera a frequência de um sinal limpo', () => {
    const r = estimateBpm(synth(72, 30, 15), 30)!
    expect(r.bpm).toBeGreaterThan(70)
    expect(r.bpm).toBeLessThan(74)
    expect(r.quality).toBeGreaterThan(MIN_QUALITY)
  })
  it('tolera ruído e tendência lenta', () => expect(Math.abs(estimateBpm(synth(58, 30, 15, 0.4), 30)!.bpm - 58)).toBeLessThan(3))
  it('recusa sinal curto ou plano', () => {
    expect(estimateBpm(synth(72, 30, 3), 30)).toBeNull()
    expect(estimateBpm(Array(450).fill(150), 30)).toBeNull()
  })
})

describe('RF-26 OSDR', () => {
  it('reduz o registro bruto e recusa o que não é um estudo', () => {
    const s = toStudy({ Accession: 'OSD-342', 'Study Title': 'Bone loss', 'Project Type': 'Spaceflight Study', organism: 'Mus musculus', 'Study Public Release Date': 1600214400 })
    expect(s).toMatchObject({ id: 'OSD-342', kind: 'Spaceflight study', year: 2020, organism: 'Mus musculus' })
    expect(toStudy({ Accession: 'x', 'Study Title': 'y' })).toBeNull()
  })
})
