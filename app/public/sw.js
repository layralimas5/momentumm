/*
  Service worker do Momentumm. Faz DUAS coisas: receber o Web Push e existir
  como service worker com handler de fetch. Sem isso o Chrome não considera o
  site instalável e só oferece atalho, que guarda a URL da aba (a landing).

  O que ele NÃO faz: cache. O fetch é passagem direta pra rede. Assim o
  registro nunca segura uma versão velha da interface.
*/

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/*
  Passagem direta: nenhuma resposta é guardada nem trocada. O handler existe
  pelo critério de instalabilidade, não pra servir conteúdo offline.
*/
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Seu Momentumm de hoje',
    body: 'Sua ação de hoje ainda cabe. Dez minutos já contam.',
    url: '/app',
    tag: 'momentumm-daily',
  }

  let payload = fallback
  try {
    payload = event.data ? { ...fallback, ...event.data.json() } : fallback
  } catch {
    payload = fallback
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/apple-touch-icon.png',
      badge: '/simbolo.png',
      data: { url: payload.url },
      // Um aviso por dia substitui o anterior em vez de empilhar.
      renotify: false,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url ?? '/app', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => client.url.startsWith(self.location.origin))
      if (open) {
        return open.focus().then((focused) => ('navigate' in focused ? focused.navigate(target) : focused))
      }
      return self.clients.openWindow(target)
    }),
  )
})
