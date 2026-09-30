import { useCallback, useEffect, useState } from 'react'
import type { ClubInvitation } from '@/domain/entities/club-invite'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { toUserMessage } from '@/shared/errors'

export interface ClubInvitesState {
  readonly invites: readonly ClubInvitation[]
  readonly loading: boolean
  readonly error: string | null
  readonly answering: string | null
  /** Aceitar entra no clube; recusar só responde. Os dois encerram o aviso. */
  respond(invitationId: string, accept: boolean): Promise<void>
  reload(): Promise<void>
}

/**
 * Os convites de clube esperando resposta desta pessoa.
 *
 * Fica num hook próprio, e não dentro do `useClubs`, porque quem pergunta são
 * duas telas diferentes: a lista de clubes, que mostra o convite pra responder,
 * e o sino, que precisa do número sem carregar a página de clubes inteira.
 *
 * O servidor devolve nome do clube e de quem chamou junto (`my_club_invitations`).
 * Sem isso o aviso seria "alguém te chamou pra um clube", que é um aviso que
 * ninguém consegue responder: clube por convite não é legível por quem ainda
 * não entrou, e perfil fechado também não.
 */
export function useClubInvites(): ClubInvitesState {
  const { user } = useAuth()
  const [invites, setInvites] = useState<readonly ClubInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [answering, setAnswering] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user) {
      setInvites([])
      setLoading(false)
      return
    }

    try {
      setInvites(await container.clubs.listMyInvitations())
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

  const respond = useCallback(
    async (invitationId: string, accept: boolean) => {
      setAnswering(invitationId)
      setError(null)
      try {
        await container.clubs.respondInvitation(invitationId, accept)
        track(accept ? 'club_invite_accepted' : 'club_invite_declined', 'desafios')
        if (accept) track('club_joined', 'desafios', { result: 'convidado' })
        await reload()
      } catch (cause) {
        setError(toUserMessage(cause))
      } finally {
        setAnswering(null)
      }
    },
    [reload],
  )

  return { invites, loading, error, answering, respond, reload }
}
