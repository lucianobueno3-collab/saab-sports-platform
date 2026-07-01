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
}

function parseDuration(val: string): number {
  if (!val) return 0
  const parts = val.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parseFloat(val) * 60
}

function num(val: unknown): number | null {
  const n = parseFloat(String(val ?? ''))
  return isNaN(n) ? null : n
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
          const activities: CSVActivity[] = []

          for (const row of rows) {
            const dateRaw = row['Date'] ?? row['date'] ?? row['Workout Date'] ?? ''
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

            if (!dateRaw) continue

            const dateObj = new Date(dateRaw)
            if (isNaN(dateObj.getTime())) continue

            const distNum = num(distanceRaw)
            const distMeters = distNum ? Math.round(distNum * 1000) : null

            activities.push({
              date: dateObj.toISOString(),
              title: String(title),
              sport: String(sport).toLowerCase(),
              duration_seconds: parseDuration(String(durationRaw)),
              distance_meters: distMeters,
              tss: tss ? Math.round(tss) : null,
              np: np ? Math.round(np) : null,
              if_: if_,
              avg_hr: avgHR ? Math.round(avgHR) : null,
              avg_power: avgPower ? Math.round(avgPower) : null,
              calories: calories ? Math.round(calories) : null,
            })
          }

          resolve(activities)
        } catch (e) {
          reject(e)
        }
      },
      error: reject,
    })
  })
}
