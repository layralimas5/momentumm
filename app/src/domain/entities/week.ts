import { totalMinutes } from './activity'
import { addDays, type DayKey } from './day'
import { countsAsDone } from './habit'
import { dailySeries, MOMENTUM_WINDOW_DAYS, type DayDot, type MomentumInput } from './momentum'

/**
 * Progresso semanal. O objetivo é entendimento imediato, então tudo aqui existe
 * pra virar UM gráfico simples e UMA conclusão escrita. Comparação com a semana
 * anterior entra porque "12 hábitos" sozinho não diz se está melhor ou pior.
 */

export interface WeekTotals {
  readonly habitsDone: number
  readonly tasksDone: number
  readonly focusMinutes: number
  readonly activeDays: number
}

export interface WeeklySummary {
  readonly series: readonly DayDot[]
  readonly current: WeekTotals
  readonly previous: WeekTotals
  /** A leitura em uma frase: o que os sete dias mostram. */
  readonly conclusion: string
}

export function summarizeWeek(input: MomentumInput): WeeklySummary {
  const series = dailySeries(input, input.today)
  const current = totalsFor(input, input.today)
  const previous = totalsFor(input, addDays(input.today, -MOMENTUM_WINDOW_DAYS))

  return { series, current, previous, conclusion: concludeWeek(input, current, previous) }
}

function totalsFor(input: MomentumInput, end: DayKey): WeekTotals {
  const start = addDays(end, -(MOMENTUM_WINDOW_DAYS - 1))
  const within = (day: DayKey) => day >= start && day <= end

  const activities = input.activities.filter((activity) => within(activity.day))

  return {
    habitsDone: input.habitLogs.filter((log) => within(log.day) && countsAsDone(log.status)).length,
    tasksDone: input.tasks.filter((task) => within(task.day) && task.status === 'feita').length,
    focusMinutes: totalMinutes(activities),
    activeDays: new Set(activities.map((activity) => activity.day)).size,
  }
}

/** Hora a partir da qual um registro conta como "fim do dia". */
const EVENING_HOUR = 18
const MORNING_END_HOUR = 12

/**
 * A conclusão escrita. Ela olha o padrão do horário porque é o dado que a
 * pessoa não enxerga sozinha — e que muda o planejamento da semana seguinte.
 */
function concludeWeek(input: MomentumInput, current: WeekTotals, previous: WeekTotals): string {
  if (current.activeDays === 0) {
    return 'A semana ainda não tem registro. O gráfico começa a contar história no primeiro movimento.'
  }

  const start = addDays(input.today, -(MOMENTUM_WINDOW_DAYS - 1))
  const week = input.activities.filter(
    (activity) => activity.day >= start && activity.day <= input.today,
  )

  const morning = week.filter((activity) => activity.occurredAt.getHours() < MORNING_END_HOUR).length
  const evening = week.filter(
    (activity) => activity.occurredAt.getHours() >= EVENING_HOUR,
  ).length

  const postponedLate = input.tasks.filter(
    (task) => task.day >= start && task.day <= input.today && task.status === 'adiada',
  ).length

  const parts: string[] = []

  if (morning > evening * 2 && morning > 0) {
    parts.push('Você teve mais constância pela manhã')
  } else if (evening > morning * 2 && evening > 0) {
    parts.push('Teus registros se concentram no fim do dia')
  } else {
    parts.push(`Você se moveu em ${current.activeDays} dos ${MOMENTUM_WINDOW_DAYS} dias`)
  }

  if (postponedLate > 0) {
    parts.push(
      `${postponedLate} ${postponedLate === 1 ? 'ação foi adiada' : 'ações foram adiadas'} nessa semana`,
    )
  } else if (current.habitsDone > previous.habitsDone) {
    parts.push(`os hábitos subiram de ${previous.habitsDone} pra ${current.habitsDone}`)
  } else if (current.habitsDone < previous.habitsDone) {
    parts.push(`os hábitos caíram de ${previous.habitsDone} pra ${current.habitsDone}`)
  } else {
    parts.push('o volume ficou parecido com o da semana anterior')
  }

  return `${parts.join(' e ')}.`
}

export function deltaLabel(current: number, previous: number, unit: string): string {
  const delta = current - previous
  if (delta === 0) return `igual à semana anterior`
  const direction = delta > 0 ? '+' : '−'
  return `${direction}${Math.abs(delta)} ${unit} vs. semana anterior`
}
