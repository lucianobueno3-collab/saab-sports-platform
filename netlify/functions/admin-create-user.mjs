import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Cadastro central: admin cria treinador/admin/atleta; treinador cria atleta.
// A conta nasce com senha temporária e a flag must_change_password = true,
// forçando a troca no primeiro login.
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Sem as variáveis de ambiente a função não consegue operar — erro claro.
  if (!URL || !ANON) return json({ error: 'Servidor sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY configurados.' }, 500)
  if (!SERVICE) return json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY. Configure-a nas variáveis de ambiente do Netlify e refaça o deploy.' }, 500)

  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Não autenticado' }, 401)

    // Identifica quem está chamando (via token do usuário logado)
    const caller = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user: me }, error: meErr } = await caller.auth.getUser()
    if (meErr || !me) return json({ error: 'Sessão inválida. Entre novamente.' }, 401)
    const { data: myProfile } = await caller.from('profiles').select('role').eq('id', me.id).single()
    const myRole = myProfile?.role
    if (myRole !== 'admin' && myRole !== 'coach') return json({ error: 'Sem permissão para cadastrar' }, 403)

    let body
    try { body = await req.json() } catch { return json({ error: 'Requisição inválida' }, 400) }

    const role = body.role
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const full_name = String(body.full_name ?? '').trim()

    if (!['athlete', 'coach', 'admin'].includes(role)) return json({ error: 'Papel inválido' }, 400)
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'E-mail inválido' }, 400)
    if (password.length < 6) return json({ error: 'A senha temporária precisa de ao menos 6 caracteres' }, 400)
    if (!full_name && role !== 'athlete') return json({ error: 'Nome obrigatório' }, 400)

    // Treinador só cadastra atleta; treinador/admin exigem quem chama ser admin
    if ((role === 'coach' || role === 'admin') && myRole !== 'admin') {
      return json({ error: 'Apenas administradores podem cadastrar treinadores' }, 403)
    }

    const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

    // Atleta existente: valida posse ANTES de criar a conta
    let athleteId = body.athlete_id ?? null
    if (role === 'athlete' && athleteId) {
      const { data: ath, error } = await admin.from('athletes').select('id, coach_id, user_id, full_name').eq('id', athleteId).single()
      if (error || !ath) return json({ error: 'Atleta não encontrado' }, 404)
      if (myRole !== 'admin' && ath.coach_id !== me.id) return json({ error: 'Este atleta não é seu' }, 403)
      if (ath.user_id) return json({ error: 'Este atleta já tem acesso ao app' }, 409)
    }

    // Cria o usuário de autenticação (e-mail já confirmado + flag de troca de senha)
    const account_type = role === 'athlete' ? 'athlete' : 'staff'
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, account_type, must_change_password: true },
    })
    if (cErr) {
      const dup = /already been registered|already registered|exists|duplicate/i.test(cErr.message)
      return json({ error: dup ? 'Já existe uma conta com este e-mail.' : cErr.message }, 400)
    }
    const uid = created.user.id

    try {
      if (role === 'athlete') {
        await admin.from('profiles').delete().eq('id', uid) // defensivo (o trigger já ignora atletas)
        if (athleteId) {
          const { error } = await admin.from('athletes').update({ user_id: uid }).eq('id', athleteId)
          if (error) throw error
        } else {
          const a = body.athlete ?? {}
          const payload = { coach_id: me.id, full_name, email, user_id: uid, primary_sport: a.primary_sport ?? 'running' }
          if (a.phone) payload.phone = String(a.phone).replace(/\s/g, '')
          if (a.weight_kg) payload.weight_kg = Number(a.weight_kg)
          if (a.ftp_watts) payload.ftp_watts = Number(a.ftp_watts)
          if (a.lthr_bpm) payload.lthr_bpm = Number(a.lthr_bpm)
          if (a.vo2max_ml_kg_min) payload.vo2max_ml_kg_min = Number(a.vo2max_ml_kg_min)
          if (a.goal) payload.goal = String(a.goal).trim()
          const { data: ins, error } = await admin.from('athletes').insert(payload).select('id').single()
          if (error) throw error
          athleteId = ins.id
        }
      } else {
        // treinador / admin: garante profiles com nome + papel corretos
        const { error } = await admin.from('profiles').upsert({ id: uid, email, full_name, role }, { onConflict: 'id' })
        if (error) throw error
      }
    } catch (e) {
      // rollback: remove o usuário para não deixar conta órfã sem vínculo
      await admin.auth.admin.deleteUser(uid).catch(() => {})
      const msg = /uq_athlete_email|duplicate/i.test(e.message ?? '') ? 'Já existe um atleta com este e-mail.' : (e.message ?? 'Falha ao vincular o cadastro')
      return json({ error: msg }, 400)
    }

    return json({ ok: true, userId: uid, athleteId })
  } catch (e) {
    return json({ error: 'Erro no servidor: ' + (e?.message ?? String(e)) }, 500)
  }
}

export const config = { path: '/api/admin-create-user' }
