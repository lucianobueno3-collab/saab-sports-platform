// Motor de regras de prontidão — funções puras, sem dependências de UI.
// Todos os limites lidos de THRESHOLDS. Nenhum número mágico aqui.

import { THRESHOLDS } from './thresholds'

export type Readiness = 'VERDE' | 'AMARELO' | 'VERMELHO' | 'VALVULA'

export interface DailyMetrics {
  date: string
  hrv_ms: number | null
  resting_hr_bpm: number | null
  body_battery: number | null
  stress_avg: number | null
  sleep_hours: number | null
  rem_pct: number | null
  rem_sleep_hours: number | null
  deep_sleep_hours: number | null
  light_sleep_hours: number | null
  weight_kg: number | null
}

export interface ReadinessResult {
  level: Readiness
  recommendation: string
  overriddenBySafety: boolean
  safetyReason?: string
}

export function trainingReadiness(m: DailyMetrics): ReadinessResult {
  const t = THRESHOLDS

  // VÁLVULA DE SEGURANÇA — sobrepõe HRV
  const bbTrigger = m.body_battery !== null && m.body_battery < t.bodyBattery.safety_floor
  const remTrigger = m.rem_pct !== null && m.rem_pct < t.rem.safety_floor_pct
  const sleepTrigger = m.sleep_hours !== null && m.sleep_hours < t.sleep.min_safe_hours

  if (bbTrigger || remTrigger || sleepTrigger) {
    const reasons = [
      bbTrigger && `Body Battery ${m.body_battery} < ${t.bodyBattery.safety_floor}`,
      remTrigger && `REM ${m.rem_pct?.toFixed(0)}% < ${t.rem.safety_floor_pct}%`,
      sleepTrigger && `Sono ${m.sleep_hours?.toFixed(1)}h < ${t.sleep.min_safe_hours}h`,
    ].filter(Boolean).join(' · ')

    return {
      level: 'VALVULA',
      recommendation: 'DESCANSO OBRIGATÓRIO — válvula de segurança ativada. Nenhum treino.',
      overriddenBySafety: true,
      safetyReason: reasons,
    }
  }

  // Sem dado de HRV → amarelo por precaução
  if (m.hrv_ms === null) {
    return { level: 'AMARELO', recommendation: 'Sem dados de HRV — reduzir volume 20%, foco aeróbico.', overriddenBySafety: false }
  }

  if (m.hrv_ms >= t.hrv.green_min) {
    return { level: 'VERDE', recommendation: 'Treino normal — 100% de intensidade e volume.', overriddenBySafety: false }
  }
  if (m.hrv_ms >= t.hrv.yellow_min) {
    return { level: 'AMARELO', recommendation: 'Adaptação — reduzir volume 20–40%, foco técnico/aeróbico.', overriddenBySafety: false }
  }
  return { level: 'VERMELHO', recommendation: 'Descanso total — apenas recuperação passiva.', overriddenBySafety: false }
}

export interface StopProtocolResult {
  abort: boolean
  clinicalFlag: boolean
  signals: string[]
}

function consecutiveDays(window: DailyMetrics[], predicate: (d: DailyMetrics) => boolean): number {
  let count = 0
  for (let i = window.length - 1; i >= 0; i--) {
    if (predicate(window[i])) count++
    else break
  }
  return count
}

export function stopProtocol(window: DailyMetrics[]): StopProtocolResult {
  if (window.length === 0) return { abort: false, clinicalFlag: false, signals: [] }
  const t = THRESHOLDS
  const last = window[window.length - 1]
  const signals: string[] = []

  if (consecutiveDays(window, d => d.hrv_ms !== null && d.hrv_ms < t.hrv.yellow_min) >= 3)
    signals.push('HRV vermelho (<34ms) por 3+ dias consecutivos')

  if (consecutiveDays(window, d => d.body_battery !== null && d.body_battery < t.bodyBattery.safety_floor) >= 3)
    signals.push('Body Battery <25 por 3+ dias consecutivos')

  if (consecutiveDays(window, d => d.resting_hr_bpm !== null && d.resting_hr_bpm >= t.rhr.warning_bpm) >= 2)
    signals.push(`FC repouso ≥${t.rhr.warning_bpm}bpm por 2+ dias`)

  if (consecutiveDays(window, d => d.sleep_hours !== null && d.sleep_hours < t.sleep.min_safe_hours) >= 3)
    signals.push('Sono <5.5h por 3+ noites consecutivas')

  const clinicalFlag = last.resting_hr_bpm !== null && last.resting_hr_bpm >= t.rhr.clinical_bpm

  return { abort: signals.length >= 2 || clinicalFlag, clinicalFlag, signals }
}

export type KpiState = 'ok' | 'amber' | 'red'

export function kpiState(value: number, target: number, dir: 'higher' | 'lower'): KpiState {
  const meets = dir === 'higher' ? value >= target : value <= target
  if (meets) return 'ok'
  const gap = Math.abs(value - target) / target
  return gap <= 0.10 ? 'amber' : 'red'
}

export interface WeeklyKpi {
  group: 'leadership' | 'result' | 'safety'
  label: string
  value: number | null
  target: number
  unit: string
  dir: 'higher' | 'lower'
  state: KpiState
  targetLabel: string
}

export function weeklyScorecard(days: DailyMetrics[]): WeeklyKpi[] {
  if (days.length === 0) return []
  const t = THRESHOLDS

  const withSleep = days.filter(d => d.sleep_hours !== null)
  const withBB = days.filter(d => d.body_battery !== null)
  const withRem = days.filter(d => d.rem_pct !== null)
  const withHrv = days.filter(d => d.hrv_ms !== null)
  const withRhr = days.filter(d => d.resting_hr_bpm !== null)

  const avgSleep = withSleep.length ? withSleep.reduce((s, d) => s + d.sleep_hours!, 0) / withSleep.length : null
  const pctShortNights = withSleep.length ? withSleep.filter(d => d.sleep_hours! < t.sleep.short_night_threshold).length / withSleep.length * 100 : null
  const avgBB = withBB.length ? withBB.reduce((s, d) => s + d.body_battery!, 0) / withBB.length : null
  const avgRem = withRem.length ? withRem.reduce((s, d) => s + d.rem_pct!, 0) / withRem.length : null
  const avgHrv = withHrv.length ? withHrv.reduce((s, d) => s + d.hrv_ms!, 0) / withHrv.length : null
  const avgRhr = withRhr.length ? withRhr.reduce((s, d) => s + d.resting_hr_bpm!, 0) / withRhr.length : null

  return [
    // Liderança (comportamento controlável)
    { group: 'leadership', label: 'Sono médio', value: avgSleep, target: t.sleep.target_hours, unit: 'h', dir: 'higher', state: avgSleep !== null ? kpiState(avgSleep, t.sleep.target_hours, 'higher') : 'red', targetLabel: `> ${t.sleep.target_hours}h` },
    { group: 'leadership', label: '% noites < 6h', value: pctShortNights, target: 0, unit: '%', dir: 'lower', state: pctShortNights !== null ? (pctShortNights === 0 ? 'ok' : pctShortNights <= 10 ? 'amber' : 'red') : 'red', targetLabel: '0%' },
    // Resultado (efeito fisiológico)
    { group: 'result', label: 'Body Battery', value: avgBB, target: t.bodyBattery.target_min, unit: '', dir: 'higher', state: avgBB !== null ? kpiState(avgBB, t.bodyBattery.target_min, 'higher') : 'red', targetLabel: `> ${t.bodyBattery.target_min}` },
    { group: 'result', label: 'REM', value: avgRem, target: t.rem.target_pct_min, unit: '%', dir: 'higher', state: avgRem !== null ? kpiState(avgRem, t.rem.target_pct_min, 'higher') : 'red', targetLabel: `> ${t.rem.target_pct_min}%` },
    // Segurança
    { group: 'safety', label: 'HRV', value: avgHrv, target: t.hrv.green_min, unit: 'ms', dir: 'higher', state: avgHrv !== null ? kpiState(avgHrv, t.hrv.green_min, 'higher') : 'red', targetLabel: `> ${t.hrv.green_min}ms` },
    { group: 'safety', label: 'FC repouso', value: avgRhr, target: t.rhr.warning_bpm, unit: 'bpm', dir: 'lower', state: avgRhr !== null ? kpiState(avgRhr, t.rhr.warning_bpm, 'lower') : 'red', targetLabel: `< ${t.rhr.warning_bpm}bpm` },
  ]
}
