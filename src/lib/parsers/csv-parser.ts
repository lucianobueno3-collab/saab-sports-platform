import Papa from 'papaparse'

export interface CSVActivity {
  date: string
  title: string
  sport: string
  duration_seconds: number
  distance_meters: number | null
  tss: number | null
  np: number | null
  if_: number | null
  avg_hr: number | null
  avg_power: number | null
  calories: number | null
  // ── métricas ampliadas (WorkoutFileExport do TrainingPeaks) ──────────────
  power_max?: number | null
  energy_kj?: number | null
  velocity_avg?: number | null
  velocity_max?: number | null
  cadence_avg?: number | null
  cadence_max?: number | null
  hr_max?: number | null
  torque_avg?: number | null
  torque_max?: number | null
  rpe?: number | null
  feeling?: string | null
  hr_zone_minutes?: number[] | null
  pwr_zone_minutes?: number[] | null
  workout_description?: string | null
  coach_comments?: string | null
  athlete_comments?: string | null
  planned_duration_seconds?: number | null
  planned_distance_meters?: number | null
}

function parseDuration(val: string): number {
  if (!val) return 0
  const parts = val.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parseFloat(val) * 60
}

// Duração flexível: aceita "HH:MM:SS" ou horas decimais ("1.5") → segundos
function durToSeconds(val: string): number | null {
  if (!val) return null
  if (val.includes(':')) {
    const p = val.split(':').map(Number)
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
    if (p.length === 2) return p[0] * 60 + p[1]
  }
  const f = parseFloat(val)
  return isNaN(f) ? null : Math.round(f * 3600)
}

function num(val: unknown): number | null {
  const n = parseFloat(String(val ?? ''))
  return isNaN(n) ? null : n
}

function str(val: unknown): string | null {
  const s = String(val ?? '').trim()
  return s || null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zoneMinutes(row: any, prefix: 'HR' | 'PWR'): number[] | null {
  const arr = Array.from({ length: 10 }, (_, i) => num(row[`${prefix}Zone${i + 1}Minutes`]) ?? 0)
  return arr.some(v => v > 0) ? arr.map(v => Math.round(v * 10) / 10) : null
}

// Formato "WorkoutFileExport" do TrainingPeaks (cabeçalho com WorkoutDay,
// TimeTotalInHours, DistanceInMeters, zonas, RPE/Feeling, etc.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTPWorkoutRow(row: any): CSVActivity | null {
  const dateRaw = row['WorkoutDay'] ?? ''
  if (!dateRaw) return null
  const dateObj = new Date(dateRaw)
  if (isNaN(dateObj.getTime())) return null

  const hours = num(row['TimeTotalInHours'])
  const duration_seconds = hours ? Math.round(hours * 3600) : 0
  const distance_meters = num(row['DistanceInMeters']) // já em metros
  const tss = num(row['TSS'])

  // linhas apenas planejadas (sem realização) não viram atividade
  const hasActual = duration_seconds > 0 || (distance_meters ?? 0) > 0 || (tss ?? 0) > 0
  if (!hasActual) return null

  return {
    date: dateObj.toISOString(),
    title: String(row['Title'] ?? ''),
    sport: String(row['WorkoutType'] ?? 'other').toLowerCase(),
    duration_seconds,
    distance_meters: distance_meters != null ? Math.round(distance_meters) : null,
    tss: tss != null ? Math.round(tss) : null,
    np: null,
    if_: num(row['IF']),
    avg_hr: num(row['HeartRateAverage']),
    avg_power: num(row['PowerAverage']),
    calories: null,
    power_max: num(row['PowerMax']),
    energy_kj: num(row['Energy']),
    velocity_avg: num(row['VelocityAverage']),
    velocity_max: num(row['VelocityMax']),
    cadence_avg: num(row['CadenceAverage']),
    cadence_max: num(row['CadenceMax']),
    hr_max: num(row['HeartRateMax']),
    torque_avg: num(row['TorqueAverage']),
    torque_max: num(row['TorqueMax']),
    rpe: num(row['Rpe']),
    feeling: str(row['Feeling']),
    hr_zone_minutes: zoneMinutes(row, 'HR'),
    pwr_zone_minutes: zoneMinutes(row, 'PWR'),
    workout_description: str(row['WorkoutDescription']),
    coach_comments: str(row['CoachComments']),
    athlete_comments: str(row['AthleteComments']),
    planned_duration_seconds: durToSeconds(String(row['PlannedDuration'] ?? '')),
    planned_distance_meters: num(row['PlannedDistanceInMeters']),
  }
}

// Formato genérico/antigo (Date, Duration, Distance em km, NP, IF...)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGenericRow(row: any): CSVActivity | null {
  const dateRaw = row['Date'] ?? row['date'] ?? row['Workout Date'] ?? ''
  if (!dateRaw) return null
  const dateObj = new Date(dateRaw)
  if (isNaN(dateObj.getTime())) return null

  const title = row['Title'] ?? row['title'] ?? row['Workout Title'] ?? row['Name'] ?? ''
  const sport = row['Workout Type'] ?? row['Sport'] ?? row['sport'] ?? row['Type'] ?? 'other'
  const durationRaw = row['Duration'] ?? row['duration'] ?? row['Total Time'] ?? ''
  const tss = num(row['TSS'] ?? row['tss'] ?? row['Training Stress Score®'] ?? row['Training Stress Score'])
  const np = num(row['NP®'] ?? row['NP'] ?? row['Normalized Power'] ?? row['normalized_power'])
  const if_ = num(row['IF®'] ?? row['IF'] ?? row['Intensity Factor'] ?? row['intensity_factor'])
  const avgHR = num(row['Avg HR'] ?? row['avg_hr'] ?? row['Average Heart Rate'])
  const avgPower = num(row['Avg Power'] ?? row['avg_power'] ?? row['Average Power'])
  const distanceRaw = row['Distance'] ?? row['distance'] ?? ''
  const calories = num(row['Calories'] ?? row['calories'])

  const distNum = num(distanceRaw)
  const distMeters = distNum ? Math.round(distNum * 1000) : null // km → m

  return {
    date: dateObj.toISOString(),
    title: String(title),
    sport: String(sport).toLowerCase(),
    duration_seconds: parseDuration(String(durationRaw)),
    distance_meters: distMeters,
    tss: tss ? Math.round(tss) : null,
    np: np ? Math.round(np) : null,
    if_,
    avg_hr: avgHR ? Math.round(avgHR) : null,
    avg_power: avgPower ? Math.round(avgPower) : null,
    calories: calories ? Math.round(calories) : null,
  }
}

export async function parseTPCSV(file: File): Promise<CSVActivity[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rows = results.data as any[]
          // Detecta o formato pelo cabeçalho (WorkoutFileExport do TP)
          const isTP = rows.length > 0 && ('WorkoutDay' in rows[0] || 'TimeTotalInHours' in rows[0])
          const out: CSVActivity[] = []
          for (const row of rows) {
            const a = isTP ? parseTPWorkoutRow(row) : parseGenericRow(row)
            if (a) out.push(a)
          }
          resolve(out)
        } catch (e) {
          reject(e)
        }
      },
      error: reject,
    })
  })
}
