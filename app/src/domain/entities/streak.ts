import type { Activity } from './activity'
import type { ActivityTypeSlug } from './activity-type'
import { addDays, daysBetween, type DayKey } from './day'

/**
 * Streak: dias consecutivos com pelo menos uma atividade.
 *
 * Regra deliberada: o dia de HOJE ainda não conta como quebra. Quem abre o app
 * de manhã sem ter registrado nada não pode ver a sequência zerada, senão o
 * app pune a pessoa por acordar cedo.
 */
export interface Streak {
  readonly current: number
  readonly record: number
  readonly lastDay: DayKey | null
  /** Verdadeiro quando a sequência depende de um registro ainda hoje. */
  readonly atRisk: boolean
}

export const EMPTY_STREAK: Streak = {
  current: 0,
  record: 0,
  lastDay: null,
  atRisk: false,
}

export function calculateStreak(
  activities: readonly Activity[],
  today: DayKey,
  type?: ActivityTypeSlug,
): Streak {
  const days = uniqueDaysDesc(activities, type)
  if (days.length === 0) return EMPTY_STREAK

  const lastDay = days[0] as DayKey
  const gapFromToday = daysBetween(lastDay, today)

  // Registro futuro (fuso desalinhado) não deve derrubar a sequência.
  const isLive = gapFromToday <= 1
  const current = isLive ? countConsecutiveFrom(days, 0) : 0

  return {
    current,
    record: Math.max(longestRun(days), current),
    lastDay,
    atRisk: current > 0 && gapFromToday === 1,
  }
}

function uniqueDaysDesc(
  activities: readonly Activity[],
  type: ActivityTypeSlug | undefined,
): DayKey[] {
  const days = new Set<DayKey>()
  for (const activity of activities) {
    if (type && activity.type !== type) continue
    days.add(activity.day)
  }
  return [...days].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
}

/** `days` em ordem decrescente; conta a corrida que começa em `startIndex`. */
function countConsecutiveFrom(days: readonly DayKey[], startIndex: number): number {
  let run = 1
  for (let index = startIndex + 1; index < days.length; index += 1) {
    const previous = days[index - 1] as DayKey
    const currentDay = days[index] as DayKey
    if (daysBetween(currentDay, previous) !== 1) break
    run += 1
  }
  return run
}

function longestRun(days: readonly DayKey[]): number {
  let longest = 0
  let index = 0
  while (index < days.length) {
    const run = countConsecutiveFrom(days, index)
    longest = Math.max(longest, run)
    index += run
  }
  return longest
}

/** Dias que o usuário precisa manter pra bater o próprio recorde. */
export function daysToRecord(streak: Streak): number {
  return Math.max(0, streak.record - streak.current + 1)
}

export function nextDayToKeep(streak: Streak, today: DayKey): DayKey {
  return streak.lastDay ? addDays(streak.lastDay, 1) : today
}
