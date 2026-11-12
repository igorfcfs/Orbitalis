import { describe, expect, it } from 'vitest'
import { clientKey, createLimiter } from './rateLimit'

describe('limite da rota de IA', () => {
  it('barra o excesso na janela e libera depois dela', () => {
    const l = createLimiter(3, 1000)
    expect([0, 1, 2].map((t) => l.allow('a', t))).toEqual([true, true, true])
    expect(l.allow('a', 500)).toBe(false)
    expect(l.allow('a', 1100)).toBe(true)
  })
  it('conta cada origem separadamente', () => {
    const l = createLimiter(1, 1000)
    expect(l.allow('a', 0)).toBe(true)
    expect(l.allow('b', 0)).toBe(true)
    expect(l.allow('a', 1)).toBe(false)
  })
  it('usa o primeiro IP de x-forwarded-for', () => {
    expect(clientKey('203.0.113.5, 10.0.0.1')).toBe('203.0.113.5')
    expect(clientKey(undefined)).toBe('unknown')
  })
})
