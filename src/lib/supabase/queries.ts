import { createClient } from './client'
import { todayLocalISO } from '@/lib/dates'

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
  height_cm: number | null
  gender: 'M' | 'F' | 'other' | null
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
  portal_token: string | null
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
  zone_data: { basis: 'power' | 'hr'; seconds: number[]; zoneModel: 'coggan' | 'friel' } | null
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
  const [{ data: summary }, extraRes] = await Promise.all([
    sb.from('v_athlete_summary').select('*').eq('id', id).single(),
    sb.from('athletes').select('phone, initial_ctl, initial_atl, initial_date, lthr_bike_bpm, lthr_run_bpm, lthr_swim_bpm, ftp_run_watts, height_cm, gender, portal_token').eq('id', id).single(),
  ])
  let extra = extraRes.data
  if (extraRes.error) {
    // banco sem a migração 012 (portal_token não existe): repete sem a coluna
    console.error('[queries]', extraRes.error.message)
    const retry = await sb.from('athletes').select('phone, initial_ctl, initial_atl, initial_date, lthr_bike_bpm, lthr_run_bpm, lthr_swim_bpm, ftp_run_watts, height_cm, gender').eq('id', id).single()
    extra = retry.data ? { ...retry.data, portal_token: null } : null
  }
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

// ─── Treinos programados / calendário (migração 020) ────────────────────────

export type PlannedWorkoutRow = {
  id: string
  athlete_id: string
  date: string
  sport: string
  title: string
  description: string | null
  planned_duration_min: number | null
  planned_tss: number | null
  completed: boolean
}

/** Treinos programados de um atleta num intervalo de datas (YYYY-MM-DD). */
export async function getPlannedWorkouts(athleteId: string, from: string, to: string): Promise<PlannedWorkoutRow[]> {
  const sb = createClient()
  const { data, error } = await sb.from('planned_workouts')
    .select('id, athlete_id, date, sport, title, description, planned_duration_min, planned_tss, completed')
    .eq('athlete_id', athleteId).gte('date', from).lte('date', to).order('date')
  if (error) { console.error('[queries]', error.message); return [] }
  return (data ?? []) as PlannedWorkoutRow[]
}

export type PlannedWorkoutInput = {
  athlete_id: string; date: string; sport: string; title: string
  description?: string | null; planned_duration_min?: number | null; planned_tss?: number | null
}

export async function createPlannedWorkout(input: PlannedWorkoutInput): Promise<boolean> {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  const { error } = await sb.from('planned_workouts').insert({ ...input, created_by: user?.id ?? null })
  if (error) { console.error('[queries]', error.message); return false }
  return true
}

export async function updatePlannedWorkout(id: string, patch: Partial<PlannedWorkoutInput> & { completed?: boolean }): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('planned_workouts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('[queries]', error.message); return false }
  return true
}

export async function deletePlannedWorkout(id: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('planned_workouts').delete().eq('id', id)
  if (error) { console.error('[queries]', error.message); return false }
  return true
}

/** Atividades realizadas num intervalo de datas (para o calendário: planejado x realizado). */
export async function getActivitiesRange(athleteId: string, fromISO: string, toISO: string): Promise<ActivityRow[]> {
  const sb = createClient()
  const { data, error } = await sb.from('activities')
    .select('id, name, sport, started_at, duration_seconds, distance_meters, tss, tss_method, normalized_power, intensity_factor, avg_hr_bpm')
    .eq('athlete_id', athleteId).gte('started_at', fromISO).lte('started_at', toISO)
    .order('started_at', { ascending: true })
  if (error) { console.error('[queries]', error.message); return [] }
  return (data ?? []).map(a => ({ ...a, zone_data: null })) as ActivityRow[]
}

export async function getAthleteActivities(athleteId: string, limit = 10): Promise<ActivityRow[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('activities')
    .select('id, name, sport, started_at, duration_seconds, distance_meters, tss, tss_method, zone_data, normalized_power, intensity_factor, avg_hr_bpm')
    .eq('athlete_id', athleteId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) {
    // banco sem a migração 011 (zone_data não existe): repete sem a coluna
    // para os treinos continuarem visíveis mesmo com o banco desatualizado
    console.error('[queries]', error.message)
    const retry = await sb
      .from('activities')
      .select('id, name, sport, started_at, duration_seconds, distance_meters, tss, tss_method, normalized_power, intensity_factor, avg_hr_bpm')
      .eq('athlete_id', athleteId)
      .order('started_at', { ascending: false })
      .limit(limit)
    if (retry.error) { console.error('[queries]', retry.error.message); return [] }
    return (retry.data ?? []).map(a => ({ ...a, zone_data: null })) as ActivityRow[]
  }
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
  // último treino registrado (tabela activities, janela de 30 dias)
  last_activity_at: string | null
  // previous 7 days for stop protocol
  week_metrics: {
    date: string; hrv_ms: number | null; body_battery: number | null
    sleep_hours: number | null; resting_hr: number | null
  }[]
}

export async function getAthletesForAlerts(): Promise<AthleteAlertRow[]> {
  const sb = createClient()
  // IMPORTANTE: a view v_athlete_summary NÃO expõe a coluna phone — pedir
  // phone aqui fazia a consulta inteira falhar e a Central de Alertas zerar.
  const { data: athletes, error: athletesError } = await sb
    .from('v_athlete_summary')
    .select('id, full_name, primary_sport, ctl, atl, tsb')
    .order('full_name')
  if (athletesError) console.error('[queries]', athletesError.message)
  if (!athletes?.length) return []

  const since = new Date(); since.setDate(since.getDate() - 7)
  const activitySince = new Date(); activitySince.setDate(activitySince.getDate() - 30)
  const [{ data: metrics }, { data: recentActivities }, { data: phones }] = await Promise.all([
    sb.from('daily_metrics')
      .select('athlete_id, date, hrv_ms, body_battery, sleep_hours, rem_pct, resting_hr, stress_avg')
      .in('athlete_id', athletes.map(a => a.id))
      .gte('date', since.toISOString().slice(0, 10))
      .order('date', { ascending: false }),
    sb.from('activities')
      .select('athlete_id, started_at')
      .in('athlete_id', athletes.map(a => a.id))
      .gte('started_at', activitySince.toISOString())
      .order('started_at', { ascending: false }),
    // phone vem direto da tabela athletes
    sb.from('athletes')
      .select('id, phone')
      .in('id', athletes.map(a => a.id)),
  ])

  const lastActivityByAthlete = new Map<string, string>()
  for (const act of recentActivities ?? []) {
    if (!lastActivityByAthlete.has(act.athlete_id)) lastActivityByAthlete.set(act.athlete_id, act.started_at)
  }
  const phoneById = new Map((phones ?? []).map(p => [p.id, p.phone]))

  return athletes.map(a => {
    const rows = (metrics ?? []).filter(m => m.athlete_id === a.id).sort((x, y) => y.date.localeCompare(x.date))
    const latest = rows[0] ?? null
    return {
      id: a.id, full_name: a.full_name, primary_sport: a.primary_sport,
      phone: phoneById.get(a.id) ?? null, ctl: a.ctl ?? null, atl: a.atl ?? null, tsb: a.tsb ?? null,
      latest_date: latest?.date ?? null,
      hrv_ms: latest?.hrv_ms ?? null, body_battery: latest?.body_battery ?? null,
      sleep_hours: latest?.sleep_hours ?? null, rem_pct: latest?.rem_pct ?? null,
      resting_hr: latest?.resting_hr ?? null, stress_avg: latest?.stress_avg ?? null,
      last_activity_at: lastActivityByAthlete.get(a.id) ?? null,
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
  fat_mass_kg: number | null
  lean_mass_kg: number | null
  lean_mass_pct: number | null
  waist_hip_ratio: number | null
  body_density: number | null
  skinfold_sum_mm: number | null
  arm_muscle_area: number | null
  arm_fat_area: number | null
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

// ─── Prontuário médico (migração 013) ───────────────────────────────────────

export type MedicalRecordRow = {
  id: string
  athlete_id: string
  record_type: string
  title: string | null
  performed_at: string
  expires_at: string | null
  doctor_name: string | null
  lab_name: string | null
  result: string | null
  notes: string | null
}

export type MedicalProfileRow = {
  athlete_id: string
  blood_type: string | null
  allergies: string | null
  medications: string | null
  surgeries: string | null
  conditions: string | null
  family_history: string | null
  emergency_contact: string | null
}

/** Retorna null quando a tabela ainda não existe (migração 013 não aplicada) */
export async function getMedicalRecords(athleteId: string): Promise<MedicalRecordRow[] | null> {
  const sb = createClient()
  const { data, error } = await sb.from('medical_records').select('*').eq('athlete_id', athleteId).order('performed_at', { ascending: false })
  if (error) { console.error('[queries]', error.message); return null }
  return (data ?? []) as MedicalRecordRow[]
}

export async function getMedicalProfile(athleteId: string): Promise<MedicalProfileRow | null> {
  const sb = createClient()
  const { data, error } = await sb.from('athlete_medical_profile').select('*').eq('athlete_id', athleteId).maybeSingle()
  if (error) { console.error('[queries]', error.message); return null }
  return data as MedicalProfileRow | null
}

// ─── Treino de força (migração 014) ─────────────────────────────────────────

export type StrengthProgramRow = {
  id: string
  athlete_id: string
  name: string
  template_key: string | null
  goal: string | null
  phase: string | null
  active: boolean
  structure: import('@/lib/strength-templates').StrengthDay[]
  notes: string | null
  created_at: string
}

export type StrengthPRRow = {
  id: string
  athlete_id: string
  exercise: string
  measured_at: string
  one_rm_kg: number
  estimated: boolean
  notes: string | null
}

/** null quando a tabela não existe (migração 014 não aplicada) */
export async function getStrengthPrograms(athleteId: string): Promise<StrengthProgramRow[] | null> {
  const sb = createClient()
  const { data, error } = await sb.from('strength_programs').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false })
  if (error) { console.error('[queries]', error.message); return null }
  return (data ?? []) as StrengthProgramRow[]
}

export async function getStrengthPRs(athleteId: string): Promise<StrengthPRRow[]> {
  const sb = createClient()
  const { data, error } = await sb.from('strength_prs').select('*').eq('athlete_id', athleteId).order('measured_at', { ascending: false })
  if (error) { console.error('[queries]', error.message); return [] }
  return (data ?? []) as StrengthPRRow[]
}

/** Uma série executada: repetições feitas e carga usada (strings p/ aceitar "45s", "corporal", etc.) */
export type StrengthSetLog = { reps: string; load: string; done: boolean }
export type StrengthLogExercise = {
  name: string
  muscle?: string
  done: boolean          // true se ao menos uma série foi concluída (compat. c/ visão do coach)
  load?: string          // resumo legível das séries válidas, ex.: "12×40 · 10×42" (compat.)
  reps?: string          // prescrição de reps do programa
  sets?: StrengthSetLog[] // detalhe série-a-série (executor dinâmico)
  notes?: string
}
export type StrengthLogRow = {
  id: string
  day_label: string | null
  performed_at: string
  rpe: number | null
  completed: StrengthLogExercise[]
  notes: string | null
}

/** Registros de força do atleta, lado do coach (migração 015). null se a tabela não existe. */
export async function getStrengthLogs(athleteId: string): Promise<StrengthLogRow[] | null> {
  const sb = createClient()
  const { data, error } = await sb.from('strength_logs')
    .select('id, day_label, performed_at, rpe, completed, notes')
    .eq('athlete_id', athleteId).order('performed_at', { ascending: false }).limit(30)
  if (error) { console.error('[queries]', error.message); return null }
  return (data ?? []) as StrengthLogRow[]
}

// ─── Portal do atleta: treino de força (RPCs da migração 015) ───────────────

export type PortalStrengthProgram = {
  id: string
  name: string
  goal: string | null
  structure: import('@/lib/strength-templates').StrengthDay[]
}

export async function portalGetStrengthProgram(token: string): Promise<PortalStrengthProgram | null> {
  const sb = createClient()
  const { data, error } = await sb.rpc('portal_get_strength_program', { p_token: token })
  if (error) { console.error('[portal]', error.message); return null }
  return data as PortalStrengthProgram | null
}

export async function portalLogStrength(token: string, log: {
  program_id: string | null; day_label: string | null; rpe: number | null
  completed: StrengthLogExercise[]; notes: string | null
}): Promise<boolean> {
  const sb = createClient()
  const { data, error } = await sb.rpc('portal_log_strength', {
    p_token: token, p_program_id: log.program_id, p_day_label: log.day_label,
    p_rpe: log.rpe, p_completed: log.completed, p_notes: log.notes,
  })
  if (error) { console.error('[portal]', error.message); return false }
  return data === true
}

export async function portalGetStrengthLogs(token: string): Promise<StrengthLogRow[]> {
  const sb = createClient()
  const { data, error } = await sb.rpc('portal_get_strength_logs', { p_token: token })
  if (error) { console.error('[portal]', error.message); return [] }
  return (data ?? []) as StrengthLogRow[]
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

export type AthleteDocumentRow = {
  id: string
  athlete_id: string
  area: 'saude' | 'nutricao'
  file_name: string
  storage_path: string
  uploaded_at: string
}

export async function getAthleteDocuments(athleteId: string, area: 'saude' | 'nutricao'): Promise<AthleteDocumentRow[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('athlete_documents')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('area', area)
    .order('uploaded_at', { ascending: false })
  if (error) { console.error('[queries]', error.message); return [] }
  return (data ?? []) as AthleteDocumentRow[]
}

// ─── Portal do Aluno (acesso por token) ──────────────────────────────────────

export type PortalAthlete = {
  full_name: string
  primary_sport: string
  metrics: {
    date: string; ctl: number | null; atl: number | null; tsb: number | null
    hrv_ms: number | null; body_battery: number | null; sleep_hours: number | null
    rem_pct: number | null; resting_hr: number | null
  } | null
  activities: { name: string | null; sport: string; started_at: string; duration_seconds: number; distance_meters: number | null; tss: number | null }[]
}

export type CheckinRow = {
  checkin_date: string
  rpe: number | null
  soreness: number | null
  sleep_quality: number | null
  mood: number | null
  pain_location: string | null
  notes: string | null
}

export async function portalGetAthlete(token: string): Promise<PortalAthlete | null> {
  const sb = createClient()
  const { data, error } = await sb.rpc('portal_get_athlete', { p_token: token })
  if (error) { console.error('[portal]', error.message); return null }
  return data as PortalAthlete | null
}

export async function portalGetCheckins(token: string): Promise<CheckinRow[]> {
  const sb = createClient()
  const { data, error } = await sb.rpc('portal_get_checkins', { p_token: token })
  if (error) { console.error('[portal]', error.message); return [] }
  return (data ?? []) as CheckinRow[]
}

export async function portalSubmitCheckin(token: string, c: {
  rpe: number | null; soreness: number | null; sleep_quality: number | null
  mood: number | null; pain_location: string | null; notes: string | null
}): Promise<boolean> {
  const sb = createClient()
  const { data, error } = await sb.rpc('portal_submit_checkin', {
    p_token: token, p_rpe: c.rpe, p_soreness: c.soreness, p_sleep_quality: c.sleep_quality,
    p_mood: c.mood, p_pain_location: c.pain_location, p_notes: c.notes,
  })
  if (error) { console.error('[portal]', error.message); return false }
  return data === true
}

/** Check-ins de um atleta, para o coach (lado autenticado) */
export async function getAthleteCheckins(athleteId: string, days = 30): Promise<CheckinRow[]> {
  const sb = createClient()
  const from = new Date(); from.setDate(from.getDate() - days)
  const { data, error } = await sb
    .from('athlete_checkins')
    .select('checkin_date, rpe, soreness, sleep_quality, mood, pain_location, notes')
    .eq('athlete_id', athleteId)
    .gte('checkin_date', from.toISOString().slice(0, 10))
    .order('checkin_date', { ascending: false })
  if (error) { console.error('[queries]', error.message); return [] }
  return (data ?? []) as CheckinRow[]
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

// ─── Login do atleta (migração 016) ─────────────────────────────────────────

/** id do atleta vinculado à conta logada; null se a conta for de treinador */
export async function getMyAthleteId(): Promise<string | null> {
  const sb = createClient()
  const { data, error } = await sb.rpc('my_athlete_id')
  if (error) { console.error('[queries]', error.message); return null }
  return (data as string | null) ?? null
}

/** Vincula a conta logada a um atleta pelo código de acesso (portal_token) */
export async function claimAthleteProfile(token: string): Promise<{ ok: boolean; error?: string; full_name?: string }> {
  const sb = createClient()
  const { data, error } = await sb.rpc('claim_athlete_profile', { p_token: token })
  if (error) { console.error('[queries]', error.message); return { ok: false, error: 'falha' } }
  return data as { ok: boolean; error?: string; full_name?: string }
}

// ─── Cadastro central de acesso (migração 017 + Netlify Function) ───────────

export type AdminCreateUserInput = {
  role: 'athlete' | 'coach' | 'admin'
  email: string
  password: string
  full_name: string
  athlete_id?: string          // vincular a atleta existente
  athlete?: {                  // criar atleta novo junto com o acesso
    primary_sport?: string; phone?: string; weight_kg?: number
    ftp_watts?: number; lthr_bpm?: number; vo2max_ml_kg_min?: number; goal?: string
  }
}

/** Cria uma conta (atleta/treinador/admin) com senha temporária via Netlify Function. */
export async function adminCreateUser(input: AdminCreateUserInput): Promise<{ ok: boolean; error?: string; userId?: string; athleteId?: string }> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  try {
    const res = await fetch('/api/admin-create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(input),
    })
    const text = await res.text()
    let data: { error?: string; userId?: string; athleteId?: string } = {}
    try { data = JSON.parse(text) } catch { /* resposta não-JSON (ex.: erro 500 do runtime) */ }
    if (!res.ok) {
      return { ok: false, error: data.error ?? (text ? `Erro ${res.status}: ${text.slice(0, 140)}` : `Erro ${res.status}`) }
    }
    return { ok: true, userId: data.userId, athleteId: data.athleteId }
  } catch {
    return { ok: false, error: 'Falha de rede ao criar cadastro' }
  }
}

/** Atletas do treinador/admin que ainda não têm acesso ao app (sem user_id). */
export async function getAthletesWithoutAccess(): Promise<{ id: string; full_name: string; email: string | null }[]> {
  const sb = createClient()
  const { data, error } = await sb.from('athletes')
    .select('id, full_name, email, user_id, active')
    .is('user_id', null).eq('active', true).order('full_name')
  if (error) { console.error('[queries]', error.message); return [] }
  return (data ?? []).map(a => ({ id: a.id, full_name: a.full_name, email: a.email }))
}

/** Dados que o atleta logado vê de si mesmo (via RLS de autoacesso) */
export async function getAthleteSelf(athleteId: string) {
  const sb = createClient()
  const since = new Date(); since.setDate(since.getDate() - 30)
  const todayISO = new Date().toLocaleDateString('en-CA')
  const in14 = new Date(); in14.setDate(in14.getDate() + 14)
  const [summary, metrics, activities, checkins, programs, logs, plans] = await Promise.all([
    sb.from('v_athlete_summary').select('id, full_name, primary_sport, ctl, atl, tsb').eq('id', athleteId).maybeSingle(),
    sb.from('daily_metrics').select('date, hrv_ms, body_battery, sleep_hours, resting_hr').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(1),
    sb.from('activities').select('name, sport, started_at, duration_seconds, distance_meters, tss').eq('athlete_id', athleteId).order('started_at', { ascending: false }).limit(5),
    sb.from('athlete_checkins').select('checkin_date, rpe, soreness, sleep_quality, mood, pain_location, notes').eq('athlete_id', athleteId).order('checkin_date', { ascending: false }).limit(30),
    sb.from('strength_programs').select('id, name, goal, structure').eq('athlete_id', athleteId).eq('active', true).order('created_at', { ascending: false }).limit(1),
    sb.from('strength_logs').select('id, day_label, performed_at, rpe, completed, notes').eq('athlete_id', athleteId).order('performed_at', { ascending: false }).limit(30),
    sb.from('planned_workouts').select('id, athlete_id, date, sport, title, description, planned_duration_min, planned_tss, completed').eq('athlete_id', athleteId).gte('date', todayISO).lte('date', in14.toLocaleDateString('en-CA')).order('date').limit(20),
  ])
  return {
    summary: summary.data as { id: string; full_name: string; primary_sport: string; ctl: number | null; atl: number | null; tsb: number | null } | null,
    latestMetrics: (metrics.data?.[0] ?? null) as { date: string; hrv_ms: number | null; body_battery: number | null; sleep_hours: number | null; resting_hr: number | null } | null,
    activities: (activities.data ?? []) as { name: string | null; sport: string; started_at: string; duration_seconds: number; distance_meters: number | null; tss: number | null }[],
    checkins: (checkins.data ?? []) as CheckinRow[],
    program: (programs.data?.[0] ?? null) as PortalStrengthProgram | null,
    strengthLogs: (logs.data ?? []) as StrengthLogRow[],
    plannedWorkouts: (plans.data ?? []) as PlannedWorkoutRow[],
  }
}

/** Check-in do atleta logado (substitui o de hoje) */
export async function submitCheckinSelf(athleteId: string, c: {
  rpe: number | null; soreness: number | null; sleep_quality: number | null
  mood: number | null; pain_location: string | null; notes: string | null
}): Promise<boolean> {
  const sb = createClient()
  await sb.from('athlete_checkins').delete().eq('athlete_id', athleteId).eq('checkin_date', todayLocalISO()).eq('source', 'portal')
  const { error } = await sb.from('athlete_checkins').insert({ athlete_id: athleteId, ...c, source: 'portal' })
  if (error) { console.error('[queries]', error.message); return false }
  return true
}

/** Registro de treino de força do atleta logado */
export async function logStrengthSelf(athleteId: string, log: {
  program_id: string | null; day_label: string | null; rpe: number | null
  completed: StrengthLogExercise[]; notes: string | null
}): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('strength_logs').insert({ athlete_id: athleteId, ...log, source: 'portal' })
  if (error) { console.error('[queries]', error.message); return false }
  return true
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

/** Vínculo treinador ⇄ atleta (admin — migração 019). */
export type AthleteLinkRow = { id: string; full_name: string; coach_id: string; active: boolean }

/** Todos os atletas com seu treinador atual (admin vê todos via RLS da 019). */
export async function getAthletesForAdmin(): Promise<AthleteLinkRow[]> {
  const sb = createClient()
  const { data, error } = await sb.from('athletes').select('id, full_name, coach_id, active').order('full_name')
  if (error) { console.error('[queries]', error.message); return [] }
  return (data ?? []) as AthleteLinkRow[]
}

/** Reatribui um atleta a outro treinador (admin). */
export async function updateAthleteCoach(athleteId: string, coachId: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('athletes').update({ coach_id: coachId }).eq('id', athleteId)
  if (error) { console.error('[queries]', error.message); return false }
  return true
}

/** Admin edita o nome de um treinador/admin (RLS: admin atualiza qualquer profile). */
export async function updateCoachName(coachId: string, fullName: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('profiles').update({ full_name: fullName }).eq('id', coachId)
  if (error) { console.error('[queries]', error.message); return false }
  return true
}

/** Redefine a senha de um usuário (via Netlify Function, service role). */
export async function adminResetPassword(userId: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  try {
    const res = await fetch('/api/admin-reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ user_id: userId, password }),
    })
    const text = await res.text()
    let data: { error?: string } = {}
    try { data = JSON.parse(text) } catch { /* não-JSON */ }
    if (!res.ok) return { ok: false, error: data.error ?? `Erro ${res.status}: ${text.slice(0, 140)}` }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Falha de rede ao redefinir senha' }
  }
}

/** Sobe uma foto de perfil para o bucket avatars e devolve a URL pública. */
export async function uploadAvatar(userId: string, file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
  const sb = createClient()
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/avatar-${Date.now()}.${ext}`
  const { error: upErr } = await sb.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
  if (upErr) { console.error('[queries]', upErr.message); return { ok: false, error: upErr.message } }
  const { data } = sb.storage.from('avatars').getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
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
