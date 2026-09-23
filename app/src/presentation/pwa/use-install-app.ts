import { useEffect, useState } from 'react'
import { isStandalone } from '@/infrastructure/pwa/install'

/**
 * O evento que o Chrome dispara quando o site atende aos critérios de
 * instalação. Não está no lib.dom, então o tipo mora aqui.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState =
  /** Já é o app instalado: não há o que oferecer. */
  | { kind: 'installed' }
  /** Chrome/Edge/Android: dá pra instalar com um toque. */
  | { kind: 'promptable'; install: () => Promise<void> }
  /** iPhone e iPad: só pelo menu Compartilhar do Safari. */
  | { kind: 'manual-ios' }
  /** Navegador que não instala (ou critérios ainda não atendidos). */
  | { kind: 'unavailable' }

function isIos(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
}

/**
 * Diz se este aparelho pode instalar o Momentumm e como.
 *
 * O evento de instalação do Chrome chega uma vez e some: quem não guardar
 * perde a chance de oferecer o botão. Por isso o hook escuta desde a montagem
 * e segura o evento até a pessoa decidir.
 */
export function useInstallApp(): InstallState {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Sem o preventDefault o Chrome mostra a barra dele por cima da interface.
      event.preventDefault()
      setPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return { kind: 'installed' }

  if (prompt) {
    return {
      kind: 'promptable',
      install: async () => {
        await prompt.prompt()
        const choice = await prompt.userChoice
        // Recusado ou aceito, o evento não serve duas vezes.
        setPrompt(null)
        if (choice.outcome === 'accepted') setInstalled(true)
      },
    }
  }

  return isIos() ? { kind: 'manual-ios' } : { kind: 'unavailable' }
}
