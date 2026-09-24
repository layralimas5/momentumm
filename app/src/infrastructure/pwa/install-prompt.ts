/**
 * O convite de instalação do Android, guardado pra usar na hora certa.
 *
 * O Chrome dispara `beforeinstallprompt` UMA vez, cedo, e só entrega o prompt
 * de verdade dentro de um gesto da pessoa. Se ninguém guardar o evento, ele se
 * perde e o app fica sem botão próprio de instalar. Então o módulo escuta no
 * boot, segura o evento e avisa quem estiver interessado.
 *
 * `preventDefault` tira a barra automática do navegador de cena: o convite
 * passa a ser nosso, no momento em que faz sentido, com a nossa copy.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

let pendente: BeforeInstallPromptEvent | null = null
const ouvintes = new Set<() => void>()

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte()
}

/** Liga a escuta. Chamado uma vez, no boot do app. */
export function watchInstallPrompt(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    pendente = event as BeforeInstallPromptEvent
    avisar()
  })

  // Instalou (pelo nosso botão ou pelo menu do navegador): o convite morre.
  window.addEventListener('appinstalled', () => {
    pendente = null
    avisar()
  })
}

export function canPromptInstall(): boolean {
  return pendente !== null
}

/** Reage a "apareceu" e a "acabou de instalar". Devolve o cancelamento. */
export function onInstallPromptChange(listener: () => void): () => void {
  ouvintes.add(listener)
  return () => {
    ouvintes.delete(listener)
  }
}

/**
 * Abre o prompt nativo. Só funciona dentro de um gesto da pessoa, e só uma
 * vez por evento: aceito ou recusado, o Chrome descarta o convite.
 */
export async function promptInstall(): Promise<InstallOutcome> {
  const evento = pendente
  if (!evento) return 'unavailable'

  pendente = null
  avisar()

  await evento.prompt()
  const { outcome } = await evento.userChoice
  return outcome
}
