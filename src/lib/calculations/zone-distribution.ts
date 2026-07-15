// Distribuição de tempo em zonas de treino a partir dos registros ponto-a-ponto do FIT.
// Preferimos potência (zonas de Coggan sobre FTP); sem potência usamos FC (zonas de Friel sobre LTHR).

import { getPowerZones, getHRZones, type Zone } from './zones'

export type ZoneBasis = 'power' | 'hr'

export interface ZoneDistribution {
  basis: ZoneBasis
  /** segundos em cada zona; índice 0 = Z1 */
  seconds: number[]
  zoneModel: 'coggan' | 'friel'
}

/** Bucketiza um valor (watts ou bpm) no índice de zona correspondente */
function zoneIndexFor(value: number, zones: Zone[]): number {
  for (let i = 0; i < zones.length; i++) {
    if (value >= zones[i].min && value <= zones[i].max) return i
  }
  // acima do topo → última zona
  return value > zones[zones.length - 1].max ? zones.length - 1 : 0
}

/**
 * Calcula segundos por zona a partir de amostras ponto-a-ponto.
 * Assume ~1s por registro (padrão FIT); usa o delta de tempo real quando disponível.
 */
export function computeZoneDistribution(
  records: { power?: number | null; heart_rate?: number | null; elapsed_time?: number | null; timer_time?: number | null }[],
  opts: { ftp?: number | null; lthr?: number | null; sport?: string },
): ZoneDistribution | null {
  const isRun = (opts.sport ?? '').toLowerCase().includes('run')
  const isSwim = (opts.sport ?? '').toLowerCase().includes('swim')

  // Potência: só para bike (corrida com Stryd usaria ftpRun, tratado à parte); natação nunca.
  const powers = records.map(r => r.power).filter((p): p is number => typeof p === 'number' && p > 0)
  const usesPower = !isRun && !isSwim && opts.ftp && powers.length >= 30

  if (usesPower && opts.ftp) {
    const zones = getPowerZones(opts.ftp)
    const seconds = new Array(zones.length).fill(0)
    for (const r of records) {
      const p = r.power
      if (typeof p !== 'number' || p < 0) continue
      seconds[zoneIndexFor(p, zones)] += 1
    }
    if (seconds.some(s => s > 0)) return { basis: 'power', seconds, zoneModel: 'coggan' }
  }

  // FC
  const hrs = records.map(r => r.heart_rate).filter((h): h is number => typeof h === 'number' && h > 0)
  if (opts.lthr && hrs.length >= 30) {
    const zones = getHRZones(opts.lthr)
    const seconds = new Array(zones.length).fill(0)
    for (const r of records) {
      const h = r.heart_rate
      if (typeof h !== 'number' || h <= 0) continue
      seconds[zoneIndexFor(h, zones)] += 1
    }
    if (seconds.some(s => s > 0)) return { basis: 'hr', seconds, zoneModel: 'friel' }
  }

  return null
}

/** Rótulos e cores das zonas para exibição, conforme a base (potência ou FC) */
export function zoneMeta(basis: ZoneBasis, ftp: number, lthr: number): Zone[] {
  return basis === 'power' ? getPowerZones(ftp) : getHRZones(lthr)
}
