// Sinalização de ausência de treino para a Central de Alertas.
// Um atleta é sinalizado quando o último treino registrado (tabela activities)
// tem mais de 48h — ou quando não há nenhum treino na janela consultada.

export const NO_TRAINING_THRESHOLD_HOURS = 48

export type TrainingGap = {
  /** true quando não há treino registrado nas últimas 48h */
  flagged: boolean
  /** horas desde o último treino; null quando não há treino na janela consultada */
  hoursSince: number | null
  /** dias inteiros desde o último treino; null quando não há treino na janela */
  daysSince: number | null
}

export function trainingGap(lastActivityAt: string | null, now: Date = new Date()): TrainingGap {
  if (!lastActivityAt) return { flagged: true, hoursSince: null, daysSince: null }
  const last = new Date(lastActivityAt).getTime()
  if (Number.isNaN(last)) return { flagged: true, hoursSince: null, daysSince: null }
  const hours = (now.getTime() - last) / 3600000
  return {
    flagged: hours > NO_TRAINING_THRESHOLD_HOURS,
    hoursSince: hours,
    daysSince: Math.floor(hours / 24),
  }
}

/** Texto curto do selo/gatilho mostrado ao treinador */
export function trainingGapLabel(gap: TrainingGap): string {
  if (!gap.flagged) return ''
  if (gap.daysSince == null) return 'Nenhum treino registrado nos últimos 30 dias'
  if (gap.daysSince <= 2) return 'Sem treino registrado nas últimas 48h'
  return `Sem treino registrado há ${gap.daysSince} dias`
}
