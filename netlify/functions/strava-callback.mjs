import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import ws from 'ws'

if (!globalThis.WebSocket) globalThis.WebSocket = ws

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const CLIENT_ID = process.env.STRAVA_CLIENT_ID
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET
const APP_URL = (process.env.APP_URL || 'https://saab-sports-platform.netlify.app').replace(/\/$/, '')

function back(status, msg) {
  const url = `${APP_URL}/atleta?strava=${status}${msg ? `&msg=${encodeURIComponent(msg)}` : ''}`
  return new Response(null, { status: 302, headers: { Location: url } })
}

/** Confere a assinatura do state (evita alguém conectar a conta de outro). */
function verifyState(state, secret) {
  const [athleteId, mac] = String(state ?? '').split('.')
  if (!athleteId || !mac) return null
  const expected = crypto.createHmac('sha256', secret).update(athleteId).digest('hex').slice(0, 32)
  const a = Buffer.from(mac), b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return athleteId
}

// O Strava redireciona para cá após o aluno autorizar. Troca o code por tokens.
export default async (req) => {
  if (!URL_ || !SERVICE) return back('erro', 'Servidor sem Supabase configurado.')
  if (!CLIENT_ID || !CLIENT_SECRET) return back('erro', 'Strava não configurado no servidor.')

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    if (error) return back('cancelado')
    if (!code || !state) return back('erro', 'Retorno inválido do Strava.')

    const athleteId = verifyState(state, SERVICE)
    if (!athleteId) return back('erro', 'Não foi possível validar a solicitação.')

    // Troca o código por tokens
    const resp = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, grant_type: 'authorization_code' }),
    })
    if (!resp.ok) {
      const t = await resp.text().catch(() => '')
      return back('erro', `Strava recusou a autorização (${resp.status}). ${t.slice(0, 80)}`)
    }
    const tk = await resp.json()

    const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: upErr } = await admin.from('strava_connections').upsert({
      athlete_id: athleteId,
      strava_athlete_id: tk.athlete?.id ?? null,
      access_token: tk.access_token,
      refresh_token: tk.refresh_token,
      expires_at: tk.expires_at,
      scope: url.searchParams.get('scope') ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'athlete_id' })
    if (upErr) return back('erro', 'Falha ao guardar a conexão.')

    await admin.from('athletes').update({
      strava_athlete_id: tk.athlete?.id ?? null,
      strava_connected_at: new Date().toISOString(),
    }).eq('id', athleteId)

    return back('ok')
  } catch (e) {
    return back('erro', e?.message ?? 'Erro inesperado.')
  }
}

export const config = { path: '/api/strava-callback' }
