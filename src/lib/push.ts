/**
 * Notificações no aparelho do aluno.
 *
 * O aluno instalava o app e esquecia dele: o recado do treinador ficava
 * esperando alguém abrir a tela. Aqui ele é avisado mesmo com o app fechado.
 *
 * A chave pública VAPID vem de `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Sem ela nada
 * disso aparece na interface — é o que mantém o app funcionando normalmente
 * enquanto as chaves não estão configuradas no Netlify.
 */

import { createClient } from '@/lib/supabase/client'

export const CHAVE_PUBLICA = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').trim()

export type EstadoDoPush =
  | 'indisponivel'      // navegador sem suporte
  | 'sem-chave'         // VAPID não configurada — recurso desligado
  | 'precisa-instalar'  // iPhone no Safari: só funciona com o app instalado
  | 'negado'            // o aluno recusou; só ele reverte, nas configurações
  | 'desligado'         // dá para ligar
  | 'ligado'

/** O navegador tem as peças necessárias? */
export function temSuporte(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

/** O app está rodando instalado (tela de início), e não numa aba do navegador. */
export function estaInstalado(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    // iOS antigo não implementa display-mode e usa esta propriedade própria.
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

function ehIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    // iPad moderno se apresenta como Mac; o toque é o que o denuncia.
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * Em que pé está a permissão neste aparelho.
 *
 * A checagem do iPhone vem antes da de permissão de propósito: no Safari em
 * aba, pedir permissão falha em silêncio, e o aluno ficaria olhando um botão
 * que não faz nada.
 */
export async function estadoDoPush(): Promise<EstadoDoPush> {
  if (!temSuporte()) return ehIOS() && !estaInstalado() ? 'precisa-instalar' : 'indisponivel'
  if (!CHAVE_PUBLICA) return 'sem-chave'
  if (ehIOS() && !estaInstalado()) return 'precisa-instalar'
  if (Notification.permission === 'denied') return 'negado'

  const reg = await navigator.serviceWorker.getRegistration()
  const inscricao = await reg?.pushManager.getSubscription()
  return inscricao ? 'ligado' : 'desligado'
}

/** A chave VAPID vem em base64url; o navegador quer bytes. */
function chaveEmBytes(base64url: string): Uint8Array {
  const preenchido = base64url.padEnd(base64url.length + (4 - base64url.length % 4) % 4, '=')
  const bruto = atob(preenchido.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...bruto].map(c => c.charCodeAt(0)))
}

/**
 * Pede permissão e registra o aparelho.
 *
 * Devolve o novo estado, para a tela mostrar o resultado sem recarregar.
 */
export async function ligarPush(athleteId: string): Promise<EstadoDoPush> {
  const estado = await estadoDoPush()
  if (estado !== 'desligado') return estado

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return permissao === 'denied' ? 'negado' : 'desligado'

  const reg = await navigator.serviceWorker.ready
  const inscricao = await reg.pushManager.subscribe({
    // Exigido pelos navegadores: só notificação que o aluno vê, nada em segundo
    // plano sem ele saber.
    userVisibleOnly: true,
    applicationServerKey: chaveEmBytes(CHAVE_PUBLICA) as BufferSource,
  })

  const bruto = inscricao.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  if (!bruto.endpoint || !bruto.keys?.p256dh || !bruto.keys.auth) return 'desligado'

  const sb = createClient()
  const { error } = await sb.from('push_subscriptions').upsert({
    athlete_id: athleteId,
    endpoint: bruto.endpoint,
    p256dh: bruto.keys.p256dh,
    auth: bruto.keys.auth,
    user_agent: navigator.userAgent.slice(0, 300),
  }, { onConflict: 'endpoint' })

  if (error) {
    console.error('[push]', error.message)
    // Não deixa a inscrição órfã no navegador: sem a linha no banco ninguém
    // enviaria nada, e o aluno veria "ligado" sem receber aviso nenhum.
    await inscricao.unsubscribe().catch(() => {})
    return 'desligado'
  }
  return 'ligado'
}

/** Desliga neste aparelho — os outros continuam recebendo. */
export async function desligarPush(): Promise<EstadoDoPush> {
  const reg = await navigator.serviceWorker.getRegistration()
  const inscricao = await reg?.pushManager.getSubscription()
  if (!inscricao) return 'desligado'

  const endpoint = inscricao.endpoint
  await inscricao.unsubscribe().catch(() => {})
  const sb = createClient()
  await sb.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return 'desligado'
}
