import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// Polyfill de WebSocket (nativo só no Node >= 22) para o supabase-js.
if (!globalThis.WebSocket) globalThis.WebSocket = ws

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Redefine a senha de um usuário para uma nova senha temporária, forçando
// a troca no próximo login. Admin pode redefinir qualquer conta; treinador
// só de atletas dele.
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!URL || !ANON) return json({ error: 'Servidor sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY.' }, 500)
  if (!SERVICE) return json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY. Configure no Netlify e refaça o deploy.' }, 500)

  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Não autenticado' }, 401)

    const caller = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user: me }, error: meErr } = await caller.auth.getUser()
    if (meErr || !me) return json({ error: 'Sessão inválida. Entre novamente.' }, 401)
    const { data: myProfile } = await caller.from('profiles').select('role').eq('id', me.id).single()
    const myRole = myProfile?.role
    if (myRole !== 'admin' && myRole !== 'coach') return json({ error: 'Sem permissão' }, 403)

    let body
    try { body = await req.json() } catch { return json({ error: 'Requisição inválida' }, 400) }
    const userId = String(body.user_id ?? '')
    const password = String(body.password ?? '')
    if (!userId) return json({ error: 'Usuário não informado' }, 400)
    if (password.length < 6) return json({ error: 'A senha precisa de ao menos 6 caracteres' }, 400)

    const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

    // Treinador só redefine senha dos próprios atletas
    if (myRole !== 'admin') {
      const { data: ath } = await admin.from('athletes').select('id').eq('user_id', userId).eq('coach_id', me.id).maybeSingle()
      if (!ath) return json({ error: 'Você só pode redefinir a senha dos seus atletas.' }, 403)
    }

    // Preserva o user_metadata e apenas religa a flag de troca de senha
    const { data: target, error: getErr } = await admin.auth.admin.getUserById(userId)
    if (getErr || !target?.user) return json({ error: 'Usuário não encontrado' }, 404)
    const meta = { ...(target.user.user_metadata ?? {}), must_change_password: true }

    const { error } = await admin.auth.admin.updateUserById(userId, { password, user_metadata: meta })
    if (error) return json({ error: error.message }, 400)

    return json({ ok: true })
  } catch (e) {
    return json({ error: 'Erro no servidor: ' + (e?.message ?? String(e)) }, 500)
  }
}

export const config = { path: '/api/admin-reset-password' }
