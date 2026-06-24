import { createClient } from './client'

export type AthleteRow = {
  id: string
  coach_id: string
  full_name: string
  email: string | null
  primary_sport: string
  ftp_watts: number | null
  lthr_bpm: number | null
  vo2max_ml_kg_min: number | null
  weight_kg: number | null
  active: boolean
  ctl: number | null
  atl: number | null
  tsb: number | null
  hrv_score: number | null
  recovery_score: number | null
  sleep_hours: number | null
  status: string | null
  last_activity_at: string | null
  last_activity_sport: string | null
  last_activity_tss: number | null
  last_metrics_date: string | null
  watts_per_kg: number | null
}

export type PMCRow = {
  date: string
  ctl: number
  atl: number
  tsb: number
  daily_tss: number
}

export type ActivityRow = {
  id: string
  name: string | null
  sport: string
  started_at: string
  duration_seconds: number
  distance_meters: number | null
  tss: number | null
  normalized_power: number | null
  intensity_factor: number | null
  avg_hr_bpm: number | null
}

export type DailyMetricRow = {
  date: string
  hrv_rmssd: number | null
  hrv_score: number | null
  recovery_score: number | null
  sleep_hours: number | null
}

export async function getAthletes(): Promise<AthleteRow[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('v_athlete_summary')
    .select('*')
    .order('full_name')
  if (error) throw error
  return data ?? []
}

export async function getAthlete(id: string): Promise<AthleteRow | null> {
  const sb = createClient()
  const { data, error } = await sb
    .from('v_athlete_summary')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function getAthletePMC(athleteId: string, days = 90): Promise<PMCRow[]> {
  const sb = createClient()
  const from = new Date()
  from.setDate(from.getDate() - days)
  const { data, error } = await sb
    .from('daily_metrics')
    .select('date, ctl, atl, tsb, daily_tss')
    .eq('athlete_id', athleteId)
    .gte('date', from.toISOString().slice(0, 10))
    .order('date')
  if (error) return []
  return data ?? []
}

export async function getAthleteActivities(athleteId: string, limit = 10): Promise<ActivityRow[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('activities')
    .select('id, name, sport, started_at, duration_seconds, distance_meters, tss, normalized_power, intensity_factor, avg_hr_bpm')
    .eq('athlete_id', athleteId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return data ?? []
}

export async function getAthleteHRV(athleteId: string, days = 30): Promise<DailyMetricRow[]> {
  const sb = createClient()
  const from = new Date()
  from.setDate(from.getDate() - days)
  const { data, error } = await sb
    .from('daily_metrics')
    .select('date, hrv_rmssd, hrv_score, recovery_score, sleep_hours')
    .eq('athlete_id', athleteId)
    .gte('date', from.toISOString().slice(0, 10))
    .order('date')
  if (error) return []
  return data ?? []
}

export async function getDashboardSummary() {
  const sb = createClient()
  const { data: athletes } = await sb
    .from('v_athlete_summary')
    .select('id, full_name, primary_sport, ctl, atl, tsb, status, watts_per_kg')
    .order('full_name')

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const { count: weeklyActivities } = await sb
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', weekAgo.toISOString())

  return {
    athletes: athletes ?? [],
    weeklyActivities: weeklyActivities ?? 0,
  }
}
