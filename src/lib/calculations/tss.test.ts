import { describe, it, expect } from 'vitest'
import { calcActivityTss, ftpForSport, hrTss, lthrForSport, powerTss } from './tss'

describe('powerTss', () => {
  it('bate com o exemplo real do TrainingPeaks (corrida Stryd da Talita)', () => {
    // 41:36, NP 172W, FTP corrida 181W → TP mostra IF 0.95, TSS 63
    const r = powerTss(41 * 60 + 36, 172, 181)
    expect(r.intensityFactor).toBeCloseTo(0.95, 2)
    expect(r.tss).toBeGreaterThanOrEqual(62)
    expect(r.tss).toBeLessThanOrEqual(64)
    expect(r.method).toBe('power')
  })

  it('1 hora exatamente no FTP = 100 TSS', () => {
    const r = powerTss(3600, 250, 250)
    expect(r.tss).toBe(100)
    expect(r.intensityFactor).toBe(1)
  })
})

describe('hrTss', () => {
  it('bate com o exemplo real do TP (natação da Talita)', () => {
    // 15:59, FC média 131, LTHR natação ~175 → TP mostra IF 0.75, TSS 16 (usa 16min)
    const r = hrTss(16 * 60, 131, 175)
    expect(r.intensityFactor).toBeCloseTo(0.75, 2)
    expect(r.tss).toBeGreaterThanOrEqual(14)
    expect(r.tss).toBeLessThanOrEqual(16)
    expect(r.method).toBe('hr')
  })

  it('limita o IF a 1.15 quando a FC passa do LTHR', () => {
    // FC 200 com LTHR 160 daria IF 1.25 — deve usar 1.15 no cálculo
    const r = hrTss(3600, 200, 160)
    expect(r.tss).toBe(Math.round(1.15 * 1.15 * 100))
  })
})

describe('lthrForSport', () => {
  const t = { lthrBike: 165, lthrRun: 170, lthrSwim: 155, lthrGeneric: 160 }

  it('escolhe o LTHR do esporte', () => {
    expect(lthrForSport('swimming', t)).toBe(155)
    expect(lthrForSport('running', t)).toBe(170)
    expect(lthrForSport('cycling', t)).toBe(165)
  })

  it('usa o genérico quando o específico não existe', () => {
    const only = { lthrGeneric: 160 }
    expect(lthrForSport('swimming', only)).toBe(160)
    expect(lthrForSport('running', only)).toBe(160)
    expect(lthrForSport('cycling', only)).toBe(160)
  })

  it('retorna null sem nenhum LTHR', () => {
    expect(lthrForSport('running', {})).toBeNull()
  })
})

describe('ftpForSport', () => {
  it('corrida usa ftpRun, nunca o FTP de ciclismo', () => {
    expect(ftpForSport('running', { ftp: 160, ftpRun: 181 })).toBe(181)
    // sem ftpRun, corrida NÃO cai no FTP de bike (evita TSS errado)
    expect(ftpForSport('running', { ftp: 160 })).toBeNull()
  })

  it('ciclismo usa ftp', () => {
    expect(ftpForSport('cycling', { ftp: 160, ftpRun: 181 })).toBe(160)
  })
})

describe('calcActivityTss', () => {
  const thresholds = { ftp: 160, ftpRun: 181, lthrBike: 165, lthrRun: 170, lthrSwim: 155 }

  it('prefere potência quando há NP e FTP do esporte', () => {
    const r = calcActivityTss({ sport: 'running', durationSeconds: 2496, np: 172, avgHr: 130, thresholds })
    expect(r?.method).toBe('power')
    expect(r?.tss).toBeGreaterThanOrEqual(62)
  })

  it('corrida sem ftpRun cai para hrTSS (não usa FTP de bike)', () => {
    const noRunFtp = { ...thresholds, ftpRun: null }
    const r = calcActivityTss({ sport: 'running', durationSeconds: 2496, np: 172, avgHr: 130, thresholds: noRunFtp })
    expect(r?.method).toBe('hr')
  })

  it('retorna null sem thresholds', () => {
    expect(calcActivityTss({ sport: 'running', durationSeconds: 3600, np: 172, avgHr: 130, thresholds: {} })).toBeNull()
  })

  it('retorna null com duração zero', () => {
    expect(calcActivityTss({ sport: 'cycling', durationSeconds: 0, np: 200, avgHr: 140, thresholds })).toBeNull()
  })
})
