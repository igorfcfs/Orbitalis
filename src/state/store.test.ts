import { beforeEach, describe, expect, it } from 'vitest'
import { ATLAS_LAYERS, DEFAULT_LAYERS, useStore } from './store'

const st = () => useStore.getState()

describe('raio-X e camadas do atlas', () => {
  beforeEach(() => useStore.setState({ xray: false, layers: [], hoverLayer: null }))

  it('o raio-X mostra todos os sistemas de uma vez, sem precisar abrir um a um', () => {
    st().setXray(true)
    expect(st().xray).toBe(true)
    expect(st().layers).toEqual(DEFAULT_LAYERS)
    expect(st().layers).toHaveLength(5)
    expect(new Set(st().layers)).toEqual(new Set(ATLAS_LAYERS))
  })

  it('desligar o raio-X esconde todas as camadas', () => {
    st().setXray(true)
    st().setXray(false)
    expect(st().xray).toBe(false)
    expect(st().layers).toEqual([])
  })

  it('cada sistema liga e desliga sozinho, e o raio-X acompanha', () => {
    st().toggleLayer('nerves')
    expect(st().layers).toEqual(['nerves'])
    expect(st().xray).toBe(true)
    st().toggleLayer('muscles')
    expect(st().layers).toEqual(['nerves', 'muscles'])
    st().toggleLayer('nerves')
    st().toggleLayer('muscles')
    expect(st().layers).toEqual([])
    expect(st().xray).toBe(false)
  })

  it('com todos ligados, tirar um deixa os outros quatro', () => {
    st().setXray(true)
    st().toggleLayer('muscles')
    expect(st().layers).not.toContain('muscles')
    expect(st().layers).toHaveLength(4)
    expect(st().xray).toBe(true)
  })

  it('All systems liga ou desliga os cinco de uma vez', () => {
    st().setAllLayers(true)
    expect(st().layers).toHaveLength(5)
    expect(st().xray).toBe(true)
    st().setAllLayers(false)
    expect(st().layers).toEqual([])
    expect(st().xray).toBe(false)
  })

  it('o sistema sob o cursor no painel é guardado e depois limpo', () => {
    st().setHoverLayer('vessels')
    expect(st().hoverLayer).toBe('vessels')
    st().setHoverLayer(null)
    expect(st().hoverLayer).toBeNull()
  })
})
