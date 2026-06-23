export interface Athlete {
  id: string
  coach_id: string
  name: string
  email: string
  avatar_url?: string
  sport: 'running' | 'cycling' | 'triathlon' | 'swimming' | 'other'
  category?: string
  birth_date?: string
  weight_kg?: number
  height_cm?: number
  // Thresholds
  ftp_watts?: number
  lthr_bpm?: number
  vo2max?: number
  max_hr?: number
  threshold_pace_per_km?: number
  // Meta
  goal?: string
  notes?: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  athlete_id: string
  name: string
  sport: string
  date: string
  duration_seconds: number
  distance_meters?: number
  // Power
  avg_power_watts?: number
  normalized_power?: number
  intensity_factor?: number
  tss?: number
  ftp_at_time?: number
  // Heart Rate
  avg_hr?: number
  max_hr?: number
  // Run
  avg_pace_per_km?: number
  // Load
  ctl_after?: number
  atl_after?: number
  tsb_after?: number
  // Source
  source: 'fit' | 'csv' | 'trainingpeaks_api' | 'manual'
  file_url?: string
  raw_data?: Record<string, unknown>
  created_at: string
}

export interface DailyMetrics {
  id: string
  athlete_id: string
  date: string
  // PMC
  ctl: number
  atl: number
  tsb: number
  // Recovery
  hrv_rmssd?: number
  hrv_score?: number
  recovery_score?: number
  sleep_hours?: number
  sleep_quality?: number
  stress_score?: number
  // HR
  resting_hr?: number
  // Source
  source: 'calculated' | 'garmin' | 'whoop' | 'oura' | 'manual'
  created_at: string
}

export interface ZoneDistribution {
  z1: number
  z2: number
  z3: number
  z4: number
  z5: number
}

export interface PMCPoint {
  date: string
  ctl: number
  atl: number
  tsb: number
}

export interface AthleteStats {
  last_ctl: number
  last_atl: number
  last_tsb: number
  last_hrv?: number
  last_recovery?: number
  weekly_tss: number
  status: 'peak' | 'fit' | 'tired' | 'overreaching' | 'fresh'
}

export type SportType = Athlete['sport']
