import { useCallback, useEffect, useState } from 'react'
import type { FollowRequest } from '@/domain/entities/social-graph'
import { container } from '@/infrastructure/container'
import { toUserMessage } from '@/shared/errors'

export interface FollowRequestsView {
  readonly list: readonly FollowRequest[]
  readonly loading: boolean
  readonly error: string | null
  accept(userId: string): Promise<void>
  refuse(userId: string): Promise<void>
  reload(): void
}

/**
 * Os pedidos esperando a minha resposta.
 *
 * Só existe pra perfil fechado: perfil aberto aceita na hora, no servidor, e
 * nunca produz linha pendente.
 *
 * ## Aceitar e recusar saem da lista antes do servidor responder
 *
 * A linha some no toque. É a interação certa aqui porque o custo de errar é
 * baixo dos dois lados: se falhar, a lista volta com o motivo, e o pedido
 * continua lá. O contrário — ficar olhando um card com spinner — é o que faz
 * a pessoa tocar duas vezes e aceitar alguém que ela ia recusar.
 */
export function useFollowRequests(): FollowRequestsView {
  const [list, setList] = useState<readonly FollowRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)

    void container.social
      .followRequests()
      .then((result) => {
        if (alive) setList(result)
      })
      .catch((cause: unknown) => {
        if (alive) setError(toUserMessage(cause))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [tick])

  const answer = useCallback(
    async (userId: string, action: (id: string) => Promise<void>) => {
      const before = list
      setList((current) => current.filter((item) => item.id !== userId))
      setError(null)
      try {
        await action(userId)
      } catch (cause) {
        setList(before)
        setError(toUserMessage(cause))
      }
    },
    [list],
  )

  const accept = useCallback(
    (userId: string) => answer(userId, (id) => container.social.acceptFollower(id)),
    [answer],
  )

  const refuse = useCallback(
    (userId: string) => answer(userId, (id) => container.social.removeFollower(id)),
    [answer],
  )

  const reload = useCallback(() => setTick((value) => value + 1), [])

  return { list, loading, error, accept, refuse, reload }
}
