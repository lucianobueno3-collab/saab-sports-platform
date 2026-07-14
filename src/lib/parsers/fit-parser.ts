import FitParser from 'fit-file-parser'
import { calcActivityTss, type SportThresholds } from '@/lib/calculations/tss'

export interface FitActivity {
  date: string
  name: string
  sport: string
  duration_seconds: number
  distance_meters: number | null
  avg_power_watts: number | null
  normalized_power: number | null
  intensity_factor: number | null
  tss: number | null
  tss_method: 'power' | 'hr' | null
  avg_hr: number | null
  max_hr: number | null
  avg_cadence: number | null
  elevation_gain_m: number | null
  calories: number | null
}

export async function parseFitFile(
  buffer: ArrayBuffer,
  thresholds: SportThresholds = {},
): Promise<FitActivity> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      speedUnit: 'm/s',
      lengthUnit: 'm',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
      mode: 'cascade',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parser.parse(buffer, (error: Error | null, data: any) => {
      if (error) { reject(error); return }

      try {
        const sessions = data?.activity?.sessions ?? []
        const session = sessions[0] ?? {}

        const sport = (session.sport ?? session.sub_sport ?? 'generic') as string
        const startTime: Date = session.start_time ?? new Date()
        const totalTimer = session.total_timer_time ?? 0
        const totalElapsed = session.total_elapsed_time ?? totalTimer
        const duration = Math.round(totalTimer || totalElapsed)

        const distance = session.total_distance ?? null
        const avgPower = session.avg_power ?? null
        const avgHR = session.avg_heart_rate ?? null
        const maxHR = session.max_heart_rate ?? null
        const avgCadence = session.avg_cadence ?? null
        const elevGain = session.total_ascent ?? null
        const calories = session.total_calories ?? null

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const records: { power?: number }[] = sessions.flatMap((s: any) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (s.laps ?? []).flatMap((l: any) => l.records ?? [])
        )
        const powers = records.map(r => r.power).filter((p): p is number => typeof p === 'number' && p > 0)

        // Normalized Power: média móvel de 30s elevada à 4ª potência
        let np: number | null = null
        if (powers.length >= 30) {
          const rolling: number[] = []
          for (let i = 29; i < powers.length; i++) {
            const window = powers.slice(i - 29, i + 1)
            const avg = window.reduce((a, b) => a + b, 0) / 30
            rolling.push(avg ** 4)
          }
          np = Math.round((rolling.reduce((a, b) => a + b, 0) / rolling.length) ** 0.25)
        }

        const sportStr = sport.toString().toLowerCase()
        const npFinal = np ?? avgPower

        const result = calcActivityTss({
          sport: sportStr,
          durationSeconds: duration,
          np: npFinal,
          avgHr: avgHR,
          thresholds,
        })

        const nameMap: Record<string, string> = { running: 'Corrida', cycling: 'Ciclismo', swimming: 'Natação', triathlon: 'Triathlon', ride: 'Ciclismo', run: 'Corrida', swim: 'Natação' }
        const sportName = nameMap[sportStr] ?? 'Treino'

        resolve({
          date: startTime.toISOString(),
          name: `${sportName} ${startTime.toLocaleDateString('pt-BR')}`,
          sport: sportStr,
          duration_seconds: duration,
          distance_meters: distance ? Math.round(distance) : null,
          avg_power_watts: avgPower ? Math.round(avgPower) : null,
          normalized_power: npFinal ? Math.round(npFinal) : null,
          intensity_factor: result?.intensityFactor ?? null,
          tss: result?.tss ?? null,
          tss_method: result?.method ?? null,
          avg_hr: avgHR ? Math.round(avgHR) : null,
          max_hr: maxHR ? Math.round(maxHR) : null,
          avg_cadence: avgCadence ? Math.round(avgCadence) : null,
          elevation_gain_m: elevGain ? Math.round(elevGain) : null,
          calories: calories ? Math.round(calories) : null,
        })
      } catch (e) {
        reject(e)
      }
    })
  })
}
