import { useCallback, useEffect, useState } from 'react'
import { EMPTY_FOLLOW_COUNTS, type FollowCounts } from '@/domain/entities/follow'
import { container } from '@/infrastructure/container'

/**
 * Quantos seguem e quantos são seguidos.
 *
 * Os dois números vêm numa chamada só (a função `follow_counts`, da 0060): a
 * linha do perfil mostra os dois juntos, e duas idas ao servidor pra encher
 * uma linha seriam duas esperas pra responder a mesma pergunta.
 *
 * Falha não vira erro na tela. Se a contagem não veio, o perfil mostra zero e
 * segue em frente, nada aqui muda uma decisão da pessoa, e um aviso vermelho
 * em cima do nome dela seria alarme por uma informação de vitrine.
 */
export function useFollowCounts(userId: string | null): {
  readonly counts: FollowCounts
  readonly loading: boolean
  reload(): void
} {
  const [counts, setCounts] = useState<FollowCounts>(EMPTY_FOLLOW_COUNTS)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!userId) {
      setCounts(EMPTY_FOLLOW_COUNTS)
      setLoading(false)
      return
    }

    let alive = true
    setLoading(true)

    void container.follows
      .counts(userId)
      .then((result) => {
        if (alive) setCounts(result)
      })
      .catch(() => {
        if (alive) setCounts(EMPTY_FOLLOW_COUNTS)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [userId, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])

  return { counts, loading, reload }
}
