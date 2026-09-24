import { useCallback, useEffect, useState } from 'react'
import type { PushPermission } from '@/domain/notifications/push-device'
import { track } from '@/infrastructure/analytics/track'
import { vapidPublicKey } from '@/infrastructure/config/env'
import { container } from '@/infrastructure/container'
import {
  currentDevice,
  needsHomeScreenInstall,
  pushPermission,
  subscribeDevice,
  unsubscribeDevice,
} from '@/infrastructure/push/browser-push'
import { useAuth } from '@/presentation/auth/use-auth'
import { toUserMessage } from '@/shared/errors'

/**
 * O lembrete diário como estado: dá neste aparelho? a pessoa já ligou? o
 * que falta pra ligar?
 *
 * `available` é a pergunta que decide se a tela oferece alguma coisa. Sem
 * chave VAPID configurada não existe lembrete em nenhum ambiente, e sem
 * API no navegador (ou no iPhone fora da tela de início) o que existe é a
 * explicação, não o botão.
 */

const DISMISSED_KEY = 'momentumm.reminder.dismissed.v1'

export interface PushRemindersController {
  /** Existe lembrete neste ambiente (chave configurada + navegador capaz). */
  readonly available: boolean
  /** iPhone no Safari: precisa adicionar à tela de início antes. */
  readonly needsInstall: boolean
  readonly permission: PushPermission
  /** Este aparelho está inscrito pra esta conta. */
  readonly enabled: boolean
  /** Ainda lendo o estado do aparelho: não desenhar nada definitivo. */
  readonly loading: boolean
  readonly busy: boolean
  readonly error: string | null
  /** A pessoa fechou o convite do Hoje. A tela de Configurações continua oferecendo. */
  readonly dismissed: boolean
  enable(): Promise<void>
  disable(): Promise<void>
  dismiss(): void
}

export function usePushReminders(): PushRemindersController {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [permission, setPermission] = useState<PushPermission>(() => pushPermission())
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(() => readDismissed(userId))

  const available = vapidPublicKey !== null && permission !== 'unsupported'

  // O aparelho pode estar inscrito no navegador e a conta não saber (trocou
  // de conta no mesmo celular): "ligado" é os dois concordando.
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const device = available ? await currentDevice() : null
        const known = device ? await container.push.has(device.endpoint) : false
        if (!cancelled) setEnabled(known)
      } catch {
        if (!cancelled) setEnabled(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [available, userId])

  /*
    O pedido de permissão acontece AQUI e em nenhum outro lugar: dentro de um
    toque da pessoa, depois de ela ler o que vai receber. O navegador só deixa
    perguntar uma vez por site, e um pedido sem contexto é um pedido negado
    pra sempre — no iPhone, inclusive, sem caminho de volta dentro do app.
  */
  const enable = useCallback(async () => {
    if (!vapidPublicKey) return
    setBusy(true)
    setError(null)
    track('notification_permission_prompted', 'notificacoes')
    try {
      const device = await subscribeDevice(vapidPublicKey)
      const depois = pushPermission()
      setPermission(depois)

      if (!device) {
        // Negar não é erro: é resposta. A tela para de oferecer e segue.
        track('notification_permission_denied', 'notificacoes')
        return
      }

      track('notification_permission_granted', 'notificacoes')
      await container.push.save(device)
      setEnabled(true)
      track('push_subscription_created', 'notificacoes')
      track('reminder_enabled')
    } catch (cause) {
      setError(toUserMessage(cause))
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const endpoint = await unsubscribeDevice()
      if (endpoint) await container.push.remove(endpoint)
      setEnabled(false)
      track('reminder_disabled')
    } catch (cause) {
      setError(toUserMessage(cause))
    } finally {
      setBusy(false)
    }
  }, [])

  const dismiss = useCallback(() => {
    setDismissed(true)
    writeDismissed(userId)
  }, [userId])

  return {
    available,
    needsInstall: needsHomeScreenInstall(),
    permission,
    enabled,
    loading,
    busy,
    error,
    dismissed,
    enable,
    disable,
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
