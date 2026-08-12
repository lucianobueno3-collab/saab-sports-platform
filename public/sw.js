/*
 * Service worker do portal do aluno.
 *
 * Objetivo: o aluno conseguir abrir o app e ver o treino do dia sem internet.
 *
 * REGRA QUE NÃO PODE SER QUEBRADA: nunca servir versão velha para quem está
 * online. Toda página é buscada na rede primeiro; o cache só entra quando a
 * rede falha. Assim um deploy novo aparece na hora, sem ninguém ficar preso
 * numa versão antiga.
 *
 * Nada de Supabase, Netlify Functions ou Strava é guardado — são respostas
 * autenticadas e mudam o tempo todo. Só o "casco" do app fica em cache; os
 * dados do treino são guardados à parte, em src/lib/offline-cache.ts.
 */

const VERSAO = 'v2'
const CASCO = `saab-casco-${VERSAO}`
const PAGINAS = `saab-paginas-${VERSAO}`
const OFFLINE = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CASCO)
      .then(c => c.addAll([OFFLINE]))
      // Assume o comando na hora, sem esperar as abas antigas fecharem.
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(
        nomes.filter(n => n !== CASCO && n !== PAGINAS).map(n => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  )
})

/** Arquivos do Next com hash no nome: o conteúdo nunca muda, cache é seguro. */
function ehArquivoImutavel(url) {
  return url.pathname.startsWith('/_next/static/')
}

/**
 * Grava a cópia antes de devolver a resposta.
 *
 * Precisa ser aguardado: se a gravação ficar solta, o navegador pode encerrar
 * o worker antes de ela terminar e a cópia offline fica velha. `event.waitUntil`
 * não serve aqui, porque só vale enquanto o evento está sendo despachado — e
 * neste ponto já passamos por um `await`.
 *
 * Falha ao gravar nunca pode derrubar a navegação, daí o try/catch.
 */
async function guardar(nomeDoCache, req, resp) {
  try {
    const cache = await caches.open(nomeDoCache)
    await cache.put(req, resp.clone())
  } catch {
    // Cota cheia ou resposta que não pode ser guardada: seguimos sem cópia.
  }
}

/** Só o nosso próprio site entra em cache. */
function ehDaCasa(url) {
  return url.origin === self.location.origin
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (!ehDaCasa(url)) return                        // Supabase, Strava, etc: passa direto
  if (url.pathname.startsWith('/api/')) return      // Netlify Functions: nunca guardar

  // Páginas: rede primeiro, cache só como rede de segurança.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const resp = await fetch(req)
        await guardar(PAGINAS, req, resp)
        return resp
      } catch {
        // Mesma página já visitada: a cópia serve como está.
        const guardada = await caches.match(req)
        if (guardada) return guardada

        // Página nunca aberta: cai no aviso de "sem conexão".
        //
        // O Chrome recusa uma resposta do cache cuja URL não é a da navegação
        // (aqui seria /offline.html respondendo por outro endereço) e a página
        // quebra com ERR_FAILED. Por isso montamos uma resposta nova com o
        // mesmo conteúdo, em vez de devolver a do cache direto.
        const off = await caches.match(OFFLINE)
        if (!off) return new Response('Sem conexão', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
        return new Response(await off.text(), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      }
    })())
    return
  }

  // Arquivos com hash: cache primeiro (o nome muda a cada build, então não empaca).
  if (ehArquivoImutavel(url)) {
    event.respondWith((async () => {
      const guardado = await caches.match(req)
      if (guardado) return guardado
      const resp = await fetch(req)
      await guardar(CASCO, req, resp)
      return resp
    })())
    return
  }

  // Demais arquivos nossos (ícones, logo): rede primeiro, cache como reserva.
  event.respondWith((async () => {
    try {
      const resp = await fetch(req)
      await guardar(CASCO, req, resp)
      return resp
    } catch {
      const guardado = await caches.match(req)
      if (guardado) return guardado
      throw new Error('sem conexão e sem cópia local')
    }
  })())
})


/* ─── Notificações ──────────────────────────────────────────────────────────
 *
 * O aluno instalava o app e depois esquecia dele: o recado do treinador ficava
 * esperando alguém abrir a tela. Aqui o aviso chega mesmo com o app fechado.
 *
 * No iPhone isto só funciona com o app INSTALADO na tela de início — o Safari
 * não entrega push para site aberto na aba. É por isso que a tela de permissão
 * pede a instalação primeiro.
 */

self.addEventListener('push', (event) => {
  // Push sem corpo acontece (teste do navegador, payload perdido): melhor um
  // aviso genérico do que uma notificação vazia — em alguns sistemas, não
  // mostrar nada depois de receber um push revoga a permissão.
  let dados = { titulo: 'SAAB Sports', corpo: 'Você tem uma novidade no app.', url: '/atleta', tag: 'saab' }
  try {
    if (event.data) dados = { ...dados, ...event.data.json() }
  } catch { /* payload não-JSON: fica o genérico */ }

  event.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: '/icon-192.png',
      // Sem `badge`: o Android exige um PNG monocromático com transparência, e
      // usar o ícone colorido no lugar vira uma mancha branca na barra. Sem
      // ele, o sistema usa o ícone padrão do navegador, que fica melhor.
      tag: dados.tag,
      // Substitui em silêncio: o aluno não leva dois toques pelo mesmo assunto.
      renotify: false,
      data: { url: dados.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = (event.notification.data && event.notification.data.url) || '/atleta'

  event.waitUntil((async () => {
    const abas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Se o app já está aberto, foca a aba existente em vez de abrir outra —
    // abrir uma segunda cópia do portal confunde e perde o que estava na tela.
    for (const aba of abas) {
      if (new URL(aba.url).origin === self.location.origin) {
        await aba.focus()
        if ('navigate' in aba) await aba.navigate(destino).catch(() => {})
        return
      }
    }
    await self.clients.openWindow(destino)
  })())
})
