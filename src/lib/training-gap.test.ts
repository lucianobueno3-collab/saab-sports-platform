import { describe, it, expect } from 'vitest'
import { trainingGap, trainingGapLabel } from './training-gap'

const NOW = new Date('2026-07-15T12:00:00Z')

function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 3600000).toISOString()
}

describe('trainingGap', () => {
  it('não sinaliza treino recente (12h atrás)', () => {
    const g = trainingGap(hoursAgo(12), NOW)
    expect(g.flagged).toBe(false)
    expect(g.daysSince).toBe(0)
  })

  it('não sinaliza exatamente em 48h', () => {
    expect(trainingGap(hoursAgo(48), NOW).flagged).toBe(false)
  })

  it('sinaliza logo após 48h', () => {
    const g = trainingGap(hoursAgo(49), NOW)
    expect(g.flagged).toBe(true)
    expect(g.daysSince).toBe(2)
  })

  it('sinaliza gaps longos com contagem de dias', () => {
    const g = trainingGap(hoursAgo(24 * 6), NOW)
    expect(g.flagged).toBe(true)
    expect(g.daysSince).toBe(6)
  })

  it('sinaliza quando nunca houve treino na janela', () => {
    const g = trainingGap(null, NOW)
    expect(g.flagged).toBe(true)
    expect(g.hoursSince).toBeNull()
    expect(g.daysSince).toBeNull()
  })

  it('sinaliza data inválida como sem treino', () => {
    expect(trainingGap('not-a-date', NOW).flagged).toBe(true)
  })
})

describe('trainingGapLabel', () => {
  it('vazio quando não sinalizado', () => {
    expect(trainingGapLabel(trainingGap(hoursAgo(2), NOW))).toBe('')
  })

  it('mensagem de 48h para gaps de até 2 dias', () => {
    expect(trainingGapLabel(trainingGap(hoursAgo(50), NOW))).toBe('Sem treino registrado nas últimas 48h')
  })

  it('mensagem com dias para gaps longos', () => {
    expect(trainingGapLabel(trainingGap(hoursAgo(24 * 5), NOW))).toBe('Sem treino registrado há 5 dias')
  })

  it('mensagem própria quando não há treino na janela', () => {
    expect(trainingGapLabel(trainingGap(null, NOW))).toBe('Nenhum treino registrado nos últimos 30 dias')
  })
})
