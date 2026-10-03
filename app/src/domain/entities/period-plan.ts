import { addDays, dayKeyToDate, daysBetween, parseDayKey, startOfMonth, startOfWeek, type DayKey } from './day'
import type { PlanStage } from './plan-stage'
import type { Task } from './task'

/*
  O plano de um objetivo destrinchado no tempo: o que precisa sair em cada
  período, da semana atual até o prazo.

  Cada período responde três perguntas, sempre com dado do próprio plano:
  qual etapa está em foco, quais marcos precisam fechar ali dentro e quais
  ações já estão marcadas. Objetivo sem etapas (medido por volume) ganha a
  quarta: quanto precisa somar no período pra fechar no prazo.

  Período sem nada marcado, mas com trabalho pela frente, é um buraco no plano
  e a tela mostra isso, em vez de esconder.
*/

export const MAX_MONTH_PERIODS = 6

export type PlanPeriodKind = 'semana' | 'mes' | 'restante'

export interface PeriodMilestone {
  readonly stage: PlanStage
  /** O prazo da etapa já passou e ela não fechou. */
  readonly late: boolean
}

export interface PlanPeriod {
  readonly key: string
  readonly kind: PlanPeriodKind
  readonly label: string
  readonly start: DayKey
  readonly end: DayKey
  readonly days: number
  /** A etapa que deveria estar andando nesse período. */
  readonly focusStage: PlanStage | null
  readonly milestones: readonly PeriodMilestone[]
  /** Ações abertas com dia dentro do período. */
  readonly tasks: readonly Task[]
  /** Só no primeiro período: ações que ficaram pra trás. */
  readonly overdue: readonly Task[]
  /** Objetivo por volume: quanto precisa somar no período. */
  readonly volume: number | null
  /** Há trabalho pela frente e nada marcado aqui. */
  readonly gap: boolean
}

export interface PeriodPlanInput {
  readonly today: DayKey
  readonly deadline: DayKey
  readonly stages: readonly PlanStage[]
  /** As ações ainda abertas do objetivo. */
  readonly openTasks: readonly Task[]
  /** Quanto falta por dia, quando o objetivo é medido por volume. */
  readonly dailyPace: number | null
}

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

export function endOfMonth(day: DayKey): DayKey {
  const date = dayKeyToDate(startOfMonth(day))
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return addDays(parseDayKey(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`), -1)
}

function monthName(day: DayKey, today: DayKey): string {
  const date = dayKeyToDate(day)
  const name = MONTHS[date.getMonth()] ?? ''
  return date.getFullYear() === dayKeyToDate(today).getFullYear() ? name : `${name} ${date.getFullYear()}`
}

function shortDate(day: DayKey): string {
  return dayKeyToDate(day)
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\./g, '')
}

interface Range {
  readonly kind: PlanPeriodKind
  readonly label: string
  readonly start: DayKey
  readonly end: DayKey
}

/** Os recortes de tempo: esta semana, o resto do mês, os meses seguintes e o que sobra até o prazo. */
export function periodRanges(today: DayKey, deadline: DayKey, maxMonths = MAX_MONTH_PERIODS): Range[] {
  const last = deadline < today ? today : deadline
  const ranges: Range[] = []
  const clamp = (day: DayKey) => (day > last ? last : day)

  const weekEnd = clamp(addDays(startOfWeek(today), 6))
  ranges.push({ kind: 'semana', label: 'Esta semana', start: today, end: weekEnd })

  let cursor = addDays(weekEnd, 1)
  let months = 0

  while (cursor <= last) {
    const monthEnd = clamp(endOfMonth(cursor))

    if (months >= maxMonths) {
      ranges.push({ kind: 'restante', label: `Até o prazo (${shortDate(last)})`, start: cursor, end: last })
      break
    }

    const sameMonthAsToday = startOfMonth(cursor) === startOfMonth(today)
    ranges.push({
      kind: 'mes',
      label: sameMonthAsToday ? `Resto de ${monthName(cursor, today).toLowerCase()}` : monthName(cursor, today),
      start: cursor,
      end: monthEnd,
    })
    months += 1
    cursor = addDays(monthEnd, 1)
  }

  return ranges
}

function inRange(day: DayKey, range: { start: DayKey; end: DayKey }): boolean {
  return day >= range.start && day <= range.end
}

export function buildPeriodPlan(input: PeriodPlanInput): PlanPeriod[] {
  const ranges = periodRanges(input.today, input.deadline)
  const lastIndex = ranges.length - 1

  const openStages = [...input.stages]
    .filter((stage) => stage.status !== 'concluida')
    .sort((a, b) => a.order - b.order)

  /* Etapa sem data vence junto com o objetivo: é o prazo que sobra pra ela. */
  const dueOf = (stage: PlanStage): DayKey => stage.dueOn ?? input.deadline

  const pending = input.openTasks.filter((task) => task.status !== 'feita' && task.status !== 'cancelada')
  const overdue = pending.filter((task) => task.day < input.today)

  return ranges.map((range, index) => {
    const first = index === 0
    const isLast = index === lastIndex

    const milestones: PeriodMilestone[] = openStages
      .filter((stage) => {
        const due = dueOf(stage)
        if (first && due < input.today) return true
        if (isLast && due > range.end) return true
        return inRange(due, range)
      })
      .map((stage) => ({ stage, late: dueOf(stage) < input.today }))

    const tasks = pending.filter((task) => inRange(task.day, range) || (isLast && task.day > range.end))

    const focusStage = openStages.find((stage) => dueOf(stage) >= range.start) ?? openStages[0] ?? null

    const days = daysBetween(range.start, range.end) + 1
    const volume =
      input.dailyPace !== null && input.dailyPace > 0 ? Math.ceil(input.dailyPace * days) : null

    const hasWorkAhead = openStages.length > 0 || volume !== null
    const periodOverdue = first ? overdue : []

    return {
      key: `${range.kind}-${range.start}`,
      kind: range.kind,
      label: range.label,
      start: range.start,
      end: range.end,
      days,
      focusStage,
      milestones,
      tasks,
      overdue: periodOverdue,
      volume,
      gap: hasWorkAhead && tasks.length === 0 && periodOverdue.length === 0 && volume === null,
    }
  })
}
