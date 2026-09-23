import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isNotificationType } from '@/domain/notifications/notification-types'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'

/**
 * O app abriu por uma notificação?
 *
 * A Edge Function põe `?n=<tipo>` na URL do aviso. Este hook lê o parâmetro,
 * carimba a abertura no servidor, registra o evento e LIMPA a URL — deixar o
 * `?n=` no endereço faria a pessoa recarregar a página e contar a mesma
 * abertura de novo, além de um endereço feio se ela compartilhar.
 *
 * A conversão (abriu e depois avançou) é carimbada em outro lugar: quando uma
 * ação é concluída. As duas pontas juntas respondem a única pergunta que
 * importa sobre notificação — ela fez alguém avançar, ou só incomodou?
 */
export function useNotificationOpen(): void {
  const location = useLocation()
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return

    const params = new URLSearchParams(location.search)
    const raw = params.get('n')
    if (!raw || !isNotificationType(raw)) return

    handled.current = true

    void container.push.markOpened(raw).catch(() => undefined)
    track('notification_opened', 'notificacoes', { notification_type: raw })

    params.delete('n')
    const query = params.toString()
    navigate({ pathname: location.pathname, search: query ? `?${query}` : '' }, { replace: true })
  }, [location.search, location.pathname, navigate])
}
