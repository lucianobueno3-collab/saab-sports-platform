import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// O @supabase/supabase-js exige WebSocket global (nativo só no Node >= 22).
// Injeta o `ws` como polyfill para funcionar em qualquer runtime do Netlify.
if (!globalThis.WebSocket) globalThis.WebSocket = ws

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Exclui um aluno: apaga o registro em `athletes` (cascata remove métricas,
// atividades, check-ins, treinos, docs...) e, se o aluno tiver login próprio,
// remove também a conta de autenticação. Admin exclui qualquer aluno; treinador
// só os seus. Se o login for compartilhado com um treinador (conta dupla), o
// usuário de auth é preservado — só o vínculo de atleta é removido.
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (!URL || !ANON) return json({ error: 'Servidor sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY configurados.' }, 500)
  if (!SERVICE) return json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY. Configure-a nas variáveis de ambiente do Netlify e refaça o deploy.' }, 500)

  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Não autenticado' }, 401)

    const caller = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user: me }, error: meErr } = await caller.auth.getUser()
    if (meErr || !me) return json({ error: 'Sessão inválida. Entre novamente.' }, 401)
    const { data: myProfile } = await caller.from('profiles').select('role').eq('id', me.id).single()
    const myRole = myProfile?.role
    if (myRole !== 'admin' && myRole !== 'coach') return json({ error: 'Sem permissão para excluir' }, 403)

    let body
    try { body = await req.json() } catch { return json({ error: 'Requisição inválida' }, 400) }
    const athleteId = String(body.athlete_id ?? '').trim()
    if (!athleteId) return json({ error: 'Aluno não informado' }, 400)

    const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: ath, error: findErr } = await admin.from('athletes').select('id, coach_id, user_id').eq('id', athleteId).single()
    if (findErr || !ath) return json({ error: 'Aluno não encontrado' }, 404)
    // treinador só exclui os seus; admin exclui qualquer um
    if (myRole !== 'admin' && ath.coach_id !== me.id) return json({ error: 'Este aluno não é seu' }, 403)

    // Apaga o aluno (cascata remove todos os dados vinculados)
    const { error: delErr } = await admin.from('athletes').delete().eq('id', athleteId)
    if (delErr) return json({ error: delErr.message ?? 'Falha ao excluir o aluno' }, 400)

    // Remove a conta de login do aluno, se existir e não for de um treinador (conta dupla)
    if (ath.user_id) {
      const { data: staff } = await admin.from('profiles').select('id').eq('id', ath.user_id).maybeSingle()
      if (!staff) await admin.auth.admin.deleteUser(ath.user_id).catch(() => {})
    }

    return json({ ok: true })
  } catch (e) {
    return json({ error: 'Erro no servidor: ' + (e?.message ?? String(e)) }, 500)
  }
}

export const config = { path: '/api/admin-delete-athlete' }
