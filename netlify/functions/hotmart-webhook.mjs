import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// O @supabase/supabase-js exige WebSocket global (nativo só no Node >= 22).
if (!globalThis.WebSocket) globalThis.WebSocket = ws

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const HOTTOK = process.env.HOTMART_HOTTOK            // token de verificação do webhook
const PRODUCT_ID = (process.env.HOTMART_PRODUCT_ID ?? '').trim() // opcional: filtra o produto

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Eventos de compra aprovada → marca como pago; estornos/cancelamentos → ajusta.
const APPROVED = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE']
const REFUND = ['PURCHASE_REFUNDED', 'PURCHASE_PROTEST', 'PURCHASE_CHARGEBACK']
const CANCEL = ['PURCHASE_CANCELED', 'PURCHASE_EXPIRED', 'PURCHASE_DELAYED']

const lower = (s) => String(s ?? '').trim().toLowerCase()

// Webhook do Hotmart (Postback/Webhook 2.0). Confirma o pagamento e marca a
// anamnese correspondente (casada pelo e-mail do comprador). Segurança: exige
// o HOTMART_HOTTOK (via header x-hotmart-hottok ou campo hottok no corpo).
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!URL || !SERVICE) return json({ error: 'Servidor sem Supabase configurado.' }, 500)
  if (!HOTTOK) return json({ error: 'Servidor sem HOTMART_HOTTOK configurado.' }, 500)

  // Corpo pode vir como JSON (Webhook 2.0) ou form-urlencoded (Postback 1.0).
  const raw = await req.text()
  let body = {}
  try { body = JSON.parse(raw) } catch {
    try { body = Object.fromEntries(new URLSearchParams(raw)) } catch { body = {} }
  }

  // Verificação do token (header tem prioridade; cai para o corpo).
  const token = req.headers.get('x-hotmart-hottok') || body.hottok || body?.data?.hottok
  if (token !== HOTTOK) return json({ error: 'Token inválido' }, 401)

  const event = String(body.event ?? body.status ?? '').toUpperCase()
  const data = body.data ?? body

  // E-mail do comprador (nomes variam entre versões do payload).
  const email = lower(
    data?.buyer?.email ?? data?.email ?? data?.customer?.email ?? body?.email,
  )
  const transaction = String(
    data?.purchase?.transaction ?? data?.transaction ?? body?.transaction ?? '',
  ).trim() || null

  // Filtro opcional por produto.
  if (PRODUCT_ID) {
    const pid = String(data?.product?.id ?? data?.prod ?? body?.prod ?? '').trim()
    if (pid && pid !== PRODUCT_ID) return json({ ok: true, ignored: 'outro_produto' })
  }

  // Classifica o evento. Para status "raw" (Postback 1.0) mapeia strings comuns.
  const rawStatus = String(data?.purchase?.status ?? data?.status ?? '').toUpperCase()
  let payment_status = null
  if (APPROVED.includes(event) || ['APPROVED', 'COMPLETE'].includes(rawStatus)) payment_status = 'approved'
  else if (REFUND.includes(event) || ['REFUNDED', 'CHARGEBACK'].includes(rawStatus)) payment_status = 'refunded'
  else if (CANCEL.includes(event) || ['CANCELED', 'CANCELLED', 'EXPIRED'].includes(rawStatus)) payment_status = 'canceled'

  // Evento que não muda o pagamento (ex.: carrinho abandonado): 200 e ignora.
  if (!payment_status) return json({ ok: true, ignored: event || 'sem_evento' })
  if (!email) return json({ ok: true, ignored: 'sem_email' })

  const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

  // Casa pela anamnese mais recente do e-mail do comprador.
  const { data: found, error: fErr } = await admin.from('anamneses')
    .select('id')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (fErr) return json({ error: fErr.message }, 500)
  if (!found) return json({ ok: true, ignored: 'anamnese_nao_encontrada', email })

  const patch = { payment_status, payment_source: 'hotmart' }
  if (transaction) patch.payment_ref = transaction
  if (payment_status === 'approved') patch.paid_at = new Date().toISOString()

  const { error: uErr } = await admin.from('anamneses').update(patch).eq('id', found.id)
  if (uErr) return json({ error: uErr.message }, 500)

  return json({ ok: true, matched: found.id, payment_status })
}

export const config = { path: '/api/hotmart-webhook' }
