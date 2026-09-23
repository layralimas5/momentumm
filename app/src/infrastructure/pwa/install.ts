/**
 * O app instalado na tela de início.
 *
 * Duas coisas moram aqui: saber se a janela atual é o app instalado (e não o
 * site no navegador) e garantir o registro do service worker no boot.
 *
 * O registro não é só sobre notificação: sem um service worker ativo o Chrome
 * não oferece "Instalar app", só "Adicionar à tela inicial", e o atalho que
 * sai daí guarda a URL da aba, que é o que fazia o app abrir na landing.
 */

const SERVICE_WORKER_URL = '/sw.js'

/** Janela aberta pelo ícone da tela de início, em qualquer plataforma. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const byDisplayMode = ['standalone', 'minimal-ui', 'fullscreen'].some(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
  )
  // iOS não expõe display-mode no Safari antigo: lá o sinal é navigator.standalone.
  const byIosFlag = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return byDisplayMode || byIosFlag
}

/**
 * Registra o service worker uma vez por carga. Falhar aqui não pode derrubar
 * o app: sem service worker o Momentumm continua funcionando, só perde o
 * aviso diário e o convite de instalação.
 */
export async function ensureServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (!window.isSecureContext) return

  try {
    await navigator.serviceWorker.register(SERVICE_WORKER_URL)
  } catch (error) {
    console.warn('Service worker não registrado:', error)
  }
}
