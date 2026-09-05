import { DomainError } from '@/shared/errors'
import { activityType, type ActivityTypeSlug } from './activity-type'
import { addDays, dayKeyOf, dayKeyToDate, dayRange, daysBetween, type DayKey } from './day'
import type { Priority } from './priority'

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
export const MAX_HABIT_DESCRIPTION = 240

/**
 * Como o hábito se repete.
 *
 * `vezes-semana` existe porque é assim que a maioria dos compromissos reais
 * funciona: "treinar 3x por semana" não tem dia fixo, e forçar a escolha de
 * segunda, quarta e sexta cria uma falha falsa toda vez que a pessoa troca o
 * dia. Ele é cobrado por semana, nunca por dia.
 */
export const HABIT_FREQUENCIES = ['diario', 'dias-semana', 'vezes-semana'] as const
export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number]

export const HABIT_FREQUENCY_LABELS: Readonly<Record<HabitFrequency, string>> = {
  diario: 'Todo dia',
  'dias-semana': 'Dias específicos',
  'vezes-semana': 'Vezes por semana',
}

export interface Habit {
  readonly id: string
  readonly userId: string
  readonly name: string
  readonly description: string | null
  readonly icon: HabitIcon
  /** Eixo que o hábito alimenta. Concluir gera atividade desse eixo. */
  readonly axis: ActivityTypeSlug
  /** Objetivo que esse hábito empurra. Null quando é um hábito solto. */
  readonly objectiveId: string | null
  readonly priority: Priority
  readonly frequency: HabitFrequency
  readonly dayPart: DayPart
  /** Horário sugerido em `HH:MM`. Opcional: lembrete, nunca cobrança. */
  readonly timeOfDay: string | null
  /** Dias da semana (0 = domingo). Vazio significa todos os dias. */
  readonly weekdays: readonly number[]
  /** Alvo de dias por semana quando a frequência é `vezes-semana`. */
  readonly timesPerWeek: number
  /** Meta do hábito na unidade do eixo. */
  readonly target: number
  /** Versão que cabe num dia ruim. Sempre menor ou igual ao alvo. */
  readonly minimalTarget: number
  readonly createdAt: Date
  /** Pausa: o hábito some do dia sem sumir da lista nem perder o histórico. */
  readonly pausedAt: Date | null
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
  readonly description?: string | null
  readonly objectiveId?: string | null
  readonly priority?: Priority
  readonly frequency?: HabitFrequency
  readonly timeOfDay?: string | null
  readonly timesPerWeek?: number
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const MAX_TIMES_PER_WEEK = 7

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

  const description = input.description?.trim() || null
  if (description && description.length > MAX_HABIT_DESCRIPTION) {
    throw new DomainError(`A descrição pode ter no máximo ${MAX_HABIT_DESCRIPTION} caracteres.`)
  }

  const timeOfDay = input.timeOfDay?.trim() || null
  if (timeOfDay && !TIME_PATTERN.test(timeOfDay)) {
    throw new DomainError('O horário precisa estar no formato HH:MM.')
  }

  const weekdays = normalizeWeekdays(input.weekdays ?? [])

  // A frequência é inferida quando não vem explícita: hábito com dias marcados
  // é de dias específicos, sem dias marcados é diário. Isso mantém compatível
  // todo hábito criado antes da frequência existir.
  const frequency: HabitFrequency = input.frequency ?? (weekdays.length > 0 ? 'dias-semana' : 'diario')

  const timesPerWeek = normalizeTimesPerWeek(input.timesPerWeek, frequency)

  if (frequency === 'dias-semana' && weekdays.length === 0) {
    throw new DomainError('Escolhe pelo menos um dia da semana pro hábito.')
  }

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
    description,
    icon: input.icon,
    axis: input.axis,
    objectiveId: input.objectiveId ?? null,
    priority: input.priority ?? 'media',
    frequency,
    dayPart: input.dayPart,
    timeOfDay,
    weekdays: frequency === 'dias-semana' ? weekdays : [],
    timesPerWeek,
    target,
    minimalTarget,
    createdAt: now,
    pausedAt: null,
    archivedAt: null,
  }
}

function normalizeTimesPerWeek(value: number | undefined, frequency: HabitFrequency): number {
  if (frequency !== 'vezes-semana') return MAX_TIMES_PER_WEEK
  const rounded = Math.round(value ?? 3)
  if (!Number.isFinite(rounded) || rounded < 1 || rounded > MAX_TIMES_PER_WEEK) {
    throw new DomainError('O hábito precisa de 1 a 7 vezes por semana.')
  }
  return rounded
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

/** Ativo e não pausado: só esse cobra o dia. */
export function isHabitRunning(habit: Habit): boolean {
  return habit.archivedAt === null && habit.pausedAt === null
}

/**
 * O hábito pode ser feito nesse dia?
 *
 * `vezes-semana` responde sim todo dia de propósito: ele não tem dia marcado,
 * tem cota semanal. Quem decide se a cota foi cumprida é `weeklyQuotaMet`, e é
 * ele — não este — que evita cobrar sete dias de um hábito de três.
 */
export function isScheduledOn(habit: Habit, day: DayKey): boolean {
  if (habit.frequency === 'dias-semana' && habit.weekdays.length > 0) {
    return habit.weekdays.includes(dayKeyToDate(day).getDay())
  }
  return true
}

/** Dias por semana que o hábito realmente espera. É a base de toda cobrança. */
export function expectedDaysPerWeek(habit: Habit): number {
  switch (habit.frequency) {
    case 'diario':
      return 7
    case 'dias-semana':
      return habit.weekdays.length || 7
    case 'vezes-semana':
      return habit.timesPerWeek
  }
}

/**
 * Quantas vezes o hábito era esperado no intervalo.
 *
 * Para `vezes-semana` a conta é proporcional, não por dia: sete dias de um
 * hábito de três vezes esperam três, não sete. Sem isso a taxa de consistência
 * de quem cumpre a cota inteira apareceria como 43%.
 */
export function scheduledCountBetween(habit: Habit, from: DayKey, to: DayKey): number {
  const days = dayRange(from, to).filter((day) => day >= dayKeyOf(habit.createdAt))
  if (days.length === 0) return 0

  if (habit.frequency === 'vezes-semana') {
    return Math.round((days.length / 7) * habit.timesPerWeek)
  }

  return days.filter((day) => isScheduledOn(habit, day)).length
}

/** A cota semanal desse hábito já foi cumprida na semana que contém o dia? */
export function weeklyQuotaMet(habit: Habit, logs: readonly HabitLog[], day: DayKey): boolean {
  if (habit.frequency !== 'vezes-semana') return false

  const weekStart = addDays(day, -((dayKeyToDate(day).getDay() + 6) % 7))
  const weekEnd = addDays(weekStart, 6)

  const done = logs.filter(
    (log) =>
      log.habitId === habit.id &&
      countsAsDone(log.status) &&
      log.day >= weekStart &&
      log.day <= weekEnd &&
      log.day !== day,
  ).length

  return done >= habit.timesPerWeek
}

export function habitsScheduledOn(habits: readonly Habit[], day: DayKey): Habit[] {
  return habits.filter((habit) => isHabitRunning(habit) && isScheduledOn(habit, day))
}

/**
 * Os hábitos que aparecem no dia. Diferente de `habitsScheduledOn` porque tira
 * o `vezes-semana` que já bateu a cota — deixá-lo ali transformaria uma semana
 * cumprida em quatro linhas pendentes.
 */
export function habitsForDay(
  habits: readonly Habit[],
  logs: readonly HabitLog[],
  day: DayKey,
): Habit[] {
  return habitsScheduledOn(habits, day).filter((habit) => !weeklyQuotaMet(habit, logs, day))
}

export function frequencyLabel(habit: Habit): string {
  if (habit.frequency === 'vezes-semana') {
    return `${habit.timesPerWeek}x por semana`
  }

  if (habit.weekdays.length === 0) return 'Todos os dias'

  const weekdaysOnly =
    habit.weekdays.length === 5 && !habit.weekdays.includes(0) && !habit.weekdays.includes(6)
  if (weekdaysOnly) return 'Dias de semana'

  const initials = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const
  return habit.weekdays.map((day) => initials[day] ?? '?').join(' · ')
}

export interface HabitConsistency {
  readonly done: number
  readonly expected: number
  /** 0 a 1. Sem expectativa no período a taxa é 0 e a tela mostra "sem dados". */
  readonly rate: number
  /** Quantos dos últimos 7 dias esperados foram cumpridos. */
  readonly recent: number
}

/**
 * Taxa de consistência. Deliberadamente NÃO é sequência: o produto não pune
 * quem perde um dia, então a leitura que importa é "de dez vezes esperadas,
 * quantas saíram" — um número que uma falha isolada quase não move.
 */
export function habitConsistency(
  habit: Habit,
  logs: readonly HabitLog[],
  from: DayKey,
  to: DayKey,
): HabitConsistency {
  const done = logs.filter(
    (log) =>
      log.habitId === habit.id && countsAsDone(log.status) && log.day >= from && log.day <= to,
  ).length

  /*
    O esperado nunca fica abaixo do que foi feito.

    Sem isso, cumprir o hábito num dia fora da frequência — sábado num hábito de
    segunda a sexta, ou o próprio dia em que ele foi criado — produz "1 de 0":
    um número que não significa nada e uma taxa de 0% pra quem acabou de fazer.
    Fazer além do combinado dá 100%, nunca mais que isso.
  */
  const expected = Math.max(scheduledCountBetween(habit, from, to), done)

  const recentFrom = addDays(to, -6)
  const recent = logs.filter(
    (log) =>
      log.habitId === habit.id &&
      countsAsDone(log.status) &&
      log.day >= recentFrom &&
      log.day <= to,
  ).length

  return {
    done,
    expected,
    rate: expected === 0 ? 0 : Math.min(1, done / expected),
    recent,
  }
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
  return habitsForDay(habits, logs, day).map((habit) => ({
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
