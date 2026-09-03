import { describe, expect, it } from 'vitest'
import { createActivity, type Activity } from './activity'
import { CAPACITY_PROFILES } from './checkin'
import { addDays, dayKeyToDate, parseDayKey, type DayKey } from './day'
import { createHabit, type Habit, type HabitLog } from './habit'
import { calculateMomentum, dailySeries, recommendationFor, type MomentumInput } from './momentum'
import { createTask, type Task } from './task'

const TODAY = parseDayKey('2026-09-03')

function activityOn(day: DayKey, value = 30, hour = 9): Activity {
  const base = dayKeyToDate(day)
  return createActivity(
    {
      userId: 'u1',
      type: 'estudo',
      value,
      occurredAt: new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour),
    },
    `a-${day}-${hour}`,
  )
}

const HABIT: Habit = createHabit(
  { userId: 'u1', name: 'Estudar', icon: 'cerebro', axis: 'estudo', dayPart: 'manha', target: 30 },
  'h1',
  new Date(2026, 0, 1),
)

function habitLog(day: DayKey): HabitLog {
  return { id: `l-${day}`, userId: 'u1', habitId: 'h1', day, status: 'feito', createdAt: new Date() }
}

function taskOn(day: DayKey, status: Task['status'], id: string): Task {
  return { ...createTask({ userId: 'u1', title: 'Estudar', day }, id), status }
}

function input(overrides: Partial<MomentumInput> = {}): MomentumInput {
  return {
    activities: [],
    habits: [],
    habitLogs: [],
    tasks: [],
    today: TODAY,
    ...overrides,
  }
}

describe('calculateMomentum', () => {
  it('sem nenhum dado o ritmo é zero e desacelerando', () => {
    const score = calculateMomentum(input())
    expect(score.value).toBe(0)
    expect(score.level).toBe('desacelerando')
    expect(score.explanation).toContain('registro suficiente')
  })

  it('constância diária vale mais que volume concentrado', () => {
    const spread = calculateMomentum(
      input({
        activities: Array.from({ length: 7 }, (_, index) => activityOn(addDays(TODAY, -index), 10)),
      }),
    )
    const single = calculateMomentum(input({ activities: [activityOn(TODAY, 400)] }))

    expect(spread.value).toBeGreaterThan(single.value)
    expect(spread.activeDays).toBe(7)
  })

  it('reconhece quem está retomando depois de uma semana parada', () => {
    // Nada na janela anterior, movimento nos últimos dias.
    const score = calculateMomentum(
      input({
        activities: [-3, -2, -1, 0].map((offset) => activityOn(addDays(TODAY, offset), 20)),
      }),
    )
    expect(score.delta).toBeGreaterThan(0)
    expect(['retomando', 'constante', 'avancando']).toContain(score.level)
  })

  it('hábito cumprido entra na conta', () => {
    const withHabits = calculateMomentum(
      input({
        activities: [activityOn(TODAY)],
        habits: [HABIT],
        habitLogs: [-2, -1, 0].map((offset) => habitLog(addDays(TODAY, offset))),
      }),
    )
    const withoutHabits = calculateMomentum(
      input({ activities: [activityOn(TODAY)], habits: [HABIT] }),
    )

    expect(withHabits.value).toBeGreaterThan(withoutHabits.value)
  })

  it('ação concluída pesa mais que ação planejada e abandonada', () => {
    const done = calculateMomentum(
      input({ activities: [activityOn(TODAY)], tasks: [taskOn(TODAY, 'feita', 't1')] }),
    )
    const pending = calculateMomentum(
      input({ activities: [activityOn(TODAY)], tasks: [taskOn(TODAY, 'pendente', 't1')] }),
    )

    expect(done.value).toBeGreaterThan(pending.value)
  })

  it('a pontuação nunca passa de 100', () => {
    const score = calculateMomentum(
      input({
        activities: Array.from({ length: 7 }, (_, index) =>
          activityOn(addDays(TODAY, -index), 600),
        ),
        habits: [HABIT],
        habitLogs: Array.from({ length: 7 }, (_, index) => habitLog(addDays(TODAY, -index))),
        tasks: Array.from({ length: 7 }, (_, index) =>
          taskOn(addDays(TODAY, -index), 'feita', `t${index}`),
        ),
      }),
    )
    expect(score.value).toBeLessThanOrEqual(100)
    expect(score.level).toBe('avancando')
  })
})

describe('recommendationFor', () => {
  it('em dia de baixa energia sugere a versão mínima, nunca compensar', () => {
    const score = calculateMomentum(input({ activities: [activityOn(TODAY)] }))
    const text = recommendationFor(score, CAPACITY_PROFILES.minima)
    expect(text.toLowerCase()).toContain('mínima')
  })

  it('em dia cheio não empurra mais tarefa, empurra a meta parada', () => {
    const score = calculateMomentum(
      input({
        activities: Array.from({ length: 7 }, (_, index) => activityOn(addDays(TODAY, -index), 90)),
      }),
    )
    expect(recommendationFor(score, CAPACITY_PROFILES.plena)).toContain('meta mais parada')
  })
})

describe('dailySeries', () => {
  it('devolve exatamente sete dias terminando hoje', () => {
    const series = dailySeries(input({ activities: [activityOn(TODAY)] }))
    expect(series).toHaveLength(7)
    expect(series[6]?.day).toBe(TODAY)
    expect(series[0]?.day).toBe(addDays(TODAY, -6))
  })

  it('intensidade fica entre zero e um', () => {
    const series = dailySeries(input({ activities: [activityOn(TODAY, 600)] }))
    for (const day of series) {
      expect(day.intensity).toBeGreaterThanOrEqual(0)
      expect(day.intensity).toBeLessThanOrEqual(1)
    }
  })
})
