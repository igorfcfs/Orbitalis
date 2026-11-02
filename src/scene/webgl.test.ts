import { describe, expect, it } from 'vitest'
import { webglAvailable } from './webgl'
import { SceneBoundary } from './SafeStage'

describe('RF-20 cena 3D opcional', () => {
  it('WebGL disponível', () => expect(webglAvailable(() => ({ getContext: (id) => (id === 'webgl2' ? {} : null) }))).toBe(true))
  it('cai para webgl1 se não houver webgl2', () => expect(webglAvailable(() => ({ getContext: (id) => (id === 'webgl' ? {} : null) }))).toBe(true))
  it('sem contexto, sem WebGL', () => expect(webglAvailable(() => ({ getContext: () => null }))).toBe(false))
  it('exceção na criação conta como sem WebGL', () => expect(webglAvailable(() => { throw new Error('no dom') })).toBe(false))
  it('o ErrorBoundary entra em modo de falha ao receber um erro', () => expect(SceneBoundary.getDerivedStateFromError()).toEqual({ failed: true }))
})
