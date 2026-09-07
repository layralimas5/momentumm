import { DomainError } from '@/shared/errors'
import type { ActivityTypeSlug } from './activity-type'
import { dayKeyOf, type DayKey } from './day'

/**
 * O momento notável da jornada.
 *
 * ## Por que não se chama `Activity`
 *
 * `Activity` já é a unidade do Momentumm — "leu 32 páginas", "treinou 45
 * minutos" — e é ela que alimenta streak, meta e histórico. O que esta entidade
 * guarda é outra coisa: o EVENTO que vale contar. Dia fechado, rotina cumprida,
 * objetivo concluído, momentum recorde, retomada. Um registro de esforço é
 * matéria-prima; um evento é resultado. Reaproveitar o nome faria as duas
 * tabelas discordarem sobre o que "atividade" significa, e o feed futuro leria
 * a errada.
 *
 * ## O que ela existe pra sustentar
 *
 * Hoje: o Share Studio. Depois: feed de amigos, perfil, comunidade, desafios,
 * notificações e histórico de progresso. Por isso ela NÃO conhece hábito,
 * objetivo nem etapa — guarda `sourceType` + `sourceId` e os números já
 * apurados. Quem produz o evento é quem conhece a origem.
 *
 * ## Privado por padrão, sempre
 *
 * O produto continua single-player. `visibility` existe pra a camada social
 * não exigir migration destrutiva quando chegar, mas todo evento nasce
 * `privada` — e compartilhar externamente uma imagem NÃO muda isso: publicar
 * no Instagram é uma decisão sobre um PNG, não sobre o dado.
 */

export const JOURNEY_EVENT_TYPES = [
  'habit_completed',
  'routine_completed',
  'day_completed',
  'goal_progress',
  'goal_completed',
  'milestone',
  'weekly_review',
  'comeback',
  'momentum_record',
] as const

export type JourneyEventType = (typeof JOURNEY_EVENT_TYPES)[number]

export const JOURNEY_EVENT_TYPE_LABELS: Readonly<Record<JourneyEventType, string>> = {
  habit_completed: 'Hábito concluído',
  routine_completed: 'Rotina concluída',
  day_completed: 'Dia concluído',
  goal_progress: 'Progresso do objetivo',
  goal_completed: 'Objetivo concluído',
  milestone: 'Marco',
  weekly_review: 'Resumo da semana',
  comeback: 'Retomada',
  momentum_record: 'Momentum',
}

/** De onde o evento veio. Só o produtor do evento sabe traduzir o `sourceId`. */
export const JOURNEY_EVENT_SOURCES = [
  'habit',
  'routine',
  'day',
  'objective',
  'week',
  'momentum',
  'streak',
] as const

export type JourneyEventSource = (typeof JOURNEY_EVENT_SOURCES)[number]

/**
 * Alcance do evento.
 *
 * Os quatro degraus estão aqui desde já porque adicionar valor a enum em
 * Postgres é barato, mas mudar o DEFAULT de uma tabela cheia depois que
 * milhares de linhas nasceram públicas não é. Nesta versão o app só escreve
 * `privada`.
 */
export const JOURNEY_VISIBILITIES = ['privada', 'amigos', 'comunidade', 'publica'] as const
export type JourneyVisibility = (typeof JOURNEY_VISIBILITIES)[number]

export const JOURNEY_VISIBILITY_LABELS: Readonly<Record<JourneyVisibility, string>> = {
  privada: 'Só eu',
  amigos: 'Amigos',
  comunidade: 'Comunidade',
  publica: 'Pública',
}

/** Uma linha da lista do evento: os hábitos de uma rotina, as ações de um dia. */
export interface JourneyItem {
  readonly label: string
  readonly done: boolean
}

/**
 * O que sobra depois dos campos fixos.
 *
 * Tipado, não `Record<string, unknown>`: metadata livre vira depósito, e em
 * seis meses ninguém sabe quais chaves existem nem quem lê cada uma. Campo
 * novo entra aqui como campo opcional nomeado.
 */
export interface JourneyEventMetadata {
  readonly items?: readonly JourneyItem[]
  readonly axis?: ActivityTypeSlug
  /** Dias de sequência no momento do evento. */
  readonly streakDays?: number
  /** Dias parados antes da retomada. Só em `comeback`. */
  readonly daysAway?: number
  readonly habitsDone?: number
  readonly tasksDone?: number
  readonly focusMinutes?: number
  /** Avanço em pontos percentuais na janela. Só em `goal_progress`. */
  readonly gainPercentage?: number
  /** O número do marco: 50 treinos, 100 dias. Só em `milestone`. */
  readonly milestoneCount?: number
  readonly milestoneUnit?: string
}

export interface JourneyEvent {
  readonly id: string
  readonly userId: string
  readonly type: JourneyEventType
  readonly sourceType: JourneyEventSource
  /** Id do hábito, objetivo, semana ou dia que originou o evento. */
  readonly sourceId: string | null
  readonly title: string
  readonly description: string | null
  /** Progresso do objetivo antes e depois, de 0 a 1. */
  readonly progressBefore: number | null
  readonly progressAfter: number | null
  /** Momentum de 0 a 100. */
  readonly momentumBefore: number | null
  readonly momentumAfter: number | null
  /** Derivado: existe só quando os dois lados existem. */
  readonly momentumChange: number | null
  readonly durationMin: number | null
  /** Quanto do que estava planejado saiu, de 0 a 1. */
  readonly completionPercentage: number | null
  readonly metadata: JourneyEventMetadata
  readonly visibility: JourneyVisibility
  readonly day: DayKey
  readonly createdAt: Date
  readonly completedAt: Date | null
}

export const MAX_EVENT_TITLE = 120
export const MAX_EVENT_DESCRIPTION = 400
export const MAX_EVENT_ITEMS = 12

export interface NewJourneyEventInput {
  readonly userId: string
  readonly type: JourneyEventType
  readonly sourceType: JourneyEventSource
  readonly sourceId?: string | null
  readonly title: string
  readonly description?: string | null
  readonly progressBefore?: number | null
  readonly progressAfter?: number | null
  readonly momentumBefore?: number | null
  readonly momentumAfter?: number | null
  readonly durationMin?: number | null
  readonly completionPercentage?: number | null
  readonly metadata?: JourneyEventMetadata
  readonly visibility?: JourneyVisibility
  readonly occurredAt?: Date
}

export function createJourneyEvent(input: NewJourneyEventInput, id: string): JourneyEvent {
  const title = input.title.trim().replace(/\s+/g, ' ')
  if (title.length === 0) {
    throw new DomainError('O momento precisa de um título.')
  }

  const occurredAt = input.occurredAt ?? new Date()
  const momentumBefore = normalizeScore(input.momentumBefore, 'momentum')
  const momentumAfter = normalizeScore(input.momentumAfter, 'momentum')

  return {
    id,
    userId: input.userId,
    type: input.type,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    title: title.slice(0, MAX_EVENT_TITLE),
    description: normalizeDescription(input.description),
    progressBefore: normalizeRatio(input.progressBefore),
    progressAfter: normalizeRatio(input.progressAfter),
    momentumBefore,
    momentumAfter,
    // Derivado, nunca informado: guardar a variação separada abriria a porta
    // pra um card dizendo "+6" com 76 → 81 escrito ao lado.
    momentumChange:
      momentumBefore !== null && momentumAfter !== null ? momentumAfter - momentumBefore : null,
    durationMin: normalizeDuration(input.durationMin),
    completionPercentage: normalizeRatio(input.completionPercentage),
    metadata: normalizeMetadata(input.metadata),
    // Privado por padrão e ponto: o produto é single-player, e um evento que
    // nasce visível é um vazamento esperando a camada social existir.
    visibility: input.visibility ?? 'privada',
    day: dayKeyOf(occurredAt),
    createdAt: new Date(),
    completedAt: occurredAt,
  }
}

function normalizeRatio(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value)) {
    throw new DomainError('Percentual inválido no momento da jornada.')
  }
  return Math.min(1, Math.max(0, value))
}

function normalizeScore(value: number | null | undefined, label: string): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value)) {
    throw new DomainError(`Valor de ${label} inválido.`)
  }
  return Math.min(100, Math.max(0, Math.round(value)))
}

function normalizeDuration(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value)
}

function normalizeDescription(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_EVENT_DESCRIPTION)
}

function normalizeMetadata(metadata: JourneyEventMetadata | undefined): JourneyEventMetadata {
  if (!metadata) return {}
  const items = metadata.items
    ?.filter((item) => item.label.trim().length > 0)
    .slice(0, MAX_EVENT_ITEMS)
    .map((item) => ({ label: item.label.trim(), done: item.done }))

  return items && items.length > 0 ? { ...metadata, items } : stripItems(metadata)
}

function stripItems(metadata: JourneyEventMetadata): JourneyEventMetadata {
  const { items: _items, ...rest } = metadata
  return rest
}

/**
 * Chave de deduplicação.
 *
 * "Dia concluído" nasce de um clique em hábito, e o último hábito do dia pode
 * ser desmarcado e remarcado três vezes. Sem chave estável o histórico
 * acumularia três dias concluídos iguais — e o feed futuro os mostraria todos.
 */
export function journeyEventKey(event: {
  readonly type: JourneyEventType
  readonly sourceId: string | null
  readonly day: DayKey
}): string {
  return `${event.type}:${event.sourceId ?? '-'}:${event.day}`
}

export function sortEventsByRecent(events: readonly JourneyEvent[]): JourneyEvent[] {
  return [...events].sort(
    (a, b) =>
      (b.completedAt ?? b.createdAt).getTime() - (a.completedAt ?? a.createdAt).getTime(),
  )
}

/** Eventos que a pessoa ainda não compartilhou nem viu: base do futuro feed. */
export function eventsOfDay(events: readonly JourneyEvent[], day: DayKey): JourneyEvent[] {
  return events.filter((event) => event.day === day)
}
