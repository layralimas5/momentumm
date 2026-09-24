import { useCallback, useEffect, useState } from 'react'
import { track } from '@/infrastructure/analytics/track'
import {
  canPromptInstall,
  onInstallPromptChange,
  promptInstall,
} from '@/infrastructure/pwa/install-prompt'
import { isIos, isStandalone } from '@/infrastructure/pwa/platform'
import { useAuth } from '@/presentation/auth/use-auth'

/**
 * Instalar o Momentumm, como estado de tela.
 *
 * Três caminhos, e o hook diz qual é o desta pessoa agora:
 *
 *   `installed`  já está rodando da tela de início. Não se oferece nada.
 *   `prompt`     Android/Chrome com convite guardado: um botão resolve.
 *   `ios`        iPhone no Safari: não existe prompt, existe instrução.
 *   `none`       navegador que não instala (desktop sem suporte, in-app
 *                browser). Melhor não prometer o que não vai acontecer.
 *
 * Fechar o convite vale por conta e por aparelho, e vale pra sempre: quem
 * disse "agora não" já sabe que dá pra instalar, e repetir o pedido é o que
 * transforma um convite em incômodo. Configurações continua oferecendo.
 */

const DISMISSED_KEY = 'momentumm.install.dismissed.v1'

export type InstallPath = 'installed' | 'prompt' | 'ios' | 'none'

export interface InstallController {
  readonly path: InstallPath
  /** Vale a pena mostrar o convite nesta tela? */
  readonly shouldOffer: boolean
  readonly dismissed: boolean
  readonly busy: boolean
  /** Abre o prompt do Android. No iOS quem abre a instrução é a tela. */
  install(): Promise<void>
  dismiss(): void
}

export function useInstallApp(): InstallController {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [standalone, setStandalone] = useState(() => isStandalone())
  const [temPrompt, setTemPrompt] = useState(() => canPromptInstall())
  const [dismissed, setDismissed] = useState(() => readDismissed(userId))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDismissed(readDismissed(userId))
  }, [userId])

  useEffect(() => onInstallPromptChange(() => setTemPrompt(canPromptInstall())), [])

  /*
    Instalar não recarrega a página: no Android a pessoa continua na mesma
    aba e o app abre por cima. Sem escutar a mudança, o convite continuaria
    na tela de quem acabou de instalar.
  */
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(display-mode: standalone)')
    const sincronizar = () => setStandalone(isStandalone())
    media.addEventListener('change', sincronizar)
    window.addEventListener('appinstalled', sincronizar)
    return () => {
      media.removeEventListener('change', sincronizar)
      window.removeEventListener('appinstalled', sincronizar)
    }
  }, [])

  const path: InstallPath = standalone
    ? 'installed'
    : temPrompt
      ? 'prompt'
      : isIos()
        ? 'ios'
        : 'none'

  const install = useCallback(async () => {
    setBusy(true)
    try {
      track('pwa_install_prompted', null, { source: 'app' })
      const outcome = await promptInstall()
      if (outcome === 'accepted') track('pwa_installed', null, { source: 'prompt' })
    } finally {
      setBusy(false)
    }
  }, [])

  const dismiss = useCallback(() => {
    setDismissed(true)
    writeDismissed(userId)
  }, [userId])

  return {
    path,
    shouldOffer: (path === 'prompt' || path === 'ios') && !dismissed,
    dismissed,
    busy,
    install,
    dismiss,
  }
}

function dismissedKey(userId: string | null): string {
  return userId ? `${DISMISSED_KEY}:${userId}` : DISMISSED_KEY
}

function readDismissed(userId: string | null): boolean {
  try {
    return window.localStorage.getItem(dismissedKey(userId)) === 'true'
  } catch {
    return false
  }
}

function writeDismissed(userId: string | null): void {
  try {
    window.localStorage.setItem(dismissedKey(userId), 'true')
  } catch {
    // Sem armazenamento o convite volta na próxima sessão. Aceitável.
  }
}
