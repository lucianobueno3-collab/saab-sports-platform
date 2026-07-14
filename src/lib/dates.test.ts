import { describe, it, expect } from 'vitest'
import { todayLocalISO, toLocalISO, daysFromToday } from './dates'

describe('toLocalISO', () => {
  it('usa o fuso local, não UTC (21h em UTC-3 ainda é hoje)', () => {
    // 2026-07-14 21:00 local: toISOString() daria 2026-07-15 em UTC-3
    const d = new Date(2026, 6, 14, 21, 0, 0)
    expect(toLocalISO(d)).toBe('2026-07-14')
  })

  it('formata com zero à esquerda', () => {
    expect(toLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('daysFromToday', () => {
  it('hoje = 0', () => {
    expect(daysFromToday(todayLocalISO())).toBe(0)
  })

  it('amanhã = 1, ontem = -1', () => {
    const t = new Date(todayLocalISO() + 'T00:00:00')
    const tomorrow = new Date(t); tomorrow.setDate(t.getDate() + 1)
    const yesterday = new Date(t); yesterday.setDate(t.getDate() - 1)
    expect(daysFromToday(toLocalISO(tomorrow))).toBe(1)
    expect(daysFromToday(toLocalISO(yesterday))).toBe(-1)
  })
})
