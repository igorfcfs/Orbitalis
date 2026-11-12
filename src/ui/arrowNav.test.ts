import { describe, expect, it } from 'vitest'
import { nextIndex } from './arrowNav'

describe('arrowNav', () => {
  it('as setas andam um item e não dão a volta', () => {
    expect(nextIndex(2, 8, 'ArrowDown')).toBe(3)
    expect(nextIndex(2, 8, 'ArrowRight')).toBe(3)
    expect(nextIndex(2, 8, 'ArrowUp')).toBe(1)
    expect(nextIndex(0, 8, 'ArrowUp')).toBe(0)
    expect(nextIndex(7, 8, 'ArrowDown')).toBe(7)
  })
  it('Home e End vão às pontas', () => {
    expect(nextIndex(4, 8, 'Home')).toBe(0)
    expect(nextIndex(4, 8, 'End')).toBe(7)
  })
  it('outras teclas e lista vazia são ignoradas', () => {
    expect(nextIndex(1, 8, 'Enter')).toBeNull()
    expect(nextIndex(0, 0, 'ArrowDown')).toBeNull()
  })
})
