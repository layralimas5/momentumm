import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import { DAY_PART_LABELS, type DayPart } from '@/domain/entities/habit'
import {
  createJourneyEvent,
  type JourneyEvent,
  type JourneyItem,
  type NewJourneyEventInput,
} from '@/domain/entities/journey-event'
import type { MomentumScore } from '@/domain/entities/momentum'

/**
 * Os adapters: estado do planner → evento da jornada.
 *
 * Existem porque nem todo momento compartilhável é uma transição gravada. O
 * objetivo concluído é um fato com hora marcada e vai pro banco; "compartilhar
 * meu dia às 15h de uma terça comum" não é fato nenhum, é uma FOTO do estado
 * atual. Forçar a segunda a virar linha de tabela encheria o histórico de
 * eventos que nunca aconteceram.
 *
 * Os dois caminhos terminam no mesmo lugar: um `JourneyEvent`. O Share Studio
 * não sabe (nem precisa saber) se o evento veio do banco ou daqui — que é
 * exatamente o desacoplamento que o feed futuro vai precisar.
 *
 * Tudo aqui é função pura: recebe números já apurados pelo domínio, devolve
 * evento. Nenhum builder lê repositório, e nenhum recalcula momentum ou plano.
 */

/** Evento que não vai pro banco. O prefixo deixa isso óbvio em qualquer log. */
function ephemeral(input: NewJourneyEventInput, key: string): JourneyEvent {
  return createJourneyEvent(input, `efemero:${key}`)
}

/** Momentum antes: o score atual menos a variação que o próprio domínio calculou. */
function momentumPair(momentum: MomentumScore | null): {
  momentumBefore: number | null
  momentumAfter: number | null
} {
  if (!momentum) return { momentumBefore: null, momentumAfter: null }
  return { momentumBefore: momentum.value - momentum.delta, momentumAfter: momentum.value }
}

// ---------------------------------------------------------------------------
// dia
// ---------------------------------------------------------------------------

export interface DayEventInput {
  readonly userId: string
  readonly today: DayKey
  readonly done: number
  readonly total: number
  readonly items: readonly JourneyItem[]
  readonly focusMinutes: number
  readonly momentum: MomentumScore | null
}

export function dayCompletedEvent(input: DayEventInput): JourneyEvent {
  const ratio = input.total === 0 ? 0 : input.done / input.total

  return ephemeral(
    {
      userId: input.userId,
      type: 'day_completed',
      sourceType: 'day',
      sourceId: input.today,
      title: 'Hoje',
      completionPercentage: ratio,
      durationMin: input.focusMinutes || null,
      metadata: {
        items: input.items,
        tasksDone: input.done,
        ...(input.focusMinutes > 0 ? { focusMinutes: input.focusMinutes } : {}),
      },
      ...momentumPair(input.momentum),
    },
    `dia:${input.today}`,
  )
}

// ---------------------------------------------------------------------------
// rotina
// ---------------------------------------------------------------------------

export interface RoutineEventInput {
  readonly userId: string
  readonly today: DayKey
  readonly dayPart: DayPart
  readonly items: readonly JourneyItem[]
  readonly focusMinutes: number
  readonly momentum: MomentumScore | null
}

/** A rotina é o bloco do dia: os hábitos da manhã, os da noite. */
export function routineCompletedEvent(input: RoutineEventInput): JourneyEvent {
  const done = input.items.filter((item) => item.done).length
  const ratio = input.items.length === 0 ? 0 : done / input.items.length

  return ephemeral(
    {
      userId: input.userId,
      type: 'routine_completed',
      sourceType: 'routine',
      sourceId: `${input.today}:${input.dayPart}`,
      title: routineTitle(input.dayPart),
      completionPercentage: ratio,
      durationMin: input.focusMinutes || null,
      metadata: { items: input.items, habitsDone: done },
      ...momentumPair(input.momentum),
    },
    `rotina:${input.today}:${input.dayPart}`,
  )
}

export function routineTitle(dayPart: DayPart): string {
  return dayPart === 'qualquer' ? 'Minha rotina' : `Rotina da ${DAY_PART_LABELS[dayPart].toLowerCase()}`
}

// ---------------------------------------------------------------------------
// objetivo
// ---------------------------------------------------------------------------

export interface ObjectiveEventInput {
  readonly userId: string
  readonly today: DayKey
  readonly objectiveId: string
  readonly title: string
  readonly axis: ActivityTypeSlug
  /** 0 a 1: o que a tela do objetivo mostra, com plano ou por volume. */
  readonly ratio: number
  /** Avanço em pontos percentuais na última semana. */
  readonly gainPercentage: number | null
  readonly momentum: MomentumScore | null
}

export function goalProgressEvent(input: ObjectiveEventInput): JourneyEvent {
  return ephemeral(
    {
      userId: input.userId,
      type: 'goal_progress',
      sourceType: 'objective',
      sourceId: input.objectiveId,
      title: input.title,
      completionPercentage: input.ratio,
      progressAfter: input.ratio,
      metadata: {
        axis: input.axis,
        ...(input.gainPercentage !== null ? { gainPercentage: input.gainPercentage } : {}),
      },
      ...momentumPair(input.momentum),
    },
    `objetivo:${input.objectiveId}:${input.today}`,
  )
}

export function goalCompletedEvent(
  input: Omit<ObjectiveEventInput, 'ratio' | 'gainPercentage'>,
): JourneyEvent {
  return ephemeral(
    {
      userId: input.userId,
      type: 'goal_completed',
      sourceType: 'objective',
      sourceId: input.objectiveId,
      title: input.title,
      completionPercentage: 1,
      progressAfter: 1,
      metadata: { axis: input.axis },
      ...momentumPair(input.momentum),
    },
    `objetivo-concluido:${input.objectiveId}`,
  )
}

// ---------------------------------------------------------------------------
// semana
// ---------------------------------------------------------------------------

export interface WeekEventInput {
  readonly userId: string
  readonly weekStart: DayKey
  readonly weekEnd: DayKey
  /** 0 a 1. */
  readonly executionRate: number
  readonly habitsDone: number
  readonly focusMinutes: number
  readonly momentum: MomentumScore | null
}

export function weeklyReviewEvent(input: WeekEventInput): JourneyEvent {
  return ephemeral(
    {
      userId: input.userId,
      type: 'weekly_review',
      sourceType: 'week',
      sourceId: input.weekStart,
      title: 'Minha semana',
      completionPercentage: input.executionRate,
      durationMin: input.focusMinutes || null,
      metadata: {
        habitsDone: input.habitsDone,
        ...(input.focusMinutes > 0 ? { focusMinutes: input.focusMinutes } : {}),
      },
      ...momentumPair(input.momentum),
    },
    `semana:${input.weekStart}`,
  )
}

// ---------------------------------------------------------------------------
// momentum, retomada e marco
// ---------------------------------------------------------------------------

export interface MomentumEventInput {
  readonly userId: string
  readonly today: DayKey
  readonly momentum: MomentumScore
  readonly streakDays: number
}

export function momentumEvent(input: MomentumEventInput): JourneyEvent {
  return ephemeral(
    {
      userId: input.userId,
      type: 'momentum_record',
      sourceType: 'momentum',
      sourceId: input.today,
      title: 'Meu momentum',
      metadata: input.streakDays > 0 ? { streakDays: input.streakDays } : {},
      ...momentumPair(input.momentum),
    },
    `momentum:${input.today}`,
  )
}

export interface ComebackEventInput {
  readonly userId: string
  readonly today: DayKey
  readonly daysAway: number
  readonly momentum: MomentumScore | null
}

/**
 * A retomada.
 *
 * O card NUNCA registra a queda como falha: ele conta os dias parados só pra
 * dar tamanho ao retorno. Um card de retomada que envergonha é um card que
 * ninguém compartilha — e, pior, que ensina a pessoa a não voltar.
 */
export function comebackEvent(input: ComebackEventInput): JourneyEvent {
  return ephemeral(
    {
      userId: input.userId,
      type: 'comeback',
      sourceType: 'streak',
      sourceId: input.today,
      title: 'Voltei hoje',
      metadata: { daysAway: Math.max(1, input.daysAway) },
      ...momentumPair(input.momentum),
    },
    `retomada:${input.today}`,
  )
}

export interface MilestoneEventInput {
  readonly userId: string
  readonly today: DayKey
  readonly count: number
  /** "treinos concluídos", "dias usando o Momentumm". */
  readonly unit: string
  readonly axis?: ActivityTypeSlug
  readonly momentum: MomentumScore | null
}

export function milestoneEvent(input: MilestoneEventInput): JourneyEvent {
  return ephemeral(
    {
      userId: input.userId,
      type: 'milestone',
      sourceType: 'streak',
      sourceId: `${input.count}:${input.unit}`,
      title: `${input.count} ${input.unit}`,
      metadata: {
        milestoneCount: input.count,
        milestoneUnit: input.unit,
        ...(input.axis ? { axis: input.axis } : {}),
      },
      ...momentumPair(input.momentum),
    },
    `marco:${input.count}:${input.unit}`,
  )
}

// ---------------------------------------------------------------------------
// desafio
// ---------------------------------------------------------------------------

export interface ChallengeEventInput {
  readonly userId: string
  readonly today: DayKey
  readonly challengeId: string
  readonly name: string
  readonly axis: ActivityTypeSlug
  readonly doneDays: number
  readonly requiredDays: number
  /** Quantas pessoas estão dentro. Nunca quem são. */
  readonly people: number
  readonly momentum: MomentumScore | null
}

/**
 * O card do desafio, montado na hora.
 *
 * Compartilhar "como está indo o desafio" numa terça qualquer não é uma
 * transição: é a foto do estado, e por isso sai daqui em vez de virar linha no
 * banco. O evento gravado — entrada, marco, conclusão — continua vindo do
 * `challenge-recorder`.
 *
 * O tipo acompanha o estado: fechado vira conclusão, o resto vira avanço. É o
 * que faz o card dizer "Desafio concluído" sem ninguém precisar escolher isso
 * numa lista.
 */
export function challengeShareEvent(input: ChallengeEventInput): JourneyEvent {
  const ratio = input.requiredDays === 0 ? 0 : Math.min(1, input.doneDays / input.requiredDays)
  const done = ratio >= 1

  return ephemeral(
    {
      userId: input.userId,
      type: done ? 'challenge_completed' : 'challenge_progress',
      sourceType: 'challenge',
      sourceId: input.challengeId,
      title: input.name,
      completionPercentage: ratio,
      progressAfter: ratio,
      metadata: {
        axis: input.axis,
        challengeDoneDays: input.doneDays,
        challengeRequiredDays: input.requiredDays,
        challengePeople: input.people,
      },
      ...momentumPair(input.momentum),
    },
    `desafio:${input.challengeId}:${input.today}`,
  )
}
