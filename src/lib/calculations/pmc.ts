// Performance Management Chart calculations (Banister model)

const CTL_DECAY = Math.exp(-1 / 42) // 42-day time constant
const ATL_DECAY = Math.exp(-1 / 7)  // 7-day time constant

export function calcCTL(prevCTL: number, tss: number): number {
  return prevCTL * CTL_DECAY + tss * (1 - CTL_DECAY)
}

export function calcATL(prevATL: number, tss: number): number {
  return prevATL * ATL_DECAY + tss * (1 - ATL_DECAY)
}

export function calcTSB(ctl: number, atl: number): number {
  return ctl - atl
}

export function getAthleteStatus(tsb: number, ctl: number): string {
  if (tsb > 10 && ctl > 60) return 'peak'
  if (tsb > 5) return 'fresh'
  if (tsb >= -10) return 'fit'
  if (tsb >= -25) return 'tired'
  return 'overreaching'
}

// TSS from power
export function calcPowerTSS(durationSeconds: number, np: number, ftp: number): number {
  const hours = durationSeconds / 3600
  const if_ = np / ftp
  return (durationSeconds * np * if_) / (ftp * 3600) * 100
}

// TSS from HR (Benson method)
export function calcHRTSS(durationSeconds: number, avgHR: number, lthr: number, maxHR: number, restHR: number): number {
  const hrr = (avgHR - restHR) / (maxHR - restHR)
  const lthrr = (lthr - restHR) / (maxHR - restHR)
  const trimp = durationSeconds / 60 * hrr * 0.64 * Math.exp(1.92 * hrr)
  const ltrimp = 60 * lthrr * 0.64 * Math.exp(1.92 * lthrr)
  return (trimp / ltrimp) * 100
}

// rTSS from pace (running)
export function calcRunTSS(durationSeconds: number, avgPacePerKm: number, thresholdPacePerKm: number): number {
  const hours = durationSeconds / 3600
  const ngp = avgPacePerKm // simplified
  const if_ = thresholdPacePerKm / ngp
  return hours * if_ * if_ * 100
}

export function calcIntensityFactor(np: number, ftp: number): number {
  return np / ftp
}

export function calcWattsPerKg(ftp: number, weightKg: number): number {
  return ftp / weightKg
}

export interface PMCPoint {
  date: string
  ctl: number
  atl: number
  tsb: number
  tss?: number
}

export function buildPMC(
  activities: Array<{ date: string; tss: number }>,
  startCTL = 0,
  startATL = 0
): PMCPoint[] {
  if (!activities.length) return []

  const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date))
  const start = new Date(sorted[0].date)
  const end = new Date(sorted[sorted.length - 1].date)

  const tssMap = new Map<string, number>()
  for (const a of activities) {
    const key = a.date.slice(0, 10)
    tssMap.set(key, (tssMap.get(key) ?? 0) + a.tss)
  }

  const points: PMCPoint[] = []
  let ctl = startCTL
  let atl = startATL
  const cursor = new Date(start)

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    const tss = tssMap.get(key) ?? 0
    ctl = calcCTL(ctl, tss)
    atl = calcATL(atl, tss)
    points.push({ date: key, ctl: +ctl.toFixed(1), atl: +atl.toFixed(1), tsb: +calcTSB(ctl, atl).toFixed(1), tss })
    cursor.setDate(cursor.getDate() + 1)
  }

  return points
}
