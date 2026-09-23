import { useCallback, useEffect, useState } from 'react'
import type { MySupportRequest } from '@/domain/admin/admin-schemas'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { toUserMessage } from '@/shared/errors'

/**
 * As solicitações de suporte desta pessoa.
 *
 * Lê pela RLS de dono: o servidor devolve só o que é dela, e o app não filtra
 * nada por conta própria. A equipe lê a mesma tabela pelo painel, por função,
 * e os dois caminhos nunca se cruzam.
 */
export function useMyRequests(): {
  readonly requests: readonly MySupportRequest[]
  readonly loading: boolean
  readonly error: string | null
  readonly reload: () => Promise<void>
} {
  const { user } = useAuth()
  const [requests, setRequests] = useState<readonly MySupportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user) {
      setRequests([])
      setLoading(false)
      return
    }
    try {
      setRequests(await container.support.listMyRequests())
      setError(null)
    } catch (cause) {
      setError(toUserMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  return { requests, loading, error, reload }
}

/**
 * As que têm resposta esperando.
 *
 * "Aguardando você" é o estado que a equipe deixa quando respondeu e precisa de
 * algo de volta; "resolvida" com texto de resolução é a resposta final. Os dois
 * significam a mesma coisa pra quem abriu: tem recado novo.
 */
export function withAnswer(
  requests: readonly MySupportRequest[],
): readonly MySupportRequest[] {
  return requests.filter(
    (request) =>
      request.status === 'aguardando_usuario' ||
      (request.status === 'resolvida' && request.resolution !== null),
  )
}
