import { DomainError } from '@/shared/errors'
import type { Activity } from './activity'
import { activityType, formatUnit, type ActivityTypeSlug } from './activity-type'
import { addDays, daysBetween, startOfMonth, startOfWeek, type DayKey } from './day'

export const GOAL_PERIODS = ['dia', 'semana', 'mes'] as const
export type GoalPeriod = (typeof GOAL_PERIODS)[number]

export const GOAL_PERIOD_LABELS: Readonly<Record<GoalPeriod, string>> = {
  dia: 'por dia',
  semana: 'por semana',
  mes: 'por mês',
}

export interface Goal {
  readonly id: string
  readonly userId: string
  readonly type: ActivityTypeSlug
  readonly target: number
  readonly period: GoalPeriod
  readonly createdAt: Date
  readonly archivedAt: Date | null
}

export interface GoalProgress {
  readonly goal: Goal
  readonly done: number
  readonly target: number
  readonly ratio: number
  readonly remaining: number
  readonly achieved: boolean
  readonly periodStart: DayKey
  readonly periodEnd: DayKey
  readonly daysLeft: number
}

export const MAX_TARGET = 100_000

export interface NewGoalInput {
  readonly userId: string
  readonly type: ActivityTypeSlug
  readonly target: number
  readonly period: GoalPeriod
}

export function createGoal(input: NewGoalInput, id: string, now = new Date()): Goal {
  const target = Math.round(input.target)
  if (!Number.isFinite(target) || target <= 0) {
    throw new DomainError('A meta precisa ser maior que zero.')
  }
  if (target > MAX_TARGET) {
    throw new DomainError('Essa meta está fora do razoável.')
  }

  return {
    id,
    userId: input.userId,
    type: input.type,
    target,
    period: input.period,
    createdAt: now,
    archivedAt: null,
  }
}

export function isActive(goal: Goal): boolean {
  return goal.archivedAt === null
}

export function periodBounds(period: GoalPeriod, today: DayKey): [DayKey, DayKey] {
  switch (period) {
    case 'dia':
      return [today, today]
    case 'semana': {
      const start = startOfWeek(today)
      return [start, addDays(start, 6)]
    }
    case 'mes': {
      const start = startOfMonth(today)
      return [start, lastDayOfMonth(start)]
    }
  }
}

function lastDayOfMonth(start: DayKey): DayKey {
  const [year, month] = start.split('-').map(Number) as [number, number]
  const date = new Date(year, month, 0, 12, 0, 0, 0)
  return `${year}-${`${month}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}` as DayKey
}

export function progressOf(
  goal: Goal,
  activities: readonly Activity[],
  today: DayKey,
): GoalProgress {
  const [periodStart, periodEnd] = periodBounds(goal.period, today)

  const done = activities.reduce((sum, activity) => {
    if (activity.type !== goal.type) return sum
    if (activity.day < periodStart || activity.day > periodEnd) return sum
    return sum + activity.value
  }, 0)

  const ratio = Math.min(1, done / goal.target)

  return {
    goal,
    done,
    target: goal.target,
    ratio,
    remaining: Math.max(0, goal.target - done),
    achieved: done >= goal.target,
    periodStart,
    periodEnd,
    daysLeft: Math.max(0, daysBetween(today, periodEnd)),
  }
}

export function describeGoal(goal: Goal): string {
  const type = activityType(goal.type)
  return `${formatUnit(type, goal.target)} ${GOAL_PERIOD_LABELS[goal.period]}`
}
