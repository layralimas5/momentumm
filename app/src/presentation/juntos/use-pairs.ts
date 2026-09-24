import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
 * As duplas na tela.
 *
 * Uma chamada ao abrir e uma a cada ação — sem polling. Um app que pergunta ao
 * servidor de dez em dez segundos se a outra pessoa avançou gasta bateria e
 * dados de quem está no celular pra mudar um ícone que ninguém está olhando.
 * Quem volta pra aba recarrega; quem fica parado vê o estado de quando abriu,
 * e isso basta pra uma tela que muda no máximo duas vezes por dia.
 *
 * Desde a 0053 são VÁRIAS duplas: o gratuito tem uma, o PRO tem quantas
 * quiser. O hook devolve uma lista e recebe o id da dupla em toda ação — sem
 * isso, mandar incentivo com três duplas abertas acertaria uma por sorteio.
 */

/** Uma dupla já lida: o retrato mais a frase que a tela usa. */
export interface PairView {
  readonly pair: Pair
  readonly reading: PairReading
}

export interface PairsController {
  readonly views: readonly PairView[]
  /** Quantas duplas o plano permite. `null` é sem teto. */
  readonly max: number | null
  /** Ainda cabe outra? Vem do servidor, não de conta na tela. */
  readonly room: boolean
  readonly loading: boolean
  readonly error: string | null
  /** A dupla e o gesto que estão sendo enviados agora. */
  readonly sending: { readonly pairId: string; readonly kind: EncouragementKind } | null
  send(pairId: string, kind: EncouragementKind): Promise<void>
  leave(pairId: string): Promise<void>
  reload(): Promise<void>
}

export function usePairs(): PairsController {
  const { user } = useAuth()
  const [pairs, setPairs] = useState<readonly Pair[]>([])
  const [max, setMax] = useState<number | null>(null)
  const [room, setRoom] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState<PairsController['sending']>(null)
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
      setPairs(next.pairs)
      setMax(next.max)
      setRoom(next.room)
      setError(null)

      if (next.pairs.length > 0 && !viewed.current) {
        viewed.current = true
        track('pair_viewed', 'juntos', {
          count: next.pairs.reduce((total, pair) => total + pair.daysTogether, 0),
        })
      }

      /*
        Marcar como lido acontece aqui, e não num botão.

        O incentivo foi visto porque a tela dele abriu. Um "marcar como lido"
        explícito transformaria um gesto de duas pessoas numa caixa de entrada.
        Com várias duplas é uma chamada só, com os ids de todas: uma por dupla
        seriam três requisições pra dizer a mesma coisa.
      */
      if (user) {
        const naoLidos = next.pairs.flatMap((pair) => unreadFor(pair, user.id))
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
    async (pairId: string, kind: EncouragementKind) => {
      setSending({ pairId, kind })
      try {
        await container.pairs.sendEncouragement(pairId, kind)
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

  const leave = useCallback(
    async (pairId: string) => {
      try {
        await container.pairs.leave(pairId)
        track('pair_left', 'juntos')
        /*
          Recarrega em vez de tirar da lista na mão: sair muda o `room`, e é
          ele que decide se o convite volta a ser oferecido.
        */
        await reload()
      } catch (cause) {
        if (alive.current) setError(toUserMessage(cause))
      }
    },
    [reload],
  )

  /*
    A leitura de cada dupla é derivada, e uma dupla sem leitura (membro
    faltando) sai da lista: a tela não tem o que dizer sobre ela.
  */
  const views = useMemo(
    () =>
      pairs.flatMap((pair) => {
        const reading = readPair(pair)
        return reading ? [{ pair, reading }] : []
      }),
    [pairs],
  )

  return { views, max, room, loading, error, sending, send, leave, reload }
}
