import Papa from 'papaparse'

export interface CSVRow {
  [key: string]: string
}

// TrainingPeaks CSV export format
export interface TPActivity {
  date: string
  title: string
  sport: string
  duration_seconds: number
  distance_meters?: number
  tss?: number
  if_?: number
  np?: number
  avg_hr?: number
  avg_power?: number
  calories?: number
}

function parseTime(value: string): number {
  if (!value) return 0
  const parts = value.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return Number(value) || 0
}

function num(v: string): number | undefined {
  const n = parseFloat(v)
  return isNaN(n) ? undefined : n
}

export async function parseTPCSV(file: File): Promise<TPActivity[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const activities: TPActivity[] = results.data.map((row) => {
          // TrainingPeaks column names vary — handle common variants
          const date = row['Date'] ?? row['date'] ?? row['Workout Date'] ?? ''
          const title = row['Title'] ?? row['title'] ?? row['Workout Title'] ?? ''
          const sport = (row['Sport'] ?? row['sport'] ?? row['Type'] ?? 'other').toLowerCase()
          const durationRaw = row['Duration'] ?? row['duration'] ?? row['Workout Time'] ?? '0'
          const duration = parseTime(durationRaw)

          const distRaw = num(row['Distance'] ?? row['distance'] ?? '')
          const distance = distRaw != null ? distRaw * 1000 : undefined // km → m

          return {
            date: new Date(date).toISOString(),
            title,
            sport,
            duration_seconds: duration,
            distance_meters: distance,
            tss: num(row['TSS'] ?? row['tss'] ?? ''),
            if_: num(row['IF'] ?? row['if'] ?? ''),
            np: num(row['NP'] ?? row['np'] ?? ''),
            avg_hr: num(row['Avg HR'] ?? row['avg_hr'] ?? row['Average Heart Rate'] ?? ''),
            avg_power: num(row['Avg Power'] ?? row['avg_power'] ?? row['Average Power'] ?? ''),
            calories: num(row['Calories'] ?? row['calories'] ?? ''),
          }
        })
        resolve(activities.filter((a) => a.date && a.duration_seconds > 0))
      },
      error: reject,
    })
  })
}
