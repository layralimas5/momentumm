/*
  Service worker do Momentumm.

  Faz DUAS coisas, e as duas de propósito:

    1. recebe o Web Push e mostra a notificação;
    2. responde a navegação quando o aparelho está sem rede, com uma página
       estática própria.

  O que ele NÃO faz: guardar a interface em cache. Todo HTML, script e imagem
  vai direto pra rede — assim o registro dele nunca segura uma versão velha do
  app depois de um deploy. O único arquivo guardado é o `offline.html`, que não
  muda e não é parte da interface.

  O (2) não é enfeite: o Chrome só oferece "Instalar app" pra quem tem um
  service worker que responde com o aparelho offline. Sem isso a pessoa recebe
  um atalho de navegador no lugar de um app instalado, e no Android o atalho
  não recebe push.
*/

const OFFLINE_CACHE = 'momentumm-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

/*
  Só navegação, e sempre pela rede primeiro.

  `request.mode === 'navigate'` é a pessoa abrindo uma página; o resto (js, css,
  imagem, chamada ao Supabase) o worker nem toca — sem `respondWith` o navegador
  segue o caminho normal, que é o que queremos.
*/
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(OFFLINE_CACHE)
      const offline = await cache.match(OFFLINE_URL)
      return (
        offline ??
        new Response('Sem conexão.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      )
    }),
  )
})

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Seu Momentumm de hoje',
    body: 'Seu próximo passo continua aqui. Que tal fazer só o que cabe hoje?',
    url: '/app',
    tag: 'momentumm-retorno',
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
      lang: 'pt-BR',
      data: { url: payload.url },
      // Um aviso por vez substitui o anterior em vez de empilhar.
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
