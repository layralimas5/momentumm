import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  challengeEventsToRecord,
  type ChallengeRecorderEntry,
} from '@/domain/entities/challenge-recorder'
import {
  countedDays,
  doneDaysOf,
  everyoneFinished,
  groupRatio as groupRatioOf,
  isChallengeRunning,
  isOnBoard,
  isParticipating,
  participantOf,
  progressOf,
  rankParticipants,
  requiredDays,
  type Challenge,
  type ChallengeParticipant,
  type ChallengeProgress,
  type NewChallengeInput,
  type RankedParticipant,
} from '@/domain/entities/challenge'
import type { CircleAuthor } from '@/domain/entities/circle-feed'
import type { DayKey } from '@/domain/entities/day'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { usePlanner } from '@/presentation/planner/use-planner'
import { toUserMessage } from '@/shared/errors'

/**
 * O estado dos desafios.
 *
 * Vive na página, como o Círculo, e pelo mesmo motivo: nada fora dela depende
 * disso. O dashboard, o plano e o review não mudam porque alguém convidou você
 * pra um desafio, e um provider global carregaria participações em toda sessão
 * pra a maioria das telas nunca usar.
 *
 * ## O progresso é calculado aqui e publicado daqui
 *
 * Os dias que VOCÊ fechou saem dos seus hábitos e das suas atividades, que só
 * este aparelho consegue ler — nem o servidor nem os outros participantes têm
 * acesso a eles. O hook recalcula, compara com o número publicado e só escreve
 * quando eles divergem. Os dias dos OUTROS chegam publicados: `doneDays`, e
 * nada além.
 */

export interface ChallengeView {
  readonly challenge: Challenge
  /** A minha participação. Null quando o desafio é meu e eu saí (não acontece). */
  readonly me: ChallengeParticipant | null
  /** Quem está dentro ou foi convidado. Quem recusou e quem saiu não aparecem. */
  readonly participants: readonly ChallengeParticipant[]
  /** Quantas pessoas estão participando de fato. */
  readonly people: number
  readonly progress: ChallengeProgress | null
  readonly ranking: readonly RankedParticipant[]
  /** 0 a 1: a média de quem está dentro. */
  readonly groupRatio: number
  readonly isOwner: boolean
  /** O nome do hábito que move o MEU progresso. Null quando é o eixo. */
  readonly habitName: string | null
  readonly running: boolean
}

export interface ChallengesState {
  readonly loading: boolean
  readonly error: string | null
  readonly acting: boolean
  /** Em andamento, do mais recente pro mais antigo. */
  readonly active: readonly ChallengeView[]
  /** Convites esperando a minha resposta. */
  readonly invites: readonly ChallengeView[]
  /** Encerrados: prazo vencido, fechado pelo dono ou cumprido. */
  readonly finished: readonly ChallengeView[]

  personOf(userId: string): CircleAuthor | null
  viewOf(challengeId: string): ChallengeView | null

  create(input: Omit<NewChallengeInput, 'ownerId'>): Promise<Challenge | null>
  invite(challengeId: string, userId: string): Promise<void>
  respond(participantId: string, accept: boolean): Promise<void>
  leave(participantId: string): Promise<void>
  setHabit(participantId: string, habitId: string | null): Promise<void>
  /** Encerrar o desafio. Só o dono, e fecha pra todo mundo. */
  finish(challengeId: string): Promise<void>
  reload(): Promise<void>
}

export function useChallenges(): ChallengesState {
  const { user } = useAuth()
  const planner = usePlanner()
  // Desestruturado de propósito: o efeito que grava momentos depende do que
  // ele realmente lê, e não do objeto inteiro do planner — que muda a cada
  // hábito marcado e faria o gravador rodar por qualquer motivo.
  const { today, journeyEvents, recordJourneyEvent } = planner
  const [challenges, setChallenges] = useState<readonly Challenge[]>([])
  const [participants, setParticipants] = useState<readonly ChallengeParticipant[]>([])
  const [people, setPeople] = useState<ReadonlyMap<string, CircleAuthor>>(new Map())
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
      const list = await container.challenges.listByUser(user.id)
      const rows = await container.challenges.listParticipants(list.map((item) => item.id))

      // Nome e foto de TODO mundo que aparece, não só de quem já aceitou: um
      // convite sem nome é um convite que ninguém consegue responder.
      const ids = [...new Set(rows.map((row) => row.userId))].filter((id) => id !== user.id)
      const profiles = ids.length > 0 ? await container.friendships.listPeople(ids) : []

      if (!mounted.current) return

      setChallenges(list)
      setParticipants(rows)
      setPeople(new Map(profiles.map((person) => [person.id, person])))
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

  // -------------------------------------------------------------------------
  // as visões
  // -------------------------------------------------------------------------

  const views = useMemo<ChallengeView[]>(() => {
    if (!user) return []

    return challenges.map((challenge) => {
      const all = participants.filter((item) => item.challengeId === challenge.id)
      const onBoard = all.filter(isOnBoard)
      const me = participantOf(all, user.id)
      const habit = me?.habitId
        ? (planner.habits.find((item) => item.id === me.habitId) ?? null)
        : null

      return {
        challenge,
        me,
        participants: onBoard,
        people: all.filter(isParticipating).length,
        progress: me ? progressOf(challenge, me, planner.today) : null,
        ranking: rankParticipants(challenge, all, planner.today),
        groupRatio: groupRatioOf(challenge, all, planner.today),
        isOwner: challenge.ownerId === user.id,
        habitName: habit?.name ?? null,
        running: isChallengeRunning(challenge, planner.today),
      }
    })
  }, [challenges, participants, user, planner.habits, planner.today])

  const invites = useMemo(
    () => views.filter((view) => view.me?.status === 'convidado'),
    [views],
  )

  const active = useMemo(
    () => views.filter((view) => view.me?.status === 'ativo' && view.running),
    [views],
  )

  const finished = useMemo(
    () => views.filter((view) => view.me?.status === 'ativo' && !view.running),
    [views],
  )

  // -------------------------------------------------------------------------
  // o meu progresso: calcular, publicar, registrar
  // -------------------------------------------------------------------------

  /**
   * O que já foi publicado nesta sessão.
   *
   * Sem isso, publicar dispararia um `reload`, que refaria a conta, que
   * publicaria de novo. A chave guarda desafio e valor: o número só volta ao
   * servidor quando ele muda de verdade.
   */
  const published = useRef(new Map<string, number>())

  const myProgress = useMemo(() => {
    if (!user) return []

    return views.flatMap((view) => {
      if (!view.me || !isParticipating(view.me)) return []

      const days = doneDaysOf(view.challenge, view.me, {
        activities: planner.activities,
        habitLogs: planner.habitLogs,
      })

      return [
        {
          view,
          me: view.me,
          done: countedDays(view.challenge, days),
          closedToday: days.includes(planner.today),
        },
      ]
    })
  }, [views, user, planner.activities, planner.habitLogs, planner.today])

  useEffect(() => {
    if (!user || loading) return

    const stale = myProgress.filter(
      (item) =>
        item.done !== item.me.doneDays && published.current.get(item.me.id) !== item.done,
    )
    if (stale.length === 0) return

    let cancelled = false

    void (async () => {
      for (const item of stale) {
        published.current.set(item.me.id, item.done)
        try {
          await container.challenges.publishProgress(
            item.me.id,
            user.id,
            item.done,
            item.done >= requiredDays(item.view.challenge),
          )
        } catch {
          // Silêncio de propósito, e a chave sai do mapa pra tentar de novo na
          // próxima carga: falhar em publicar não pode virar um erro em cima
          // de uma tela que a pessoa abriu pra ver o progresso dela.
          published.current.delete(item.me.id)
        }
      }

      if (!cancelled && mounted.current) await reload()
    })()

    return () => {
      cancelled = true
    }
  }, [myProgress, user, loading, reload])

  /**
   * Os momentos que os desafios geraram.
   *
   * Sem momentum de propósito. O card do desafio fala dos dias que duas pessoas
   * combinaram cumprir, e pendurar o score pessoal nele — ainda mais ao lado de
   * uma lista de participantes — monta exatamente a comparação entre pessoas
   * que o produto recusa em todo o resto.
   */
  useEffect(() => {
    if (!user || loading) return

    const entries: ChallengeRecorderEntry[] = myProgress.map((item) => ({
      challenge: item.view.challenge,
      // O participante com o número JÁ recalculado: gravar a partir do que o
      // servidor devolveu atrasaria todo evento em uma carga.
      participant: { ...item.me, doneDays: item.done },
      closedToday: item.closedToday,
      people: item.view.people,
    }))

    const pending = challengeEventsToRecord({
      today,
      momentum: null,
      entries,
      existing: journeyEvents,
    })

    for (const event of pending) void recordJourneyEvent(event)
  }, [myProgress, user, loading, today, journeyEvents, recordJourneyEvent])

  // -------------------------------------------------------------------------
  // ações
  // -------------------------------------------------------------------------

  const create = useCallback(
    async (input: Omit<NewChallengeInput, 'ownerId'>): Promise<Challenge | null> => {
      if (!user) return null

      setActing(true)
      setError(null)
      try {
        const { challenge } = await container.challenges.create({ ...input, ownerId: user.id })
        await reload()
        return challenge
      } catch (cause) {
        if (mounted.current) setError(toUserMessage(cause))
        return null
      } finally {
        if (mounted.current) setActing(false)
      }
    },
    [user, reload],
  )

  const invite = useCallback(
    async (challengeId: string, userId: string) => {
      if (!user) return
      await act(async () => {
        await container.challenges.invite(challengeId, user.id, userId)
      })
    },
    [user, act],
  )

  const respond = useCallback(
    async (participantId: string, accept: boolean) => {
      if (!user) return
      await act(async () => {
        await container.challenges.respond(participantId, user.id, accept)
      })
    },
    [user, act],
  )

  const leave = useCallback(
    async (participantId: string) => {
      if (!user) return
      await act(async () => {
        await container.challenges.leave(participantId, user.id)
      })
    },
    [user, act],
  )

  const setHabit = useCallback(
    async (participantId: string, habitId: string | null) => {
      if (!user) return
      await act(async () => {
        await container.challenges.setHabit(participantId, user.id, habitId)
        // O vínculo muda de onde vem o progresso: o número publicado precisa
        // ser recalculado do zero, e o cache da sessão não vale mais.
        published.current.delete(participantId)
      })
    },
    [user, act],
  )

  const finish = useCallback(
    async (challengeId: string) => {
      if (!user) return
      await act(async () => {
        await container.challenges.update(challengeId, user.id, { completedAt: new Date() })
      })
    },
    [user, act],
  )

  const personOf = useCallback(
    (userId: string): CircleAuthor | null => people.get(userId) ?? null,
    [people],
  )

  const viewOf = useCallback(
    (challengeId: string): ChallengeView | null =>
      views.find((view) => view.challenge.id === challengeId) ?? null,
    [views],
  )

  return {
    loading,
    error,
    acting,
    active,
    invites,
    finished,
    personOf,
    viewOf,
    create,
    invite,
    respond,
    leave,
    setHabit,
    finish,
    reload,
  }
}

/** O grupo inteiro cumpriu? É o que muda o tom do rodapé do desafio. */
export function groupFinished(view: ChallengeView, today: DayKey): boolean {
  return everyoneFinished(view.challenge, view.participants, today)
}
