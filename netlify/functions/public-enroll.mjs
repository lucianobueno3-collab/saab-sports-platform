import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// O @supabase/supabase-js exige WebSocket global (nativo só no Node >= 22).
if (!globalThis.WebSocket) globalThis.WebSocket = ws

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const RUN_LEVELS = ['iniciante', 'intermediario', 'avancado', 'competitivo']
const ACT_LEVELS = ['iniciante', 'intermediario', 'avancado']
const DAYS_RUNNING = ['1_2', '3', '4', '5_mais']
const WEEKLY_DIST = ['ate_15', '15_30', '30_40', '40_mais']
const GOALS = ['concluir_5_10k', 'meia_21k', 'maratona_42k', 'melhorar_ritmo']
const pick = (v, allowed) => (allowed.includes(v) ? v : null)

// Matrícula pública: cria a conta do aluno + registro em athletes + anamnese.
// Sem exigir login (é o funil de venda). A conta nasce com a senha escolhida
// pela pessoa (não força troca) e e-mail já confirmado para entrar na hora.
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!URL) return json({ error: 'Servidor sem NEXT_PUBLIC_SUPABASE_URL configurado.' }, 500)
  if (!SERVICE) return json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY. Configure-a no Netlify e refaça o deploy.' }, 500)

  let body
  try { body = await req.json() } catch { return json({ error: 'Requisição inválida' }, 400) }

  // Honeypot anti-bot: campo oculto que humanos não preenchem.
  if (body.website) return json({ ok: true })

  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const full_name = String(body.full_name ?? '').trim()
  const phone = String(body.phone ?? '').trim()

  if (!full_name) return json({ error: 'Informe seu nome.' }, 400)
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'E-mail inválido.' }, 400)
  if (password.length < 6) return json({ error: 'A senha precisa de ao menos 6 caracteres.' }, 400)

  const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

  // Cria o usuário de auth (e-mail confirmado, sem troca forçada de senha).
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name, account_type: 'athlete', must_change_password: false },
  })
  if (cErr) {
    const dup = /already been registered|already registered|exists|duplicate/i.test(cErr.message)
    return json({ error: dup ? 'Já existe uma conta com este e-mail. Faça login para continuar.' : cErr.message }, 400)
  }
  const uid = created.user.id

  try {
    // Atribui a um treinador/admin padrão (o primeiro admin, senão o primeiro coach),
    // para o aluno já aparecer no painel de quem vai montar o treino.
    let coachId = null
    const { data: adminProf } = await admin.from('profiles').select('id').eq('role', 'admin').order('created_at', { ascending: true }).limit(1).maybeSingle()
    coachId = adminProf?.id ?? null
    if (!coachId) {
      const { data: coachProf } = await admin.from('profiles').select('id').eq('role', 'coach').order('created_at', { ascending: true }).limit(1).maybeSingle()
      coachId = coachProf?.id ?? null
    }

    // defensivo: atleta não fica em profiles (o builder do supabase não expõe
    // .catch(), então usamos try/catch)
    try { await admin.from('profiles').delete().eq('id', uid) } catch { /* ignora */ }

    const athletePayload = { full_name, email, user_id: uid, primary_sport: 'running', active: true }
    if (coachId) athletePayload.coach_id = coachId
    if (phone) athletePayload.phone = phone.replace(/\s/g, '')
    if (Number(body.height_cm)) athletePayload.height_cm = Number(body.height_cm)
    if (Number(body.weight_kg)) athletePayload.weight_kg = Number(body.weight_kg)

    const { data: ath, error: aErr } = await admin.from('athletes').insert(athletePayload).select('id').single()
    if (aErr) throw aErr
    const athleteId = ath.id

    const anamnese = {
      athlete_id: athleteId, user_id: uid, package_key: String(body.package_key ?? 'primeiros_5k'),
      status: 'pending', full_name, email, phone: phone || null,
      age: Number(body.age) || null, height_cm: Number(body.height_cm) || null, weight_kg: Number(body.weight_kg) || null,
      currently_running: typeof body.currently_running === 'boolean' ? body.currently_running : null,
      running_level: pick(body.running_level, RUN_LEVELS),
      activity_level: pick(body.activity_level, ACT_LEVELS),
      days_running: pick(body.days_running, DAYS_RUNNING),
      weekly_distance: pick(body.weekly_distance, WEEKLY_DIST),
      goal: pick(body.goal, GOALS),
      preferred_days: Array.isArray(body.preferred_days)
        ? body.preferred_days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
        : null,
    }
    const { error: anErr } = await admin.from('anamneses').insert(anamnese)
    if (anErr) throw anErr

    return json({ ok: true, userId: uid, athleteId })
  } catch (e) {
    // Rollback: remove a conta para não deixar usuário órfão.
    await admin.auth.admin.deleteUser(uid).catch(() => {})
    const msg = /uq_athlete_email|duplicate/i.test(e?.message ?? '')
      ? 'Já existe um cadastro com este e-mail.'
      : (e?.message ?? 'Falha ao concluir a matrícula.')
    return json({ error: msg }, 400)
  }
}

export const config = { path: '/api/public-enroll' }
