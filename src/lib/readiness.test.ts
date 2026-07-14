import { describe, it, expect } from 'vitest'
import { trainingReadiness, stopProtocol, type DailyMetrics } from './readiness'

function day(overrides: Partial<DailyMetrics> = {}): DailyMetrics {
  return {
    date: '2026-07-14',
    hrv_ms: null, resting_hr_bpm: null, body_battery: null, stress_avg: null,
    sleep_hours: null, rem_pct: null, rem_sleep_hours: null, deep_sleep_hours: null,
    light_sleep_hours: null, weight_kg: null,
    ...overrides,
  }
}

describe('trainingReadiness — válvula de segurança', () => {
  it('Body Battery < 25 aborta treino mesmo com HRV verde', () => {
    const r = trainingReadiness(day({ hrv_ms: 50, body_battery: 20 }))
    expect(r.level).toBe('VALVULA')
    expect(r.overriddenBySafety).toBe(true)
    expect(r.safetyReason).toContain('Body Battery')
  })

  it('REM < 10% aborta treino', () => {
    const r = trainingReadiness(day({ hrv_ms: 50, rem_pct: 8 }))
    expect(r.level).toBe('VALVULA')
  })

  it('sono < 5.5h aborta treino', () => {
    const r = trainingReadiness(day({ hrv_ms: 50, sleep_hours: 5.0 }))
    expect(r.level).toBe('VALVULA')
  })

  it('métricas nulas NÃO disparam a válvula', () => {
    const r = trainingReadiness(day({ hrv_ms: 50 }))
    expect(r.level).toBe('VERDE')
  })
})

describe('trainingReadiness — semáforo HRV', () => {
  it('HRV >= 37 → verde', () => {
    expect(trainingReadiness(day({ hrv_ms: 37, body_battery: 60, sleep_hours: 8, rem_pct: 22 })).level).toBe('VERDE')
  })

  it('HRV 34–36 → amarelo', () => {
    expect(trainingReadiness(day({ hrv_ms: 35, body_battery: 60, sleep_hours: 8, rem_pct: 22 })).level).toBe('AMARELO')
  })

  it('HRV < 34 → vermelho', () => {
    expect(trainingReadiness(day({ hrv_ms: 30, body_battery: 60, sleep_hours: 8, rem_pct: 22 })).level).toBe('VERMELHO')
  })

  it('sem HRV → amarelo por precaução', () => {
    expect(trainingReadiness(day({ body_battery: 60, sleep_hours: 8, rem_pct: 22 })).level).toBe('AMARELO')
  })
})

describe('stopProtocol', () => {
  it('2 sinais simultâneos → abortar', () => {
    // 3 dias de HRV vermelho + 3 dias de Body Battery < 25
    const window = [1, 2, 3].map(() => day({ hrv_ms: 30, body_battery: 20 }))
    const r = stopProtocol(window)
    expect(r.signals.length).toBeGreaterThanOrEqual(2)
    expect(r.abort).toBe(true)
  })

  it('1 sinal apenas → não aborta', () => {
    const window = [1, 2, 3].map(() => day({ hrv_ms: 30, body_battery: 60, sleep_hours: 8 }))
    const r = stopProtocol(window)
    expect(r.signals.length).toBe(1)
    expect(r.abort).toBe(false)
  })

  it('FC repouso >= 62 é bandeira clínica e aborta sozinha', () => {
    const r = stopProtocol([day({ resting_hr_bpm: 63 })])
    expect(r.clinicalFlag).toBe(true)
    expect(r.abort).toBe(true)
  })

  it('janela vazia → não aborta', () => {
    expect(stopProtocol([]).abort).toBe(false)
  })
})
