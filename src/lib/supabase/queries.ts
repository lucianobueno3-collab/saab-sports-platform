import { createClient } from './client'

export type AthleteRow = {
  id: string
  coach_id: string
  full_name: string
  email: string | null
  primary_sport: string
  ftp_watts: number | null
  ftp_run_watts: number | null
  lthr_bpm: number | null
  lthr_bike_bpm: number | null
  lthr_run_bpm: number | null
  lthr_swim_bpm: number | null
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
  phone: string | null
  initial_ctl: number | null
  initial_atl: number | null
  initial_date: string | null
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
  tss_method: 'power' | 'hr' | null
  normalized_power: number | null
  intensity_factor: number | null
  avg_hr_bpm: number | null
}

export type DailyMetricRow = {
  date: string
  hrv_rmssd: number | null
  hrv_ms: number | null
  hrv_score: number | null
  recovery_score: number | null
  sleep_hours: number | null
  body_battery: number | null
  rem_pct: number | null
  resting_hr: number | null
  stress_avg: number | null
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
  const [{ data: summary }, { data: extra }] = await Promise.all([
    sb.from('v_athlete_summary').select('*').eq('id', id).single(),
    sb.from('athletes').select('phone, initial_ctl, initial_atl, initial_date, lthr_bike_bpm, lthr_run_bpm, lthr_swim_bpm, ftp_run_watts').eq('id', id).single(),
  ])
  if (!summary) return null
  return { ...summary, ...(extra ?? {}) } as AthleteRow
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
  if (error) { console.error("[queries]", error.message); return [] }
  return data ?? []
}

export async function getAthleteActivities(athleteId: string, limit = 10): Promise<ActivityRow[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('activities')
    .select('id, name, sport, started_at, duration_seconds, distance_meters, tss, tss_method, normalized_power, intensity_factor, avg_hr_bpm')
    .eq('athlete_id', athleteId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) { console.error("[queries]", error.message); return [] }
  return data ?? []
}

export async function getAthleteHRV(athleteId: string, days = 30): Promise<DailyMetricRow[]> {
  const sb = createClient()
  const from = new Date()
  from.setDate(from.getDate() - days)
  const { data, error } = await sb
    .from('daily_metrics')
    .select('date, hrv_rmssd, hrv_ms, hrv_score, recovery_score, sleep_hours, body_battery, rem_pct, resting_hr, stress_avg')
    .eq('athlete_id', athleteId)
    .gte('date', from.toISOString().slice(0, 10))
    .order('date')
  if (error) { console.error("[queries]", error.message); return [] }
  return data ?? []
}

export type AthleteAlertRow = {
  id: string
  full_name: string
  primary_sport: string
  phone: string | null
  ctl: number | null
  atl: number | null
  tsb: number | null
  latest_date: string | null
  hrv_ms: number | null
  body_battery: number | null
  sleep_hours: number | null
  rem_pct: number | null
  resting_hr: number | null
  stress_avg: number | null
  // previous 7 days for stop protocol
  week_metrics: {
    date: string; hrv_ms: number | null; body_battery: number | null
    sleep_hours: number | null; resting_hr: number | null
  }[]
}

export async function getAthletesForAlerts(): Promise<AthleteAlertRow[]> {
  const sb = createClient()
  const { data: athletes } = await sb
    .from('v_athlete_summary')
    .select('id, full_name, primary_sport, phone, ctl, atl, tsb')
    .order('full_name')
  if (!athletes?.length) return []

  const since = new Date(); since.setDate(since.getDate() - 7)
  const { data: metrics } = await sb
    .from('daily_metrics')
    .select('athlete_id, date, hrv_ms, body_battery, sleep_hours, rem_pct, resting_hr, stress_avg')
    .in('athlete_id', athletes.map(a => a.id))
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false })

  return athletes.map(a => {
    const rows = (metrics ?? []).filter(m => m.athlete_id === a.id).sort((x, y) => y.date.localeCompare(x.date))
    const latest = rows[0] ?? null
    return {
      id: a.id, full_name: a.full_name, primary_sport: a.primary_sport,
      phone: a.phone ?? null, ctl: a.ctl ?? null, atl: a.atl ?? null, tsb: a.tsb ?? null,
      latest_date: latest?.date ?? null,
      hrv_ms: latest?.hrv_ms ?? null, body_battery: latest?.body_battery ?? null,
      sleep_hours: latest?.sleep_hours ?? null, rem_pct: latest?.rem_pct ?? null,
      resting_hr: latest?.resting_hr ?? null, stress_avg: latest?.stress_avg ?? null,
      week_metrics: rows.map(r => ({ date: r.date, hrv_ms: r.hrv_ms, body_battery: r.body_battery, sleep_hours: r.sleep_hours, resting_hr: r.resting_hr })),
    }
  })
}

// ─── Portal do Atleta ────────────────────────────────────────────────────────

export type InjuryRow = {
  id: string
  athlete_id: string
  started_at: string
  resolved_at: string | null
  location: string
  injury_type: string
  severity: 'mild' | 'moderate' | 'severe'
  notes: string | null
}

export type MedicalExamRow = {
  id: string
  athlete_id: string
  exam_date: string
  exam_name: string
  value: number | null
  unit: string | null
  reference_min: number | null
  reference_max: number | null
  notes: string | null
}

export type BodyCompositionRow = {
  id: string
  athlete_id: string
  measured_at: string
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  bone_mass_kg: number | null
  visceral_fat: number | null
  notes: string | null
}

export type NutritionPlanRow = {
  id: string
  athlete_id: string
  phase: string
  calories_target: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  hydration_ml: number | null
  notes: string | null
  active: boolean
}

export type CompetitionRow = {
  id: string
  athlete_id: string
  race_date: string
  name: string
  sport: string | null
  distance_label: string | null
  goal_time_min: number | null
  result_time_min: number | null
  result_position: number | null
  dnf: boolean
  priority: 'A' | 'B' | 'C'
  notes: string | null
}

export type GoalRow = {
  id: string
  athlete_id: string
  title: string
  category: string
  target_date: string | null
  target_value: number | null
  target_unit: string | null
  current_value: number | null
  status: 'active' | 'achieved' | 'cancelled'
  notes: string | null
}

export async function getAthleteInjuries(athleteId: string): Promise<InjuryRow[]> {
  const sb = createClient()
  const { data } = await sb.from('injuries').select('*').eq('athlete_id', athleteId).order('started_at', { ascending: false })
  return (data ?? []) as InjuryRow[]
}

export async function getAthleteMedicalExams(athleteId: string): Promise<MedicalExamRow[]> {
  const sb = createClient()
  const { data } = await sb.from('medical_exams').select('*').eq('athlete_id', athleteId).order('exam_date', { ascending: false })
  return (data ?? []) as MedicalExamRow[]
}

export async function getAthleteBodyComposition(athleteId: string): Promise<BodyCompositionRow[]> {
  const sb = createClient()
  const { data } = await sb.from('body_composition').select('*').eq('athlete_id', athleteId).order('measured_at', { ascending: false })
  return (data ?? []) as BodyCompositionRow[]
}

export async function getAthleteNutritionPlans(athleteId: string): Promise<NutritionPlanRow[]> {
  const sb = createClient()
  const { data } = await sb.from('nutrition_plans').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false })
  return (data ?? []) as NutritionPlanRow[]
}

export async function getAthleteCompetitions(athleteId: string): Promise<CompetitionRow[]> {
  const sb = createClient()
  const { data } = await sb.from('competitions').select('*').eq('athlete_id', athleteId).order('race_date', { ascending: false })
  return (data ?? []) as CompetitionRow[]
}

export async function getAthleteGoals(athleteId: string): Promise<GoalRow[]> {
  const sb = createClient()
  const { data } = await sb.from('athlete_goals').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false })
  return (data ?? []) as GoalRow[]
}

// ─── Coach Profile ────────────────────────────────────────────────────────────

export async function getCoachProfile(): Promise<{ full_name: string | null; phone: string | null; role: string | null } | null> {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data, error } = await sb.from('profiles').select('full_name, phone, role').eq('id', user.id).single()
  if (error || !data) return null
  return {
    full_name: (data as { full_name?: string }).full_name ?? null,
    phone: (data as { phone?: string }).phone ?? null,
    role: (data as { role?: string }).role ?? null,
  }
}

export async function getMyRole(): Promise<string | null> {
  const sb = createClient()
  // Use security definer RPC to bypass RLS self-reference issue
  const { data, error } = await sb.rpc('get_my_role')
  if (error || data === null) return null
  return data as string
}

export type CoachRow = {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  role: string
  plan: string
  active: boolean
  created_at: string
  athlete_count?: number
}

export async function getCoaches(): Promise<CoachRow[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, email, phone, role, plan, active, created_at')
    .order('created_at', { ascending: true })
  if (error) { console.error("[queries]", error.message); return [] }

  const coaches = (data ?? []) as CoachRow[]

  // Count athletes per coach
  const { data: counts } = await sb
    .from('athletes')
    .select('coach_id')
  const countMap: Record<string, number> = {}
  for (const r of counts ?? []) {
    countMap[r.coach_id] = (countMap[r.coach_id] ?? 0) + 1
  }
  return coaches.map(c => ({ ...c, athlete_count: countMap[c.id] ?? 0 }))
}

export async function setCoachActive(coachId: string, active: boolean): Promise<void> {
  const sb = createClient()
  await sb.from('profiles').update({ active }).eq('id', coachId)
}

export async function setCoachRole(coachId: string, role: 'coach' | 'admin'): Promise<void> {
  const sb = createClient()
  await sb.from('profiles').update({ role }).eq('id', coachId)
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
