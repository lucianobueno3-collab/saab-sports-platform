import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// O @supabase/supabase-js exige WebSocket global (nativo só no Node >= 22).
if (!globalThis.WebSocket) globalThis.WebSocket = ws

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || 'SAAB Sports <onboarding@resend.dev>'
const APP_URL = (process.env.APP_URL || 'https://saab-sports-platform.netlify.app').replace(/\/$/, '')

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))

function emailHtml({ firstName, loginUrl }) {
  const hi = firstName ? `Olá, ${esc(firstName)}!` : 'Olá!'
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16161f;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e6e6ee;border-radius:20px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#e8001c,#7a0010);padding:28px 28px 22px;text-align:center;">
        <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Seu plano está pronto! 🎉</div>
      </div>
      <div style="padding:28px;">
        <p style="font-size:16px;margin:0 0 12px;font-weight:700;">${hi}</p>
        <p style="font-size:15px;line-height:1.55;color:#3a3a46;margin:0 0 18px;">
          Seu treinador montou o seu plano de treino personalizado com base na sua anamnese.
          Os treinos já estão no seu calendário — é só entrar e começar.
        </p>
        <div style="text-align:center;margin:26px 0 8px;">
          <a href="${esc(loginUrl)}" style="display:inline-block;background:#e8001c;color:#fff;font-weight:800;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:14px;">
            Ver meus treinos
          </a>
        </div>
        <p style="font-size:12px;color:#8b8b98;text-align:center;margin:14px 0 0;">
          Entre com o e-mail e a senha que você cadastrou na matrícula.
        </p>
      </div>
    </div>
    <p style="text-align:center;font-size:12px;color:#a0a0ad;margin:18px 0 0;">SAAB Sports Performance</p>
  </div>
</body></html>`
}

// Notifica o aluno por e-mail quando o treinador aprova a matrícula (aplica o
// plano). Chamada apenas por staff; o destinatário é sempre o e-mail do próprio
// atleta buscado no servidor (nunca um endereço arbitrário do corpo da request).
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!URL || !ANON) return json({ error: 'Servidor sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY.' }, 500)
  if (!SERVICE) return json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY.' }, 500)

  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Não autenticado' }, 401)

    // Confere que quem chama é treinador/admin
    const caller = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user: me }, error: meErr } = await caller.auth.getUser()
    if (meErr || !me) return json({ error: 'Sessão inválida' }, 401)
    const { data: myProfile } = await caller.from('profiles').select('role').eq('id', me.id).single()
    if (myProfile?.role !== 'admin' && myProfile?.role !== 'coach') return json({ error: 'Sem permissão' }, 403)

    let body
    try { body = await req.json() } catch { return json({ error: 'Requisição inválida' }, 400) }
    const athleteId = String(body.athlete_id ?? '').trim()
    if (!athleteId) return json({ error: 'athlete_id obrigatório' }, 400)

    // Destinatário sempre buscado no servidor (anti-spam)
    const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: ath, error: aErr } = await admin.from('athletes').select('email, full_name').eq('id', athleteId).single()
    if (aErr || !ath) return json({ error: 'Atleta não encontrado' }, 404)
    if (!ath.email) return json({ ok: true, skipped: 'sem_email' })

    // Sem provedor configurado: não quebra a aprovação, só informa que pulou.
    if (!RESEND_API_KEY) return json({ ok: true, skipped: 'email_nao_configurado' })

    const firstName = (ath.full_name ?? '').trim().split(/\s+/)[0] || null
    const html = emailHtml({ firstName, loginUrl: `${APP_URL}/login` })

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [ath.email],
        subject: 'Seu plano de treino está pronto! 🎉 — SAAB Sports',
        html,
      }),
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return json({ error: `Falha no envio do e-mail: ${txt.slice(0, 160) || resp.status}` }, 502)
    }
    return json({ ok: true, sent: true })
  } catch (e) {
    return json({ error: 'Erro no servidor: ' + (e?.message ?? String(e)) }, 500)
  }
}

export const config = { path: '/api/notify-enrollment-approved' }
