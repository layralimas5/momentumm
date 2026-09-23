import { useCallback, useEffect, useRef, useState } from 'react'
import {
  readPair,
  unreadFor,
  type EncouragementKind,
  type Pair,
  type PairReading,
} from '@/domain/entities/pair'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { toUserMessage } from '@/shared/errors'

/**
 * A dupla na tela.
 *
 * Uma chamada ao abrir e uma a cada ação — sem polling. Um app que pergunta ao
 * servidor de dez em dez segundos se a outra pessoa avançou gasta bateria e
 * dados de quem está no celular pra mudar um ícone que ninguém está olhando.
 * Quem volta pra aba recarrega; quem fica parado vê o estado de quando abriu,
 * e isso basta pra uma tela que muda no máximo duas vezes por dia.
 */

export interface PairController {
  readonly pair: Pair | null
  readonly reading: PairReading | null
  readonly loading: boolean
  readonly error: string | null
  /** Enviando um incentivo agora. */
  readonly sending: EncouragementKind | null
  send(kind: EncouragementKind): Promise<void>
  leave(): Promise<void>
  reload(): Promise<void>
}

export function usePair(): PairController {
  const { user } = useAuth()
  const [pair, setPair] = useState<Pair | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState<EncouragementKind | null>(null)
  const alive = useRef(true)
  const viewed = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    try {
      const next = await container.pairs.load()
      if (!alive.current) return
      setPair(next)
      setError(null)

      if (next && !viewed.current) {
        viewed.current = true
        track('pair_viewed', 'juntos', { count: next.daysTogether })
      }

      /*
        Marcar como lido acontece aqui, e não num botão.

        O incentivo foi visto porque a tela dele abriu. Um "marcar como lido"
        explícito transformaria um gesto de duas pessoas numa caixa de entrada.
      */
      if (next && user) {
        const naoLidos = unreadFor(next, user.id)
        if (naoLidos.length > 0) {
          void container.pairs.markRead(naoLidos.map((item) => item.id)).catch(() => undefined)
          for (const item of naoLidos) {
            track('encouragement_received', 'juntos', { kind: item.kind })
          }
        }
      }
    } catch (cause) {
      if (alive.current) setError(toUserMessage(cause))
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  const send = useCallback(
    async (kind: EncouragementKind) => {
      setSending(kind)
      try {
        await container.pairs.sendEncouragement(kind)
        track('encouragement_sent', 'juntos', { kind })
        await reload()
      } catch (cause) {
        if (alive.current) setError(toUserMessage(cause))
      } finally {
        if (alive.current) setSending(null)
      }
    },
    [reload],
  )

  const leave = useCallback(async () => {
    try {
      await container.pairs.leave()
      track('pair_left', 'juntos')
      if (alive.current) setPair(null)
    } catch (cause) {
      if (alive.current) setError(toUserMessage(cause))
    }
  }, [])

  return {
    pair,
    reading: pair ? readPair(pair) : null,
    loading,
    error,
    sending,
    send,
    leave,
    reload,
  }
}
