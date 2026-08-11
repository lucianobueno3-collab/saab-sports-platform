import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// O @supabase/supabase-js exige WebSocket global (nativo só no Node >= 22).
if (!globalThis.WebSocket) globalThis.WebSocket = ws

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Exclui um treinador/admin: remove o profile e o login (auth). Só admin pode,
// e não é possível excluir a si mesmo. Como `athletes.coach_id` é ON DELETE
// CASCADE, apagar um treinador que ainda tem atletas apagaria esses atletas —
// então bloqueamos e pedimos para reatribuir os atletas antes. O eventual
// perfil de atleta do próprio treinador (conta dupla) é removido junto.
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
    if (myProfile?.role !== 'admin') return json({ error: 'Apenas administradores podem excluir treinadores' }, 403)

    let body
    try { body = await req.json() } catch { return json({ error: 'Requisição inválida' }, 400) }
    const userId = String(body.user_id ?? '').trim()
    if (!userId) return json({ error: 'Treinador não informado' }, 400)
    if (userId === me.id) return json({ error: 'Você não pode excluir a própria conta.' }, 400)

    const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: target, error: findErr } = await admin.from('profiles').select('id, role').eq('id', userId).single()
    if (findErr || !target) return json({ error: 'Treinador não encontrado' }, 404)

    // Atletas de outros usuários sob este treinador (exclui o perfil-atleta dele mesmo)
    const { data: coached, error: cErr } = await admin.from('athletes').select('id, user_id').eq('coach_id', userId)
    if (cErr) return json({ error: cErr.message }, 400)
    const others = (coached ?? []).filter(a => a.user_id !== userId)
    if (others.length > 0) {
      return json({ error: `Este treinador tem ${others.length} atleta(s). Reatribua-os a outro treinador antes de excluí-lo (bloco "Vínculo treinador ⇄ atleta").` }, 409)
    }

    // Apaga o login: cascata remove o profile e o perfil-atleta próprio (se houver)
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) return json({ error: delErr.message ?? 'Falha ao excluir o treinador' }, 400)

    return json({ ok: true })
  } catch (e) {
    return json({ error: 'Erro no servidor: ' + (e?.message ?? String(e)) }, 500)
  }
}

export const config = { path: '/api/admin-delete-staff' }
