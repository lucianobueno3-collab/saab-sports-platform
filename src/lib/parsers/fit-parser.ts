import FitParser from 'fit-file-parser'
import { calcPowerTSS, calcIntensityFactor } from '../calculations/pmc'

export interface ParsedActivity {
  name: string
  sport: string
  date: string
  duration_seconds: number
  distance_meters?: number
  avg_power_watts?: number
  max_power_watts?: number
  normalized_power?: number
  intensity_factor?: number
  tss?: number
  avg_hr?: number
  max_hr?: number
  avg_cadence?: number
  avg_speed_ms?: number
  elevation_gain_m?: number
  calories?: number
  laps?: unknown[]
  records?: unknown[]
}

export async function parseFitFile(buffer: ArrayBuffer, ftp?: number): Promise<ParsedActivity> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({ force: true, speedUnit: 'km/h', lengthUnit: 'm', temperatureUnit: 'celsius', elapsedRecordField: true, mode: 'both' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parser.parse(buffer, (error: any, data: any) => {
      if (error) return reject(new Error(String(error)))

      const sessions = (data.activity as Record<string, unknown>)?.sessions as Record<string, unknown>[] ?? []
      const session = sessions[0] ?? {}

      const sport = String(session.sport ?? 'generic').toLowerCase()
      const startTime = session.start_time as Date ?? new Date()
      const duration = Number(session.total_elapsed_time ?? session.total_timer_time ?? 0)
      const distance = Number(session.total_distance ?? 0)
      const avgPower = session.avg_power != null ? Number(session.avg_power) : undefined
      const avgHR = session.avg_heart_rate != null ? Number(session.avg_heart_rate) : undefined
      const maxHR = session.max_heart_rate != null ? Number(session.max_heart_rate) : undefined

      // Calculate NP from records if available
      const records = (data.activity as Record<string, unknown>)?.sessions as Record<string, unknown>[] ?? []
      let np: number | undefined
      let tss: number | undefined
      let if_: number | undefined

      if (avgPower && ftp) {
        np = avgPower * 1.05 // simplified NP estimate
        if_ = calcIntensityFactor(np, ftp)
        tss = calcPowerTSS(duration, np, ftp)
      }

      resolve({
        name: `${sport.charAt(0).toUpperCase() + sport.slice(1)} — ${startTime.toLocaleDateString('pt-BR')}`,
        sport,
        date: startTime.toISOString(),
        duration_seconds: Math.round(duration),
        distance_meters: distance > 0 ? Math.round(distance) : undefined,
        avg_power_watts: avgPower,
        normalized_power: np ? Math.round(np) : undefined,
        intensity_factor: if_ ? +if_.toFixed(3) : undefined,
        tss: tss ? Math.round(tss) : undefined,
        avg_hr: avgHR,
        max_hr: maxHR,
        avg_cadence: session.avg_cadence != null ? Number(session.avg_cadence) : undefined,
        elevation_gain_m: session.total_ascent != null ? Number(session.total_ascent) : undefined,
        calories: session.total_calories != null ? Number(session.total_calories) : undefined,
      })
    })
  })
}
