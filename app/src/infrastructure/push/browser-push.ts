import type { PushDevice, PushPermission } from '@/domain/notifications/push-device'
import { isIos, isStandalone } from '@/infrastructure/pwa/platform'

/**
 * A ponte com as APIs de notificação do navegador.
 *
 * Tudo que toca `Notification`, `PushManager` e service worker mora aqui,
 * pra tela só perguntar "dá?", "pode?" e "inscreve". O service worker é o
 * `public/sw.js`, que só sabe mostrar o aviso: sem cache, sem rota.
 */

const SERVICE_WORKER_URL = '/sw.js'

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    window.isSecureContext
  )
}

export function pushPermission(): PushPermission {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * iPhone com o site aberto no Safari: a API não existe até a pessoa adicionar
 * à tela de início. É o caso em que a tela precisa explicar, não pedir.
 *
 * A checagem é pela plataforma, não pela ausência da API: o iOS antigo ao
 * menos declara `PushManager` em alguns builds, e ali o caminho continua
 * sendo a tela de início.
 */
export function needsHomeScreenInstall(): boolean {
  return isIos() && !isStandalone()
}

export async function currentDevice(): Promise<PushDevice | null> {
  if (!pushSupported()) return null
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL)
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? toDevice(subscription) : null
}

/**
 * Pede permissão e inscreve o aparelho. Devolve null quando a pessoa negou:
 * negar não é erro, é resposta.
 */
export async function subscribeDevice(vapidPublicKey: string): Promise<PushDevice | null> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  // O worker já foi registrado no boot; registrar de novo é idempotente e
  // cobre o caso de o registro do boot ainda não ter terminado.
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL)
  await navigator.serviceWorker.ready

  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }))

  return toDevice(subscription)
}

/** Desfaz a inscrição no navegador. Devolve o endpoint que existia, pra apagar no servidor. */
export async function unsubscribeDevice(): Promise<string | null> {
  if (!pushSupported()) return null
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL)
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return null
  await subscription.unsubscribe()
  return subscription.endpoint
}

function toDevice(subscription: PushSubscription): PushDevice {
  const json = subscription.toJSON()
  const p256dh = json.keys?.['p256dh']
  const auth = json.keys?.['auth']
  if (!p256dh || !auth) throw new Error('Assinatura de push sem chaves.')

  return {
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    userAgent: navigator.userAgent.slice(0, 300),
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalized)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}
