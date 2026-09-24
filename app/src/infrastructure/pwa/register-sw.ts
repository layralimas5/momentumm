import { isStandalone } from './platform'

/**
 * Registra o service worker no boot.
 *
 * Antes ele só era registrado quando a pessoa ligava o lembrete, e isso tinha
 * um custo escondido: o Chrome só oferece "Instalar app" pra quem já tem um
 * worker ativo que responde offline. Sem registro no boot, a instalação no
 * Android virava um atalho de navegador — que não recebe push.
 *
 * O `sw.js` não guarda a interface em cache (só a página offline), então
 * registrar cedo não arrisca servir uma versão velha do app.
 */

const SERVICE_WORKER_URL = '/sw.js'

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (!window.isSecureContext) return

  const registrar = () => {
    void navigator.serviceWorker.register(SERVICE_WORKER_URL).then(
      (registration) => {
        /*
          Um app aberto da tela de início pode ficar dias sem recarregar. Pedir
          a atualização na abertura evita que ele fique preso num worker antigo
          por causa da janela de 24h que o navegador usa por conta própria.
        */
        if (isStandalone()) void registration.update().catch(() => undefined)
      },
      () => undefined,
    )
  }

  if (document.readyState === 'complete') registrar()
  else window.addEventListener('load', registrar, { once: true })
}
