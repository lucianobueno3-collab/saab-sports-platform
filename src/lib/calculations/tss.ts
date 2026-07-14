// Cálculo de TSS — fonte única usada pelo parser de FIT e pelo recálculo manual.
// Duas vias: potência (primária, requer FTP do esporte) e FC (fallback, requer LTHR do esporte).

export interface SportThresholds {
  /** FTP de ciclismo (watts) */
  ftp?: number | null
  /** FTP de corrida — Stryd (watts) */
  ftpRun?: number | null
  lthrBike?: number | null
  lthrRun?: number | null
  lthrSwim?: number | null
  /** LTHR genérico, usado como fallback quando o específico do esporte não existe */
  lthrGeneric?: number | null
}

/** IF via FC é limitado a 1.15 para evitar valores absurdos quando a FC deriva acima do LTHR */
export const HR_IF_CAP = 1.15

export function isRun(sport: string): boolean {
  return sport.toLowerCase().includes('run')
}

export function isSwim(sport: string): boolean {
  return sport.toLowerCase().includes('swim')
}

/** FTP adequado ao esporte: corrida usa ftpRun (Stryd); demais usam FTP de ciclismo */
export function ftpForSport(sport: string, t: SportThresholds): number | null {
  if (isRun(sport)) return t.ftpRun ?? null
  return t.ftp ?? null
}

/** LTHR adequado ao esporte, com fallback para o genérico */
export function lthrForSport(sport: string, t: SportThresholds): number | null {
  if (isSwim(sport)) return t.lthrSwim ?? t.lthrGeneric ?? null
  if (isRun(sport)) return t.lthrRun ?? t.lthrGeneric ?? null
  return t.lthrBike ?? t.lthrGeneric ?? null
}

export interface TssResult {
  tss: number
  intensityFactor: number
  method: 'power' | 'hr'
}

/** TSS por potência: (dur_s × NP × IF) / (FTP × 3600) × 100 */
export function powerTss(durationSeconds: number, np: number, ftp: number): TssResult {
  const intensityFactor = Math.round((np / ftp) * 100) / 100
  const tss = Math.round((durationSeconds * np * intensityFactor) / (ftp * 3600) * 100)
  return { tss, intensityFactor, method: 'power' }
}

/** hrTSS: (dur_h) × IF² × 100, onde IF = FC média / LTHR do esporte (limitado a 1.15) */
export function hrTss(durationSeconds: number, avgHr: number, lthr: number): TssResult {
  const ifHr = avgHr / lthr
  const ifCapped = Math.min(ifHr, HR_IF_CAP)
  const tss = Math.round((durationSeconds / 3600) * ifCapped * ifCapped * 100)
  return { tss, intensityFactor: Math.round(ifHr * 100) / 100, method: 'hr' }
}

/**
 * Calcula o TSS de uma atividade escolhendo o melhor método disponível:
 * potência (se houver NP e FTP do esporte) senão FC (se houver FC média e LTHR do esporte).
 */
export function calcActivityTss(params: {
  sport: string
  durationSeconds: number
  np?: number | null
  avgHr?: number | null
  thresholds: SportThresholds
}): TssResult | null {
  const { sport, durationSeconds, np, avgHr, thresholds } = params
  if (durationSeconds <= 0) return null

  const ftp = ftpForSport(sport, thresholds)
  if (ftp && np && np > 0) return powerTss(durationSeconds, np, ftp)

  const lthr = lthrForSport(sport, thresholds)
  if (lthr && avgHr && avgHr > 0) return hrTss(durationSeconds, avgHr, lthr)

  return null
}
