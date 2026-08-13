import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import { createActivity, type Activity } from './activity'
import { parseDayKey } from './day'
import { createGoal, describeGoal, periodBounds, progressOf } from './goal'

// 2026-08-13 é uma quinta-feira. A semana começa na segunda, 2026-08-10.
const TODAY = parseDayKey('2026-08-13')

function activityOn(day: string, value: number): Activity {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number]
  return createActivity(
    { userId: 'u1', type: 'leitura', value, occurredAt: new Date(year, month - 1, date, 9) },
    `id-${day}`,
  )
}

describe('createGoal', () => {
  it('recusa meta zerada', () => {
    expect(() => createGoal({ userId: 'u1', type: 'leitura', target: 0, period: 'dia' }, 'g1')).toThrow(
      DomainError,
    )
  })

  it('descreve a meta em português', () => {
    const goal = createGoal({ userId: 'u1', type: 'leitura', target: 20, period: 'dia' }, 'g1')
    expect(describeGoal(goal)).toBe('20 páginas por dia')
  })
})

describe('periodBounds', () => {
  it('semana começa na segunda e termina no domingo', () => {
    expect(periodBounds('semana', TODAY)).toEqual(['2026-08-10', '2026-08-16'])
  })

  it('mês vai do dia 1 ao último dia', () => {
    expect(periodBounds('mes', TODAY)).toEqual(['2026-08-01', '2026-08-31'])
  })

  it('dia é ele mesmo', () => {
    expect(periodBounds('dia', TODAY)).toEqual([TODAY, TODAY])
  })
})

describe('progressOf', () => {
  it('soma só o que está dentro do período', () => {
    const goal = createGoal({ userId: 'u1', type: 'leitura', target: 100, period: 'semana' }, 'g1')
    const progress = progressOf(
      goal,
      [
        activityOn('2026-08-09', 50), // domingo anterior, fora
        activityOn('2026-08-11', 30),
        activityOn('2026-08-13', 20),
      ],
      TODAY,
    )
    expect(progress.done).toBe(50)
    expect(progress.remaining).toBe(50)
    expect(progress.achieved).toBe(false)
  })

  it('marca como atingida e trava a razão em 1', () => {
    const goal = createGoal({ userId: 'u1', type: 'leitura', target: 20, period: 'dia' }, 'g1')
    const progress = progressOf(goal, [activityOn('2026-08-13', 60)], TODAY)
    expect(progress.achieved).toBe(true)
    expect(progress.ratio).toBe(1)
    expect(progress.remaining).toBe(0)
  })

  it('ignora atividade de outro eixo', () => {
    const goal = createGoal({ userId: 'u1', type: 'treino', target: 60, period: 'semana' }, 'g1')
    const progress = progressOf(goal, [activityOn('2026-08-13', 40)], TODAY)
    expect(progress.done).toBe(0)
  })

  it('calcula dias restantes até o fim do período', () => {
    const goal = createGoal({ userId: 'u1', type: 'leitura', target: 10, period: 'semana' }, 'g1')
    expect(progressOf(goal, [], TODAY).daysLeft).toBe(3)
  })
})
