import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { circleFeed, type CircleAuthor, type CircleFeedItem } from '@/domain/entities/circle-feed'
import {
  friendIdsOf,
  isIncoming,
  isOutgoing,
  otherSideOf,
  relationWith,
  type Friendship,
  type Relation,
} from '@/domain/entities/friendship'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { toUserMessage } from '@/shared/errors'

/**
 * O estado do Círculo.
 *
 * Fica na página em vez de virar um provider global porque nada fora do Círculo
 * depende dele: o dashboard, o plano e o perfil não mudam por causa de um
 * pedido de amizade. Provider aqui seria carregar o feed de amigos em toda
 * sessão pra a maioria das telas nunca usar.
 */

/** Uma pessoa do círculo com a relação já resolvida: é o que a tela desenha. */
export interface CirclePerson {
  readonly person: CircleAuthor
  readonly friendship: Friendship
  readonly relation: Relation
}

export interface CircleState {
  readonly loading: boolean
  readonly error: string | null
  readonly friends: readonly CirclePerson[]
  /** Pedidos esperando a resposta desta pessoa. */
  readonly incoming: readonly CirclePerson[]
  /** Pedidos que ela enviou e ainda não foram respondidos. */
  readonly outgoing: readonly CirclePerson[]
  readonly feed: readonly CircleFeedItem[]
  readonly acting: boolean

  relationOf(personId: string): Relation
  search(term: string): Promise<readonly CircleAuthor[]>
  request(personId: string): Promise<void>
  respond(friendshipId: string, accept: boolean): Promise<void>
  remove(friendshipId: string): Promise<void>
  support(eventId: string, supported: boolean): Promise<void>
  reload(): Promise<void>
}

export function useCircle(): CircleState {
  const { user } = useAuth()
  const [friendships, setFriendships] = useState<readonly Friendship[]>([])
  const [people, setPeople] = useState<ReadonlyMap<string, CircleAuthor>>(new Map())
  const [feed, setFeed] = useState<readonly CircleFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const list = await container.friendships.listByUser(user.id)

      // As pessoas de TODAS as linhas, não só das aceitas: um pedido recebido
      // sem nome nem foto é um pedido que ninguém consegue responder.
      const ids = list.map((friendship) => otherSideOf(friendship, user.id))
      const [profiles, items] = await Promise.all([
        container.friendships.listPeople(ids),
        container.journeyEvents.listCircleFeed(user.id),
      ])

      if (!mounted.current) return

      setFriendships(list)
      setPeople(new Map(profiles.map((person) => [person.id, person])))
      setFeed(circleFeed(items))
      setError(null)
    } catch (cause) {
      if (mounted.current) setError(toUserMessage(cause))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Envolve as ações: erro na tela, e recarga só depois que a escrita passou. */
  const act = useCallback(
    async (action: () => Promise<void>) => {
      setActing(true)
      setError(null)
      try {
        await action()
        await reload()
      } catch (cause) {
        if (mounted.current) setError(toUserMessage(cause))
      } finally {
        if (mounted.current) setActing(false)
      }
    },
    [reload],
  )

  const decorate = useCallback(
    (list: readonly Friendship[]): CirclePerson[] =>
      list.flatMap((friendship) => {
        if (!user) return []
        const person = people.get(otherSideOf(friendship, user.id))
        if (!person) return []
        return [{ person, friendship, relation: relationWith(list, user.id, person.id) }]
      }),
    [people, user],
  )

  const friends = useMemo(() => {
    if (!user) return []
    const ids = new Set(friendIdsOf(friendships, user.id))
    return decorate(
      friendships.filter((friendship) => ids.has(otherSideOf(friendship, user.id))),
    ).sort((a, b) => a.person.name.localeCompare(b.person.name, 'pt-BR'))
  }, [friendships, user, decorate])

  const incoming = useMemo(
    () => (user ? decorate(friendships.filter((item) => isIncoming(item, user.id))) : []),
    [friendships, user, decorate],
  )

  const outgoing = useMemo(
    () => (user ? decorate(friendships.filter((item) => isOutgoing(item, user.id))) : []),
    [friendships, user, decorate],
  )

  const relationOf = useCallback(
    (personId: string): Relation =>
      user ? relationWith(friendships, user.id, personId) : 'nenhuma',
    [friendships, user],
  )

  const search = useCallback(
    async (term: string) => {
      if (!user) return []
      return container.friendships.search(user.id, term)
    },
    [user],
  )

  const request = useCallback(
    async (personId: string) => {
      if (!user) return
      await act(async () => {
        await container.friendships.request({ requesterId: user.id, addresseeId: personId })
      })
    },
    [user, act],
  )

  const respond = useCallback(
    async (friendshipId: string, accept: boolean) => {
      if (!user) return
      await act(async () => {
        await container.friendships.respond(friendshipId, user.id, accept)
      })
    },
    [user, act],
  )

  const remove = useCallback(
    async (friendshipId: string) => {
      if (!user) return
      await act(async () => {
        await container.friendships.remove(friendshipId, user.id)
      })
    },
    [user, act],
  )

  /**
   * Apoio com resposta imediata.
   *
   * O toque marca o coração antes de o servidor confirmar, e volta atrás se
   * ele recusar. Recarregar o feed inteiro pra um clique faria a lista piscar
   * e a pessoa perder o lugar onde estava lendo.
   */
  const support = useCallback(
    async (eventId: string, supported: boolean) => {
      if (!user) return

      const previous = feed
      setFeed((current) =>
        current.map((item) =>
          item.event.id === eventId
            ? {
                ...item,
                supportedByMe: supported,
                supports: Math.max(0, item.supports + (supported ? 1 : -1)),
              }
            : item,
        ),
      )

      try {
        await container.journeyEvents.support(eventId, user.id, supported)
      } catch (cause) {
        if (!mounted.current) return
        setFeed(previous)
        setError(toUserMessage(cause))
      }
    },
    [user, feed],
  )

  return {
    loading,
    error,
    friends,
    incoming,
    outgoing,
    feed,
    acting,
    relationOf,
    search,
    request,
    respond,
    remove,
    support,
    reload,
  }
}
