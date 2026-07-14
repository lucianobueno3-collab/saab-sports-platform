// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { calcIMC } from './nutricao-tab'

describe('calcIMC', () => {
  it('bate com a avaliação física real (1,91m)', () => {
    expect(calcIMC(119.4, 191)).toBeCloseTo(32.73, 2)
    expect(calcIMC(114.5, 191)).toBeCloseTo(31.39, 2)
    expect(calcIMC(109.4, 191)).toBeCloseTo(29.99, 2)
    expect(calcIMC(108.1, 191)).toBeCloseTo(29.63, 2)
  })

  it('retorna null sem peso ou altura', () => {
    expect(calcIMC(null, 191)).toBeNull()
    expect(calcIMC(80, null)).toBeNull()
    expect(calcIMC(80, 0)).toBeNull()
  })
})
