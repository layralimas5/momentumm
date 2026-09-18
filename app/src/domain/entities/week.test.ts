import { describe, expect, it } from 'vitest'
import { addDays, parseDayKey, type DayKey } from './day'
import { createHabit, type Habit, type HabitLog } from './habit'
import type { MomentumInput } from './momentum'
import { summarizeWeek } from './week'

const TODAY = parseDayKey('2026-09-17')

const HABIT: Habit = createHabit(
  { userId: 'u1', name: 'Ler', icon: 'cerebro', axis: 'estudo', dayPart: 'manha', target: 30 },
  'h1',
  new Date(2026, 0, 1),
)

function habitLog(day: DayKey): HabitLog {
  return { id: `l-${day}`, userId: 'u1', habitId: 'h1', day, status: 'feito', createdAt: new Date() }
}

function input(overrides: Partial<MomentumInput> = {}): MomentumInput {
  return { activities: [], habits: [HABIT], habitLogs: [], tasks: [], today: TODAY, ...overrides }
}

describe('summarizeWeek', () => {
  it('conta como dia ativo o dia em que só um hábito foi cumprido', () => {
    const week = summarizeWeek(
      input({ habitLogs: [-2, -1, 0].map((offset) => habitLog(addDays(TODAY, offset))) }),
    )
    expect(week.current.activeDays).toBe(3)
  })

  it('sem registro nenhum a semana fica zerada', () => {
    expect(summarizeWeek(input()).current.activeDays).toBe(0)
  })
})
