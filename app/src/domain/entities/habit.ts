import { DomainError } from '@/shared/errors'
import { activityType, type ActivityTypeSlug } from './activity-type'
import { addDays, dayKeyOf, dayKeyToDate, daysBetween, type DayKey } from './day'

/**
 * Hábito: a repetição que sustenta o resto. Ele não é uma tarefa que some
 * quando acaba — é um compromisso que se repete e cuja constância importa mais
 * que qualquer dia isolado.
 *
 * Regra de produto: perder um dia NÃO é punido. Por isso `pulado` e `adiado`
 * são estados legítimos, e a versão mínima conta como cumprimento na sequência.
 */

export const DAY_PARTS = ['manha', 'tarde', 'noite', 'qualquer'] as const
export type DayPart = (typeof DAY_PARTS)[number]

export const DAY_PART_LABELS: Readonly<Record<DayPart, string>> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  qualquer: 'Qualquer hora',
}

export const HABIT_STATUSES = ['pendente', 'feito', 'minimo', 'pulado', 'adiado'] as const
export type HabitStatus = (typeof HABIT_STATUSES)[number]

export const HABIT_STATUS_LABELS: Readonly<Record<HabitStatus, string>> = {
  pendente: 'Pendente',
  feito: 'Concluído',
  minimo: 'Versão mínima',
  pulado: 'Pulado com consciência',
  adiado: 'Adiado',
}

/** Chaves de ícone resolvidas na apresentação. O domínio não conhece SVG. */
export const HABIT_ICONS = [
  'livro',
  'cerebro',
  'halter',
  'lotus',
  'agua',
  'sol',
  'lua',
  'caneta',
] as const
export type HabitIcon = (typeof HABIT_ICONS)[number]

export const MAX_HABIT_NAME = 60

export interface Habit {
  readonly id: string
  readonly userId: string
  readonly name: string
  readonly icon: HabitIcon
  /** Eixo que o hábito alimenta. Concluir gera atividade desse eixo. */
  readonly axis: ActivityTypeSlug
  readonly dayPart: DayPart
  /** Dias da semana (0 = domingo). Vazio significa todos os dias. */
  readonly weekdays: readonly number[]
  /** Meta do hábito na unidade do eixo. */
  readonly target: number
  /** Versão que cabe num dia ruim. Sempre menor ou igual ao alvo. */
  readonly minimalTarget: number
  readonly createdAt: Date
  readonly archivedAt: Date | null
}

export interface HabitLog {
  readonly id: string
  readonly userId: string
  readonly habitId: string
  readonly day: DayKey
  readonly status: HabitStatus
  readonly createdAt: Date
}

export interface NewHabitInput {
  readonly userId: string
  readonly name: string
  readonly icon: HabitIcon
  readonly axis: ActivityTypeSlug
  readonly dayPart: DayPart
  readonly weekdays?: readonly number[]
  readonly target: number
  readonly minimalTarget?: number
}

export function createHabit(input: NewHabitInput, id: string, now = new Date()): Habit {
  const name = input.name.trim()
  if (name.length < 2) {
    throw new DomainError('Dá um nome ao hábito com pelo menos 2 letras.')
  }
  if (name.length > MAX_HABIT_NAME) {
    throw new DomainError(`O nome pode ter no máximo ${MAX_HABIT_NAME} caracteres.`)
  }

  const target = Math.round(input.target)
  if (!Number.isFinite(target) || target <= 0) {
    throw new DomainError('A meta do hábito precisa ser maior que zero.')
  }

  const weekdays = normalizeWeekdays(input.weekdays ?? [])

  // Versão mínima padrão: um terço do alvo, nunca menor que 1. É o que mantém
  // a sequência viva num dia ruim sem transformar o hábito em teatro.
  const minimalTarget = Math.max(
    1,
    Math.min(target, Math.round(input.minimalTarget ?? target / 3)),
  )

  return {
    id,
    userId: input.userId,
    name,
    icon: input.icon,
    axis: input.axis,
    dayPart: input.dayPart,
    weekdays,
    target,
    minimalTarget,
    createdAt: now,
    archivedAt: null,
  }
}

function normalizeWeekdays(weekdays: readonly number[]): readonly number[] {
  const valid = [...new Set(weekdays)].filter(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  )
  // Sete dias marcados é o mesmo que "todos": guarda vazio pra ter uma forma só.
  return valid.length === 7 ? [] : valid.sort((a, b) => a - b)
}

export function isHabitActive(habit: Habit): boolean {
  return habit.archivedAt === null
}

export function isScheduledOn(habit: Habit, day: DayKey): boolean {
  if (habit.weekdays.length === 0) return true
  return habit.weekdays.includes(dayKeyToDate(day).getDay())
}

export function habitsScheduledOn(habits: readonly Habit[], day: DayKey): Habit[] {
  return habits.filter((habit) => isHabitActive(habit) && isScheduledOn(habit, day))
}

export function frequencyLabel(habit: Habit): string {
  if (habit.weekdays.length === 0) return 'Todos os dias'

  const weekdaysOnly =
    habit.weekdays.length === 5 && !habit.weekdays.includes(0) && !habit.weekdays.includes(6)
  if (weekdaysOnly) return 'Dias de semana'

  const initials = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const
  return habit.weekdays.map((day) => initials[day] ?? '?').join(' · ')
}

export function habitTargetLabel(habit: Habit, value = habit.target): string {
  const type = activityType(habit.axis)
  const unit = value === 1 ? type.unitLabel.one : type.unitLabel.many
  return `${value} ${unit}`
}

/** Status do hábito no dia. Sem registro, é pendente. */
export function statusOf(logs: readonly HabitLog[], habitId: string, day: DayKey): HabitStatus {
  return logs.find((log) => log.habitId === habitId && log.day === day)?.status ?? 'pendente'
}

/** Feito ou feito na versão mínima: os dois contam. Essa é a regra do produto. */
export function countsAsDone(status: HabitStatus): boolean {
  return status === 'feito' || status === 'minimo'
}

export interface HabitDayState {
  readonly habit: Habit
  readonly status: HabitStatus
  readonly streak: number
}

export function habitDayStates(
  habits: readonly Habit[],
  logs: readonly HabitLog[],
  day: DayKey,
): HabitDayState[] {
  return habitsScheduledOn(habits, day).map((habit) => ({
    habit,
    status: statusOf(logs, habit.id, day),
    streak: habitStreak(habit, logs, day),
  }))
}

export interface HabitDayProgress {
  readonly total: number
  readonly done: number
  readonly ratio: number
  readonly allDone: boolean
}

export function habitDayProgress(states: readonly HabitDayState[]): HabitDayProgress {
  const total = states.length
  const done = states.filter((state) => countsAsDone(state.status)).length
  return {
    total,
    done,
    ratio: total === 0 ? 0 : done / total,
    allDone: total > 0 && done === total,
  }
}

/** Quantos dias a sequência de um hábito olha pra trás antes de desistir. */
const STREAK_LOOKBACK_DAYS = 400

/**
 * Sequência do hábito. Só conta dia em que ele estava programado — quem faz um
 * hábito de segunda a sexta não pode perder a sequência no sábado.
 *
 * Como no streak geral, hoje ainda pendente não quebra nada: abrir o app de
 * manhã não pode zerar o número.
 */
export function habitStreak(habit: Habit, logs: readonly HabitLog[], today: DayKey): number {
  const doneDays = new Set(
    logs.filter((log) => log.habitId === habit.id && countsAsDone(log.status)).map((log) => log.day),
  )
  if (doneDays.size === 0) return 0

  const firstDay = dayKeyOf(habit.createdAt)
  let streak = 0
  let cursor = today

  for (let step = 0; step < STREAK_LOOKBACK_DAYS; step += 1) {
    if (daysBetween(firstDay, cursor) < 0) break

    if (!isScheduledOn(habit, cursor)) {
      cursor = addDays(cursor, -1)
      continue
    }

    if (doneDays.has(cursor)) {
      streak += 1
    } else if (cursor !== today) {
      break
    }

    cursor = addDays(cursor, -1)
  }

  return streak
}
