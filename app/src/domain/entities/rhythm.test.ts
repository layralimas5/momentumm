import { describe, expect, it } from 'vitest'
import { addDays, dayKeyToDate, parseDayKey, type DayKey } from './day'
import { createHabit, type Habit, type HabitLog } from './habit'
import type { MomentumInput } from './momentum'
import {
  bestWeekday,
  comebackToday,
  consistencyMap,
  currentWeek,
  levelOf,
  MIN_EVENTS_FOR_PEAK,
  peakWindow,
  recoveryRate,
} from './rhythm'

const TODAY = parseDayKey('2026-09-03')

const HABIT: Habit = createHabit(
  { userId: 'u1', name: 'Estudar', icon: 'cerebro', axis: 'estudo', dayPart: 'manha', target: 30 },
  'h1',
  new Date(2026, 0, 1),
)

function logOn(day: DayKey, hour = 9): HabitLog {
  const base = dayKeyToDate(day)
  return {
    id: `l-${day}-${hour}`,
    userId: 'u1',
    habitId: 'h1',
    day,
    status: 'feito',
    createdAt: new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour),
  }
}

function inputWith(logs: readonly HabitLog[]): MomentumInput {
  return { activities: [], habits: [HABIT], habitLogs: logs, tasks: [], today: TODAY }
}

function daysAgo(...offsets: number[]): DayKey[] {
  return offsets.map((offset) => addDays(TODAY, -offset))
}

describe('levelOf', () => {
  it('maps credit to five color steps', () => {
    expect(levelOf(0)).toBe(0)
    expect(levelOf(0.1)).toBe(1)
    expect(levelOf(0.5)).toBe(2)
    expect(levelOf(0.7)).toBe(3)
    expect(levelOf(1)).toBe(4)
  })
})

describe('consistencyMap', () => {
  it('builds full weeks and counts presence only inside the window', () => {
    const map = consistencyMap(inputWith(daysAgo(0, 1, 2).map((day) => logOn(day))), 14)

    expect(map.weeks.every((week) => week.length === 7)).toBe(true)
    expect(map.totalDays).toBe(14)
    expect(map.activeDays).toBe(3)
    expect(map.presence).toBeCloseTo(3 / 14)
  })

  it('marks days after today as future', () => {
    const map = consistencyMap(inputWith([]), 7)
    const future = map.weeks.flat().filter((cell) => cell.future)
    expect(future.every((cell) => cell.day > TODAY && cell.level === 0)).toBe(true)
  })
})

describe('currentWeek', () => {
  it('starts on monday and only counts elapsed days', () => {
    // 2026-09-03 é quinta.
    const week = currentWeek(inputWith(daysAgo(0, 2).map((day) => logOn(day))))

    expect(week.days[0]?.label).toBe('SEG')
    expect(week.elapsed).toBe(4)
    expect(week.consistent).toBe(2)
    expect(week.days[3]?.isToday).toBe(true)
    expect(week.days[4]?.future).toBe(true)
  })
})

describe('recoveryRate', () => {
  it('has no rate without an interruption', () => {
    const rate = recoveryRate(inputWith(daysAgo(0, 1, 2, 3).map((day) => logOn(day))))
    expect(rate).toEqual({ interruptions: 0, comebacks: 0, rate: null })
  })

  it('counts a gap of two days followed by movement as a comeback', () => {
    const rate = recoveryRate(inputWith(daysAgo(0, 3, 4, 8).map((day) => logOn(day))))
    expect(rate.interruptions).toBe(2)
    expect(rate.comebacks).toBe(2)
    expect(rate.rate).toBe(1)
  })

  it('counts an open pause as an interruption without a comeback', () => {
    const rate = recoveryRate(inputWith(daysAgo(3, 6).map((day) => logOn(day))))
    expect(rate.interruptions).toBe(2)
    expect(rate.comebacks).toBe(1)
    expect(rate.rate).toBe(0.5)
  })

  it('ignores a single day off', () => {
    const rate = recoveryRate(inputWith(daysAgo(0, 2).map((day) => logOn(day))))
    expect(rate.interruptions).toBe(0)
  })
})

describe('peakWindow', () => {
  it('stays quiet with too few events', () => {
    expect(peakWindow(inputWith(daysAgo(0, 1).map((day) => logOn(day, 9))))).toBeNull()
  })

  it('finds the two hours that concentrate completions', () => {
    const morning = daysAgo(...Array.from({ length: MIN_EVENTS_FOR_PEAK }, (_, i) => i)).map((day) =>
      logOn(day, 9),
    )
    const spread = [logOn(addDays(TODAY, -1), 14), logOn(addDays(TODAY, -2), 19), logOn(addDays(TODAY, -3), 21)]

    const peak = peakWindow(inputWith([...morning, ...spread]))

    expect(peak?.startHour).toBeLessThanOrEqual(9)
    expect(peak?.endHour).toBeGreaterThan(9)
    expect(peak?.lift).toBeGreaterThan(1)
  })
})

describe('bestWeekday', () => {
  it('needs a few weeks of history', () => {
    expect(bestWeekday(inputWith([logOn(TODAY)]))).toBeNull()
  })

  it('names the weekday with the highest average credit', () => {
    // Quintas das últimas seis semanas, mais um dia solto.
    const thursdays = daysAgo(0, 7, 14, 21, 28, 35).map((day) => logOn(day))
    const best = bestWeekday(inputWith([...thursdays, logOn(addDays(TODAY, -2))]))

    expect(best?.name).toBe('Quinta-feira')
    expect(best?.lift).toBeGreaterThan(0)
  })
})

describe('comebackToday', () => {
  it('recognizes a return after two or more empty days', () => {
    expect(comebackToday(inputWith(daysAgo(0, 3, 4).map((day) => logOn(day))))).toEqual({ daysAway: 2 })
  })

  it('stays quiet after a single day off', () => {
    expect(comebackToday(inputWith(daysAgo(0, 2).map((day) => logOn(day))))).toBeNull()
  })

  it('stays quiet when there is no movement today', () => {
    expect(comebackToday(inputWith(daysAgo(3).map((day) => logOn(day))))).toBeNull()
  })

  it('does not call the very first day a comeback', () => {
    expect(comebackToday(inputWith([logOn(TODAY)]))).toBeNull()
  })
})
