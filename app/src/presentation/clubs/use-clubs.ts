import { useCallback, useEffect, useState } from 'react'
import { isPro } from '@/domain/entities/plan'
import type { Club, NewClubInput } from '@/domain/entities/club'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { toUserMessage } from '@/shared/errors'

export interface ClubsState {
  readonly loading: boolean
  readonly error: string | null
  readonly acting: boolean
  /** Os clubes de que a pessoa participa, do mais recente pro mais antigo. */
  readonly mine: readonly Club[]
  /** Clubes abertos que ela ainda não integra. É a descoberta. */
  readonly discover: readonly Club[]
  /** Pode criar clube? É a assinatura que responde. */
  readonly canCreate: boolean

  create(input: NewClubInput): Promise<Club | null>
  join(clubId: string): Promise<void>
  leave(clubId: string): Promise<void>
  reload(): Promise<void>
}

/**
 * A lista de clubes: os meus e os que dá pra descobrir.
 *
 * As duas consultas são separadas de propósito. "Meus clubes" é uma leitura de
 * participação; "descobrir" é uma leitura pública de clubes abertos. Juntar as
 * duas numa só faria a descoberta depender do que a pessoa já integra, e é
 * justamente quem não integra nada que mais precisa dela.
 *
 * Quem já é membro sai da descoberta aqui, e não no servidor: a política do
 * banco decide quem PODE ver, não o que é útil mostrar.
 */
export function useClubs(): ClubsState {
  const { user, profile } = useAuth()
  const [mine, setMine] = useState<readonly Club[]>([])
  const [discover, setDiscover] = useState<readonly Club[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    try {
      const [meus, abertos] = await Promise.all([
        container.clubs.listMine(user.id),
        container.clubs.listOpen(),
      ])
      const dentro = new Set(meus.map((club) => club.id))
      setMine(meus)
      setDiscover(abertos.filter((club) => !dentro.has(club.id)))
    } catch (cause) {
      setError(toUserMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const act = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      setActing(true)
      setError(null)
      try {
        const result = await action()
        await load()
        return result
      } catch (cause) {
        setError(toUserMessage(cause))
        return null
      } finally {
        setActing(false)
      }
    },
    [load],
  )

  const create = useCallback(
    async (input: NewClubInput) => {
      const club = await act(() => container.clubs.create(input))
      if (club) track('club_created', 'desafios', { kind: input.privacy })
      return club
    },
    [act],
  )

  const join = useCallback(
    async (clubId: string) => {
      if (!user) return
      await act(async () => {
        await container.clubs.join(clubId, user.id)
        track('club_joined', 'desafios')
      })
    },
    [act, user],
  )

  const leave = useCallback(
    async (clubId: string) => {
      if (!user) return
      await act(async () => {
        await container.clubs.leave(clubId, user.id)
        track('club_left', 'desafios')
      })
    },
    [act, user],
  )

  return {
    loading,
    error,
    acting,
    mine,
    discover,
    // A tela pergunta pra decidir entre o formulário e o convite ao PRO. Quem
    // garante é o servidor: `create_club` recusa qualquer conta sem assinatura.
    canCreate: profile ? isPro(profile.plan) : false,
    create,
    join,
    leave,
    reload: load,
  }
}
