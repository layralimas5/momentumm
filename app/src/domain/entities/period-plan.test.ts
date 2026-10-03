import { describe, expect, it } from 'vitest'
import { parseDayKey, type DayKey } from './day'
import { buildPeriodPlan, endOfMonth, periodRanges } from './period-plan'
import { createPlanStage, type PlanStage } from './plan-stage'
import { createTask, type Task } from './task'

// Sábado, 3 de outubro de 2026.
const TODAY = parseDayKey('2026-10-03')

function stage(id: string, order: number, dueOn: string | null, status: PlanStage['status'] = 'nao-iniciada'): PlanStage {
  return {
    ...createPlanStage(
      { userId: 'u1', objectiveId: 'o1', title: `Etapa ${id}`, order, weight: 50, dueOn: dueOn ? parseDayKey(dueOn) : null },
      id,
    ),
    status,
  }
}

function task(id: string, day: string, status: Task['status'] = 'pendente'): Task {
  return { ...createTask({ userId: 'u1', title: `Ação ${id}`, day: parseDayKey(day) as DayKey, objectiveId: 'o1' }, id), status }
}

describe('endOfMonth', () => {
  it('handles months of different lengths', () => {
    expect(endOfMonth(parseDayKey('2026-02-10'))).toBe('2026-02-28')
    expect(endOfMonth(parseDayKey('2026-10-03'))).toBe('2026-10-31')
  })
})

describe('periodRanges', () => {
  it('splits into this week, rest of month and following months until the deadline', () => {
    const ranges = periodRanges(TODAY, parseDayKey('2026-12-15'))

    expect(ranges.map((range) => range.label)).toEqual(['Esta semana', 'Resto de outubro', 'Novembro', 'Dezembro'])
    expect(ranges[0]).toMatchObject({ start: '2026-10-03', end: '2026-10-04' })
    expect(ranges[3]?.end).toBe('2026-12-15')
  })

  it('groups what is beyond the month limit into one last period', () => {
    const ranges = periodRanges(TODAY, parseDayKey('2028-01-31'), 2)
    expect(ranges.map((range) => range.kind)).toEqual(['semana', 'mes', 'mes', 'restante'])
    expect(ranges[3]?.end).toBe('2028-01-31')
  })

  it('names months of another year with the year', () => {
    const ranges = periodRanges(TODAY, parseDayKey('2027-01-20'))
    expect(ranges[ranges.length - 1]?.label).toBe('Janeiro 2027')
  })

  it('collapses to this week when the deadline already passed', () => {
    const ranges = periodRanges(TODAY, parseDayKey('2026-09-01'))
    expect(ranges).toHaveLength(1)
    expect(ranges[0]?.end).toBe(TODAY)
  })
})

describe('buildPeriodPlan', () => {
  const deadline = parseDayKey('2026-12-31')

  it('places milestones and tasks in the period of their dates', () => {
    const plan = buildPeriodPlan({
      today: TODAY,
      deadline,
      stages: [stage('a', 0, '2026-10-20'), stage('b', 1, '2026-11-30')],
      openTasks: [task('t1', '2026-10-04'), task('t2', '2026-11-10')],
      dailyPace: null,
    })

    expect(plan[0]?.tasks.map((item) => item.id)).toEqual(['t1'])
    expect(plan[1]?.milestones.map((item) => item.stage.id)).toEqual(['a'])
    expect(plan[2]?.milestones.map((item) => item.stage.id)).toEqual(['b'])
    expect(plan[2]?.tasks.map((item) => item.id)).toEqual(['t2'])
    expect(plan[2]?.focusStage?.id).toBe('b')
  })

  it('brings late milestones and overdue tasks to this week', () => {
    const plan = buildPeriodPlan({
      today: TODAY,
      deadline,
      stages: [stage('a', 0, '2026-09-20')],
      openTasks: [task('t1', '2026-09-28')],
      dailyPace: null,
    })

    expect(plan[0]?.milestones[0]).toMatchObject({ late: true })
    expect(plan[0]?.overdue.map((item) => item.id)).toEqual(['t1'])
  })

  it('ignores done stages and finished tasks', () => {
    const plan = buildPeriodPlan({
      today: TODAY,
      deadline,
      stages: [stage('a', 0, '2026-10-20', 'concluida')],
      openTasks: [task('t1', '2026-10-04', 'feita')],
      dailyPace: null,
    })

    expect(plan.every((period) => period.milestones.length === 0 && period.tasks.length === 0)).toBe(true)
    expect(plan.every((period) => !period.gap)).toBe(true)
  })

  it('puts undated stages at the deadline and flags empty periods as gaps', () => {
    const plan = buildPeriodPlan({
      today: TODAY,
      deadline,
      stages: [stage('a', 0, null)],
      openTasks: [],
      dailyPace: null,
    })

    expect(plan[plan.length - 1]?.milestones.map((item) => item.stage.id)).toEqual(['a'])
    expect(plan.every((period) => period.gap)).toBe(true)
  })

  it('splits the remaining volume by period length', () => {
    const plan = buildPeriodPlan({ today: TODAY, deadline, stages: [], openTasks: [], dailyPace: 10 })

    expect(plan[0]?.volume).toBe(20)
    expect(plan[2]?.volume).toBe(300)
    expect(plan.some((period) => period.gap)).toBe(false)
  })
})
