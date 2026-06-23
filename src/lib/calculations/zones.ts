// Training zones calculation

export interface Zone {
  number: number
  name: string
  min: number
  max: number
  color: string
}

// Coggan power zones (% of FTP)
export function getPowerZones(ftp: number): Zone[] {
  return [
    { number: 1, name: 'Recuperação Ativa', min: 0, max: Math.round(ftp * 0.55), color: '#4ade80' },
    { number: 2, name: 'Resistência', min: Math.round(ftp * 0.56), max: Math.round(ftp * 0.75), color: '#86efac' },
    { number: 3, name: 'Tempo', min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.90), color: '#fbbf24' },
    { number: 4, name: 'Limiar', min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05), color: '#f97316' },
    { number: 5, name: 'VO2max', min: Math.round(ftp * 1.06), max: Math.round(ftp * 1.20), color: '#ef4444' },
    { number: 6, name: 'Anaeróbio', min: Math.round(ftp * 1.21), max: Math.round(ftp * 1.50), color: '#dc2626' },
    { number: 7, name: 'Neuromuscular', min: Math.round(ftp * 1.51), max: 9999, color: '#7c3aed' },
  ]
}

// Friel HR zones (% of LTHR)
export function getHRZones(lthr: number): Zone[] {
  return [
    { number: 1, name: 'Recuperação', min: 0, max: Math.round(lthr * 0.81), color: '#4ade80' },
    { number: 2, name: 'Aeróbio', min: Math.round(lthr * 0.82), max: Math.round(lthr * 0.89), color: '#86efac' },
    { number: 3, name: 'Tempo', min: Math.round(lthr * 0.90), max: Math.round(lthr * 0.93), color: '#fbbf24' },
    { number: 4, name: 'Limiar', min: Math.round(lthr * 0.94), max: Math.round(lthr * 0.99), color: '#f97316' },
    { number: 5, name: 'VO2max', min: Math.round(lthr * 1.00), max: Math.round(lthr * 1.02), color: '#ef4444' },
    { number: 6, name: 'Anaeróbio', min: Math.round(lthr * 1.03), max: 300, color: '#dc2626' },
  ]
}

export function getPaceZones(thresholdPaceSeconds: number): Zone[] {
  return [
    { number: 1, name: 'Recuperação', min: Math.round(thresholdPaceSeconds * 1.29), max: 9999, color: '#4ade80' },
    { number: 2, name: 'Resistência', min: Math.round(thresholdPaceSeconds * 1.14), max: Math.round(thresholdPaceSeconds * 1.29) - 1, color: '#86efac' },
    { number: 3, name: 'Tempo', min: Math.round(thresholdPaceSeconds * 1.06), max: Math.round(thresholdPaceSeconds * 1.14) - 1, color: '#fbbf24' },
    { number: 4, name: 'Limiar', min: Math.round(thresholdPaceSeconds * 1.01), max: Math.round(thresholdPaceSeconds * 1.06) - 1, color: '#f97316' },
    { number: 5, name: 'VO2max', min: Math.round(thresholdPaceSeconds * 0.97), max: Math.round(thresholdPaceSeconds * 1.00), color: '#ef4444' },
    { number: 6, name: 'Anaeróbio', min: 0, max: Math.round(thresholdPaceSeconds * 0.97) - 1, color: '#dc2626' },
  ]
}

export function formatPace(secondsPerKm: number): string {
  const min = Math.floor(secondsPerKm / 60)
  const sec = Math.round(secondsPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}
