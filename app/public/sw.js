/*
  Service worker do Momentumm. Faz UMA coisa: receber o Web Push e mostrar a
  notificação. Não guarda cache, não intercepta rota, não faz o app funcionar
  offline. Assim o registro dele nunca segura uma versão velha da interface.
*/

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

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
