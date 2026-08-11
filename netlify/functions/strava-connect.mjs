import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import ws from 'ws'

if (!globalThis.WebSocket) globalThis.WebSocket = ws

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const CLIENT_ID = process.env.STRAVA_CLIENT_ID
const APP_URL = (process.env.APP_URL || 'https://saab-sports-platform.netlify.app').replace(/\/$/, '')

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Assina o athlete_id para voltar íntegro no callback (o Strava não manda auth). */
export function signState(athleteId, secret) {
  const mac = crypto.createHmac('sha256', secret).update(athleteId).digest('hex').slice(0, 32)
  return `${athleteId}.${mac}`
}

// Devolve a URL de autorização do Strava para o aluno conectar a conta.
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!URL_ || !ANON) return json({ error: 'Servidor sem Supabase configurado.' }, 500)
  if (!CLIENT_ID || !SERVICE) return json({ error: 'Strava não configurado: falta STRAVA_CLIENT_ID no Netlify.' }, 503)

  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Não autenticado' }, 401)
    const caller = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401)

    // Só conecta a conta do próprio atleta logado.
    const { data: athleteId, error } = await caller.rpc('my_athlete_id')
    if (error || !athleteId) return json({ error: 'Sua conta não está vinculada a um atleta.' }, 400)

    const state = signState(String(athleteId), SERVICE)
    const redirectUri = `${APP_URL}/api/strava-callback`
    const url = 'https://www.strava.com/oauth/authorize'
      + `?client_id=${encodeURIComponent(CLIENT_ID)}`
      + `&redirect_uri=${encodeURIComponent(redirectUri)}`
      + '&response_type=code&approval_prompt=auto'
      + '&scope=read,activity:read_all'
      + `&state=${encodeURIComponent(state)}`

    return json({ url })
  } catch (e) {
    return json({ error: 'Erro ao iniciar a conexão: ' + (e?.message ?? String(e)) }, 500)
  }
}

export const config = { path: '/api/strava-connect' }
