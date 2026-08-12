import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import webpush from 'web-push'

// O @supabase/supabase-js exige WebSocket global (nativo só no Node >= 22).
if (!globalThis.WebSocket) globalThis.WebSocket = ws

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const VAPID_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVADA = process.env.VAPID_PRIVATE_KEY
const VAPID_CONTATO = process.env.VAPID_SUBJECT || 'mailto:lucianobueno3@gmail.com'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/*
 * Envia notificação para os aparelhos de um aluno.
 *
 * Quem chama é o app (o treinador respondendo um recado, ou aplicando um
 * plano). O envio fica aqui e não no navegador porque exige a chave privada
 * VAPID — que nunca pode sair do servidor.
 *
 * Entrada: { athleteId, aviso: { titulo, corpo, url, tag } }
 * O texto vem montado do cliente por src/lib/push-mensagens.ts, que é testado.
 */
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)
  if (!URL_SB || !SERVICE) return json({ error: 'Supabase não configurado' }, 500)
  if (!VAPID_PUBLICA || !VAPID_PRIVADA) {
    // Sem chaves o recurso está desligado. Não é erro: o app deve seguir
    // funcionando normalmente, só sem avisar ninguém.
    return json({ ok: true, enviados: 0, motivo: 'VAPID não configurada' })
  }

  let body
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  const athleteId = String(body.athleteId ?? '')
  const aviso = body.aviso ?? {}
  if (!athleteId) return json({ error: 'athleteId é obrigatório' }, 400)
  if (!aviso.titulo || !aviso.corpo) return json({ error: 'aviso incompleto' }, 400)

  webpush.setVapidDetails(VAPID_CONTATO, VAPID_PUBLICA, VAPID_PRIVADA)
  const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false } })

  const { data: inscricoes, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('athlete_id', athleteId)

  if (error) return json({ error: error.message }, 500)
  if (!inscricoes?.length) return json({ ok: true, enviados: 0, motivo: 'aluno sem aparelho inscrito' })

  const payload = JSON.stringify({
    titulo: String(aviso.titulo).slice(0, 120),
    corpo: String(aviso.corpo).slice(0, 300),
    url: typeof aviso.url === 'string' && aviso.url.startsWith('/') ? aviso.url : '/atleta',
    tag: String(aviso.tag ?? 'saab').slice(0, 80),
  })

  let enviados = 0
  const mortos = []

  await Promise.all(inscricoes.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60 * 12 },   // 12h: aviso de treino não serve no dia seguinte
      )
      enviados++
    } catch (e) {
      // 404/410 = o navegador descartou a inscrição (app desinstalado, cache
      // limpo). Guardar isso para sempre acumularia lixo e faria toda tentativa
      // futura falhar, então a linha sai.
      if (e?.statusCode === 404 || e?.statusCode === 410) mortos.push(s.id)
      else console.error('[push]', s.endpoint.slice(0, 60), e?.statusCode, e?.body ?? e?.message)
    }
  }))

  if (mortos.length) {
    await admin.from('push_subscriptions').delete().in('id', mortos)
  }
  if (enviados) {
    await admin.from('push_subscriptions')
      .update({ last_ok_at: new Date().toISOString() })
      .eq('athlete_id', athleteId)
  }

  return json({ ok: true, enviados, removidos: mortos.length })
}

export const config = { path: '/api/send-push' }
