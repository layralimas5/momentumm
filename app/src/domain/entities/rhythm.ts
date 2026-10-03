import { addDays, dayKeyToDate, dayRange, startOfWeek, type DayKey } from './day'
import { countsAsDone } from './habit'
import { creditOfDay, type MomentumInput } from './momentum'

/*
  Leituras do ritmo que o Progresso mostra sem texto: o mapa de constância, a
  taxa de retomada e os dois padrões (horário e dia da semana).

  Todas partem do MESMO crédito diário do Momentum (`creditOfDay`). Um mapa que
  contasse "dia ativo" de outro jeito pintaria de roxo um dia que o score
  considerou vazio, e a tela discordaria de si mesma.
*/

export const HEATMAP_DAYS = 91

/** Dias seguidos sem movimento que contam como "saiu da rotina". */
export const INTERRUPTION_GAP_DAYS = 2

export const RECOVERY_WINDOW_DAYS = 30

/** Abaixo disso o padrão de horário é ruído, não padrão. */
export const MIN_EVENTS_FOR_PEAK = 12

/** Semanas mínimas de história pra comparar dias da semana. */
export const MIN_WEEKS_FOR_BEST_DAY = 3

export const PEAK_WINDOW_HOURS = 2

export interface HeatCell {
  readonly day: DayKey
  /** 0 a 1, o crédito do dia. */
  readonly credit: number
  /** 0 a 4: o degrau de cor. Zero é dia sem movimento. */
  readonly level: 0 | 1 | 2 | 3 | 4
  readonly future: boolean
}

export interface ConsistencyMap {
  /** Colunas de segunda a domingo, da semana mais antiga pra mais recente. */
  readonly weeks: readonly (readonly HeatCell[])[]
  readonly activeDays: number
  readonly totalDays: number
  /** 0 a 1. */
  readonly presence: number
}

export function levelOf(credit: number): HeatCell['level'] {
  if (credit <= 0) return 0
  if (credit < 0.3) return 1
  if (credit < 0.6) return 2
  if (credit < 0.85) return 3
  return 4
}

export function consistencyMap(input: MomentumInput, days = HEATMAP_DAYS): ConsistencyMap {
  const start = startOfWeek(addDays(input.today, -(days - 1)))
  const end = addDays(startOfWeek(input.today), 6)

  const cells = dayRange(start, end).map<HeatCell>((day) => {
    const future = day > input.today
    const credit = future ? 0 : creditOfDay(input, day)
    return { day, credit, level: levelOf(credit), future }
  })

  const weeks: HeatCell[][] = []
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7))

  const counted = cells.filter((cell) => !cell.future && cell.day >= addDays(input.today, -(days - 1)))
  const activeDays = counted.filter((cell) => cell.credit > 0).length

  return {
    weeks,
    activeDays,
    totalDays: counted.length,
    presence: counted.length === 0 ? 0 : activeDays / counted.length,
  }
}

export interface WeekDay {
  readonly day: DayKey
  readonly label: string
  readonly done: boolean
  readonly isToday: boolean
  readonly future: boolean
}

export interface CurrentWeek {
  readonly days: readonly WeekDay[]
  readonly consistent: number
  /** Dias da semana que já passaram ou são hoje. */
  readonly elapsed: number
}

const WEEKDAY_SHORT = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'] as const

export function currentWeek(input: MomentumInput): CurrentWeek {
  const first = startOfWeek(input.today)
  const days = WEEKDAY_SHORT.map<WeekDay>((label, index) => {
    const day = addDays(first, index)
    const future = day > input.today
    return {
      day,
      label,
      future,
      isToday: day === input.today,
      done: !future && creditOfDay(input, day) > 0,
    }
  })

  return {
    days,
    consistent: days.filter((day) => day.done).length,
    elapsed: days.filter((day) => !day.future).length,
  }
}

export interface RecoveryRate {
  readonly interruptions: number
  readonly comebacks: number
  /** 0 a 1. Null quando não houve interrupção: não existe taxa sem queda. */
  readonly rate: number | null
}

/**
 * Quantas vezes a pessoa saiu da rotina e quantas voltou.
 *
 * Saída é uma sequência de pelo menos dois dias sem movimento depois de um dia
 * com movimento. Volta é o primeiro dia com movimento depois dela. Uma pausa
 * que ainda não acabou conta como saída sem volta, e é por isso que a taxa pode
 * cair hoje e subir amanhã.
 */
export function recoveryRate(
  input: MomentumInput,
  windowDays = RECOVERY_WINDOW_DAYS,
): RecoveryRate {
  const start = addDays(input.today, -(windowDays - 1))
  const active = dayRange(start, input.today).map((day) => creditOfDay(input, day) > 0)

  let interruptions = 0
  let comebacks = 0
  let seenActive = false
  let gap = 0

  for (const isActive of active) {
    if (isActive) {
      if (seenActive && gap >= INTERRUPTION_GAP_DAYS) {
        interruptions += 1
        comebacks += 1
      }
      seenActive = true
      gap = 0
    } else if (seenActive) {
      gap += 1
    }
  }

  if (seenActive && gap >= INTERRUPTION_GAP_DAYS) interruptions += 1

  return {
    interruptions,
    comebacks,
    rate: interruptions === 0 ? null : comebacks / interruptions,
  }
}

export interface PeakWindow {
  /** Hora de início, 0 a 23. */
  readonly startHour: number
  readonly endHour: number
  /** Quanto a janela rende acima da média das outras horas, em fração (0.38 = 38%). */
  readonly lift: number
  readonly events: number
}

/** Os horários de conclusão dos últimos 28 dias: ação, hábito e atividade. */
function completionHours(input: MomentumInput, lookbackDays: number): number[] {
  const since = addDays(input.today, -(lookbackDays - 1))
  const hours: number[] = []

  for (const task of input.tasks) {
    if (task.status !== 'feita' || !task.completedAt) continue
    if (task.day < since || task.day > input.today) continue
    hours.push(task.completedAt.getHours())
  }

  for (const log of input.habitLogs) {
    if (!countsAsDone(log.status) || log.day < since || log.day > input.today) continue
    hours.push(log.createdAt.getHours())
  }

  for (const activity of input.activities) {
    if (activity.day < since || activity.day > input.today) continue
    hours.push(activity.occurredAt.getHours())
  }

  return hours
}

export function peakWindow(input: MomentumInput, lookbackDays = 28): PeakWindow | null {
  const hours = completionHours(input, lookbackDays)
  if (hours.length < MIN_EVENTS_FOR_PEAK) return null

  const perHour = Array.from({ length: 24 }, () => 0)
  for (const hour of hours) perHour[hour] = (perHour[hour] ?? 0) + 1

  const usedHours = perHour.filter((count) => count > 0).length
  if (usedHours <= PEAK_WINDOW_HOURS) return null

  let best = { start: 0, count: -1 }
  for (let start = 5; start <= 23 - PEAK_WINDOW_HOURS + 1; start += 1) {
    const count = perHour.slice(start, start + PEAK_WINDOW_HOURS).reduce((sum, value) => sum + value, 0)
    if (count > best.count) best = { start, count }
  }

  const outside = hours.length - best.count
  const outsideHours = Math.max(1, usedHours - PEAK_WINDOW_HOURS)
  const inside = best.count / PEAK_WINDOW_HOURS
  const elsewhere = outside / outsideHours
  if (elsewhere <= 0) return null

  const lift = inside / elsewhere - 1
  if (lift < 0.15) return null

  return {
    startHour: best.start,
    endHour: best.start + PEAK_WINDOW_HOURS,
    lift,
    events: best.count,
  }
}

export const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const

export interface BestWeekday {
  /** 0 = domingo, como `Date.getDay()`. */
  readonly weekday: number
  readonly name: string
  /** Média do crédito nesse dia da semana, 0 a 1. */
  readonly average: number
  /** Quanto acima da média dos outros dias, em fração. */
  readonly lift: number
}

export function bestWeekday(input: MomentumInput, weeks = 8): BestWeekday | null {
  const start = addDays(input.today, -(weeks * 7 - 1))
  const totals = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }))
  let activeWeeks = new Set<DayKey>()

  for (const day of dayRange(start, input.today)) {
    const credit = creditOfDay(input, day)
    const slot = totals[dayKeyToDate(day).getDay()]
    if (!slot) continue
    slot.sum += credit
    slot.count += 1
    if (credit > 0) activeWeeks = activeWeeks.add(startOfWeek(day))
  }

  if (activeWeeks.size < MIN_WEEKS_FOR_BEST_DAY) return null

  const averages = totals.map((slot) => (slot.count === 0 ? 0 : slot.sum / slot.count))
  let weekday = 0
  for (let index = 1; index < 7; index += 1) {
    if ((averages[index] ?? 0) > (averages[weekday] ?? 0)) weekday = index
  }

  const average = averages[weekday] ?? 0
  const others = averages.filter((_, index) => index !== weekday)
  const othersAverage = others.reduce((sum, value) => sum + value, 0) / others.length
  if (average <= 0 || othersAverage <= 0) return null

  const lift = average / othersAverage - 1
  if (lift < 0.1) return null

  return { weekday, name: WEEKDAY_NAMES[weekday] ?? '', average, lift }
}

export interface Comeback {
  /** Dias seguidos sem movimento antes de hoje. */
  readonly daysAway: number
}

/** Até onde olhar pra trás atrás do último dia com movimento. */
const COMEBACK_LOOKBACK_DAYS = 60

/**
 * Hoje é dia de volta: há movimento hoje, os dois dias anteriores (ou mais)
 * ficaram vazios e existia ritmo antes disso. É a mesma régua do XP de
 * retomada, pra tela e recompensa contarem a mesma história.
 */
export function comebackToday(input: MomentumInput): Comeback | null {
  if (creditOfDay(input, input.today) <= 0) return null

  let daysAway = 0
  for (let offset = 1; offset <= COMEBACK_LOOKBACK_DAYS; offset += 1) {
    if (creditOfDay(input, addDays(input.today, -offset)) > 0) {
      return daysAway >= INTERRUPTION_GAP_DAYS ? { daysAway } : null
    }
    daysAway += 1
  }

  /* Nunca houve movimento antes: é o primeiro dia, não uma volta. */
  return null
}
