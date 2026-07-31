import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

if (!globalThis.WebSocket) globalThis.WebSocket = ws

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const CLIENT_ID = process.env.STRAVA_CLIENT_ID
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Strava → modalidades do app
function mapSport(t = '') {
  const s = String(t).toLowerCase()
  if (s.includes('run')) return 'running'
  if (s.includes('ride') || s.includes('bike') || s.includes('cycl')) return 'cycling'
  if (s.includes('swim')) return 'swimming'
  if (s.includes('weight') || s.includes('workout') || s.includes('strength')) return 'strength'
  return 'other'
}

// hrTSS — mesma fórmula usada no app (IF limitado a 1.1)
function hrTss(durationSeconds, avgHr, lthr) {
  if (!durationSeconds || !avgHr || !lthr) return null
  const ifCapped = Math.min(avgHr / lthr, 1.1)
  return Math.round((durationSeconds / 3600) * ifCapped * ifCapped * 100)
}

/** Renova o token quando está para expirar (margem de 5 min). */
async function freshToken(admin, conn) {
  const now = Math.floor(Date.now() / 1000)
  if (conn.expires_at - now > 300) return conn.access_token
  const resp = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token', refresh_token: conn.refresh_token,
    }),
  })
  if (!resp.ok) throw new Error('Não foi possível renovar o acesso ao Strava. Reconecte a conta.')
  const tk = await resp.json()
  await admin.from('strava_connections').update({
    access_token: tk.access_token, refresh_token: tk.refresh_token,
    expires_at: tk.expires_at, updated_at: new Date().toISOString(),
  }).eq('athlete_id', conn.athlete_id)
  return tk.access_token
}

// Busca as atividades recentes do Strava e grava as que ainda não existem.
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!URL_ || !ANON || !SERVICE) return json({ error: 'Servidor sem Supabase configurado.' }, 500)
  if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: 'Strava não configurado no servidor.' }, 503)

  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Não autenticado' }, 401)
    const caller = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401)

    let body = {}
    try { body = await req.json() } catch { /* sem corpo: sincroniza o próprio atleta */ }

    // Atleta alvo: o próprio, ou outro se quem chama for treinador/admin.
    const { data: myAthleteId } = await caller.rpc('my_athlete_id')
    let athleteId = myAthleteId ?? null
    if (body.athlete_id && body.athlete_id !== myAthleteId) {
      const { data: prof } = await caller.from('profiles').select('role').eq('id', user.id).single()
      if (prof?.role !== 'coach' && prof?.role !== 'admin') return json({ error: 'Sem permissão' }, 403)
      athleteId = body.athlete_id
    }
    if (!athleteId) return json({ error: 'Atleta não identificado.' }, 400)

    const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: conn } = await admin.from('strava_connections').select('*').eq('athlete_id', athleteId).maybeSingle()
    if (!conn) return json({ error: 'Este atleta ainda não conectou o Strava.' }, 400)

    const access = await freshToken(admin, conn)

    // Janela: desde a última sincronização (com folga) ou os últimos 30 dias
    const { data: ath } = await admin.from('athletes')
      .select('strava_last_sync_at, lthr_run_bpm, lthr_bpm, lthr_bike_bpm').eq('id', athleteId).single()
    const since = ath?.strava_last_sync_at
      ? Math.floor(new Date(ath.strava_last_sync_at).getTime() / 1000) - 86400
      : Math.floor(Date.now() / 1000) - 30 * 86400

    const listResp = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${since}&per_page=100`, {
      headers: { Authorization: `Bearer ${access}` },
    })
    if (!listResp.ok) {
      const t = await listResp.text().catch(() => '')
      return json({ error: `Strava respondeu ${listResp.status}. ${t.slice(0, 120)}` }, 502)
    }
    const list = await listResp.json()
    if (!Array.isArray(list)) return json({ error: 'Resposta inesperada do Strava.' }, 502)

    // Já importadas
    const ids = list.map(a => a.id).filter(Boolean)
    const existing = new Set()
    if (ids.length) {
      const { data: have } = await admin.from('activities')
        .select('strava_activity_id').eq('athlete_id', athleteId).in('strava_activity_id', ids)
      for (const r of have ?? []) existing.add(Number(r.strava_activity_id))
    }

    const rows = []
    for (const a of list) {
      if (existing.has(Number(a.id))) continue
      const sport = mapSport(a.sport_type ?? a.type)
      const lthr = sport === 'cycling' ? (ath?.lthr_bike_bpm ?? ath?.lthr_bpm)
        : sport === 'running' ? (ath?.lthr_run_bpm ?? ath?.lthr_bpm) : ath?.lthr_bpm
      const dur = a.moving_time ?? a.elapsed_time ?? 0
      const tss = a.average_heartrate && lthr ? hrTss(dur, a.average_heartrate, lthr) : null
      rows.push({
        athlete_id: athleteId,
        strava_activity_id: a.id,
        name: a.name ?? null,
        sport,
        started_at: a.start_date,
        duration_seconds: dur,
        distance_meters: a.distance ?? null,
        avg_hr_bpm: a.average_heartrate ?? null,
        max_hr_bpm: a.max_heartrate ?? null,
        avg_power_watts: a.average_watts ?? null,
        max_power_watts: a.max_watts ?? null,
        avg_cadence_rpm: a.average_cadence ?? null,
        velocity_avg_mps: a.average_speed ?? null,
        velocity_max_mps: a.max_speed ?? null,
        calories: a.calories ?? null,
        tss,
        tss_method: tss != null ? 'hr' : null,
      })
    }

    let imported = 0
    if (rows.length) {
      const { data: ins, error: insErr } = await admin.from('activities').insert(rows).select('id')
      if (insErr) return json({ error: 'Falha ao salvar as atividades: ' + insErr.message }, 500)
      imported = ins?.length ?? rows.length
    }

    await admin.from('athletes').update({ strava_last_sync_at: new Date().toISOString() }).eq('id', athleteId)

    return json({ ok: true, found: list.length, imported, skipped: list.length - rows.length })
  } catch (e) {
    return json({ error: e?.message ?? 'Erro ao sincronizar com o Strava.' }, 500)
  }
}

export const config = { path: '/api/strava-sync' }
