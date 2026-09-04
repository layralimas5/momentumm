import { DomainError } from '@/shared/errors'
import {
  activityType,
  formatUnit,
  type ActivityTypeSlug,
  type ActivityUnit,
} from './activity-type'
import { dayKeyOf, type DayKey } from './day'

/**
 * A unidade única do Momentumm. Leitura, estudo, treino e meditação são a mesma
 * entidade com `type` diferente. Nada de tabela por eixo.
 */
export interface Activity {
  readonly id: string
  readonly userId: string
  readonly type: ActivityTypeSlug
  readonly value: number
  readonly unit: ActivityUnit
  /** Sempre em minutos. É o que permite somar eixos diferentes no mesmo total. */
  readonly durationMin: number
  readonly note: string | null
  readonly day: DayKey
  readonly occurredAt: Date
  readonly visibility: ActivityVisibility
  readonly source: ActivitySource
}

export const ACTIVITY_VISIBILITIES = ['publica', 'seguidores', 'privada'] as const
export type ActivityVisibility = (typeof ACTIVITY_VISIBILITIES)[number]

export const ACTIVITY_SOURCES = ['manual', 'timer', 'importacao'] as const
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number]

export const VISIBILITY_LABELS: Readonly<Record<ActivityVisibility, string>> = {
  publica: 'Pública',
  seguidores: 'Só quem me segue',
  privada: 'Só eu',
}

export const MAX_VALUE = 100_000
export const MAX_DURATION_MIN = 24 * 60
export const MAX_NOTE_LENGTH = 280

/** Estimativa usada quando o eixo é medido em páginas e não em tempo. */
const MINUTES_PER_PAGE = 1.5

export interface NewActivityInput {
  readonly userId: string
  readonly type: ActivityTypeSlug
  readonly value: number
  readonly durationMin?: number
  readonly note?: string | null
  readonly occurredAt?: Date
  readonly visibility?: ActivityVisibility
  readonly source?: ActivitySource
}

export function createActivity(input: NewActivityInput, id: string): Activity {
  const type = activityType(input.type)
  const value = normalizeValue(input.value)
  const occurredAt = input.occurredAt ?? new Date()

  if (occurredAt.getTime() > Date.now() + 60_000) {
    throw new DomainError('Não dá pra registrar uma atividade no futuro.')
  }

  const note = normalizeNote(input.note)
  const durationMin = resolveDuration(input.durationMin, type.unit, value)

  return {
    id,
    userId: input.userId,
    type: input.type,
    value,
    unit: type.unit,
    durationMin,
    note,
    day: dayKeyOf(occurredAt),
    occurredAt,
    visibility: input.visibility ?? 'publica',
    source: input.source ?? 'manual',
  }
}

function normalizeValue(value: number): number {
  if (!Number.isFinite(value)) {
    throw new DomainError('Informe um número válido.')
  }
  const rounded = Math.round(value)
  if (rounded <= 0) {
    throw new DomainError('O valor precisa ser maior que zero.')
  }
  if (rounded > MAX_VALUE) {
    throw new DomainError('Esse valor está fora do razoável. Confere aí.')
  }
  return rounded
}

function normalizeNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_NOTE_LENGTH) {
    throw new DomainError(`A nota pode ter no máximo ${MAX_NOTE_LENGTH} caracteres.`)
  }
  return trimmed
}

function resolveDuration(
  durationMin: number | undefined,
  unit: ActivityUnit,
  value: number,
): number {
  const raw = durationMin ?? (unit === 'minutos' ? value : Math.round(value * MINUTES_PER_PAGE))
  const rounded = Math.round(raw)
  if (rounded < 0) {
    throw new DomainError('A duração não pode ser negativa.')
  }
  return Math.min(rounded, MAX_DURATION_MIN)
}

export function describeActivity(activity: Activity): string {
  const type = activityType(activity.type)
  return `${type.verb} ${formatUnit(type, activity.value)}`
}

export function totalMinutes(activities: readonly Activity[]): number {
  return activities.reduce((sum, activity) => sum + activity.durationMin, 0)
}

export function totalValueOfType(
  activities: readonly Activity[],
  type: ActivityTypeSlug,
): number {
  return activities.reduce((sum, activity) => (activity.type === type ? sum + activity.value : sum), 0)
}

export function groupByDay(activities: readonly Activity[]): Map<DayKey, Activity[]> {
  const grouped = new Map<DayKey, Activity[]>()
  for (const activity of activities) {
    const bucket = grouped.get(activity.day)
    if (bucket) bucket.push(activity)
    else grouped.set(activity.day, [activity])
  }
  return grouped
}

export function sortByRecent(activities: readonly Activity[]): Activity[] {
  return [...activities].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
}
