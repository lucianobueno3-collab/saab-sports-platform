'use client'

import { useEffect } from 'react'

/**
 * Registra o service worker que permite abrir o app sem internet.
 *
 * `updateViaCache: 'none'` obriga o navegador a checar o arquivo do worker na
 * rede, e não numa cópia velha — sem isso, uma correção no próprio worker
 * poderia demorar muito para chegar nos celulares.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // Em desenvolvimento atrapalha mais do que ajuda: o cache mascara alterações.
    if (process.env.NODE_ENV !== 'production') return

    const registrar = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        // Procura versão nova a cada volta para o app.
        const checar = () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) }
        document.addEventListener('visibilitychange', checar)
        return () => document.removeEventListener('visibilitychange', checar)
      } catch {
        // Sem service worker o app continua funcionando — só perde o modo offline.
      }
    }
    registrar()

    // Quando um worker NOVO substitui um antigo, recarrega uma vez para a tela
    // não misturar arquivos de duas versões. Na primeira instalação não há
    // troca de versão nenhuma, então não recarrega — evita o susto do reload
    // logo na primeira visita.
    const jaTinhaWorker = Boolean(navigator.serviceWorker.controller)
    let recarregou = false
    const onChange = () => {
      if (!jaTinhaWorker || recarregou) return
      recarregou = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange)
  }, [])

  return null
}
