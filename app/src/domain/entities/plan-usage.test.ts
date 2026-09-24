import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import { addDays, parseDayKey } from './day'
import { createHabit, type Habit } from './habit'
import { createObjective, type Objective } from './objective'
import { PLAN_LIMITS, planMatrix } from './plan'
import { createPlanStage, type PlanStage } from './plan-stage'
import {
  actionsLimit,
  assertWithinLimit,
  habitLimit,
  objectiveLimit,
  PlanLimitError,
  planLimit,
  planUsageOf,
  withinHistory,
} from './plan-usage'
import { createTask, type Task } from './task'

const TODAY = parseDayKey('2026-07-01')
const FREE = PLAN_LIMITS.free
const PRO = PLAN_LIMITS.pro

function objective(id: string, patch: Partial<Objective> = {}): Objective {
  return {
    ...createObjective(
      {
        userId: 'u1',
        title: `Objetivo ${id}`,
        axis: 'leitura',
        target: 100,
        startedOn: TODAY,
        deadline: addDays(TODAY, 30),
      },
      id,
    ),
    ...patch,
  }
}

function stage(id: string, objectiveId: string): PlanStage {
  return createPlanStage({ userId: 'u1', objectiveId, title: `Etapa ${id}` }, id)
}

function habit(id: string, patch: Partial<Habit> = {}): Habit {
  return {
    ...createHabit(
      { userId: 'u1', name: `Hábito ${id}`, icon: 'livro', axis: 'leitura', dayPart: 'manha', target: 10 },
      id,
    ),
    ...patch,
  }
}

function task(id: string, day = TODAY, patch: Partial<Task> = {}): Task {
  return { ...createTask({ userId: 'u1', title: `Ação ${id}`, day }, id), ...patch }
}

describe('objectiveLimit', () => {
  it('conta só objetivo em andamento: pausado, concluído e arquivado liberam a vaga', () => {
    const objectives = [
      objective('a'),
      objective('b', { pausedAt: new Date() }),
      objective('c', { completedAt: new Date() }),
      objective('d', { archivedAt: new Date() }),
    ]
    expect(objectiveLimit(FREE, objectives)).toMatchObject({ used: 1, reached: false, message: null })
  })

  it('fecha no segundo objetivo ativo do gratuito e nunca no PRO', () => {
    const objectives = [objective('a'), objective('b')]
    expect(objectiveLimit(FREE, objectives).reached).toBe(true)
    expect(objectiveLimit(FREE, objectives).message).toContain('2 objetivos ativos')
    expect(objectiveLimit(PRO, objectives).reached).toBe(false)
  })
})

describe('planLimit', () => {
  it('um plano é um objetivo em andamento com etapa', () => {
    const objectives = [objective('a'), objective('b')]
    expect(planLimit(FREE, objectives, []).used).toBe(0)
    expect(planLimit(FREE, objectives, [stage('s1', 'a'), stage('s2', 'a')]).used).toBe(1)
    expect(planLimit(FREE, objectives, [stage('s1', 'a')]).reached).toBe(true)
  })

  it('o plano de um objetivo concluído não ocupa a vaga', () => {
    const objectives = [objective('a', { completedAt: new Date() }), objective('b')]
    expect(planLimit(FREE, objectives, [stage('s1', 'a')]).reached).toBe(false)
  })
})

describe('habitLimit', () => {
  it('hábito pausado ou arquivado não conta', () => {
    const habits = [
      habit('h1'),
      habit('h2'),
      habit('h3'),
      habit('h4'),
      habit('h5', { pausedAt: new Date() }),
      habit('h6', { archivedAt: new Date() }),
    ]
    expect(habitLimit(FREE, habits)).toMatchObject({ used: 4, reached: false })
    expect(habitLimit(FREE, [...habits, habit('h7')]).reached).toBe(true)
  })
})

describe('actionsLimit', () => {
  it('conta as ações do dia pedido, inclusive as concluídas, e ignora canceladas', () => {
    const tasks = [
      task('t1'),
      task('t2', TODAY, { status: 'feita' }),
      task('t3', TODAY, { status: 'cancelada' }),
      task('t4', addDays(TODAY, 1)),
    ]
    expect(actionsLimit(FREE, tasks, TODAY).used).toBe(2)
    expect(actionsLimit(FREE, tasks, addDays(TODAY, 1)).used).toBe(1)
  })

  it('fecha na quinta ação do mesmo dia no gratuito', () => {
    const tasks = ['t1', 't2', 't3', 't4', 't5'].map((id) => task(id))
    const check = actionsLimit(FREE, tasks, TODAY)
    expect(check.reached).toBe(true)
    expect(check.message).toContain('5 ações num mesmo dia')
    expect(actionsLimit(PRO, tasks, TODAY).reached).toBe(false)
  })
})

describe('assertWithinLimit', () => {
  it('lança um erro de domínio com o recurso e a frase quando o limite fechou', () => {
    const tasks = ['t1', 't2', 't3', 't4', 't5'].map((id) => task(id))
    const check = actionsLimit(FREE, tasks, TODAY)

    expect(() => assertWithinLimit('Ações no dia', check)).toThrow(PlanLimitError)
    expect(() => assertWithinLimit('Ações no dia', check)).toThrow(DomainError)
    try {
      assertWithinLimit('Ações no dia', check)
    } catch (error) {
      expect(error).toBeInstanceOf(PlanLimitError)
      expect((error as PlanLimitError).feature).toBe('Ações no dia')
    }
  })

  it('deixa passar abaixo do limite', () => {
    expect(() => assertWithinLimit('Ações no dia', actionsLimit(FREE, [], TODAY))).not.toThrow()
  })
})

describe('planUsageOf', () => {
  it('lê o mesmo estado que as telas leem', () => {
    const usage = planUsageOf(FREE, {
      objectives: [objective('a')],
      planStages: [stage('s1', 'a')],
      habits: [habit('h1')],
      tasks: [task('t1')],
    })
    expect(usage.objectives.used).toBe(1)
    expect(usage.plans.reached).toBe(true)
    expect(usage.habits.used).toBe(1)
    expect(usage.actionsOn(TODAY).used).toBe(1)
    expect(usage.actionsOn(addDays(TODAY, 1)).used).toBe(0)
  })
})

describe('withinHistory', () => {
  const items = [0, 5, 14, 15, 40].map((daysAgo) => ({ day: addDays(TODAY, -daysAgo), daysAgo }))

  it('no gratuito passa só o que cabe nos últimos dias do plano, contando hoje', () => {
    const kept = withinHistory(items, FREE, TODAY, (item) => item.day)
    expect(kept.map((item) => item.daysAgo)).toEqual([0, 5, 14])
  })

  it('no PRO passa tudo', () => {
    expect(withinHistory(items, PRO, TODAY, (item) => item.day)).toHaveLength(items.length)
  })
})

describe('planMatrix', () => {
  it('escreve os números do domínio, não cópias', () => {
    const rows = planMatrix()
    const byFeature = new Map(rows.map((row) => [row.feature, row]))

    expect(byFeature.get('Objetivos ativos')?.free).toBe(`Até ${FREE.activeObjectives} objetivos`)
    expect(byFeature.get('Hábitos ativos')?.free).toBe(`Até ${FREE.activeHabits} hábitos`)
    expect(byFeature.get('Ações no Hoje')?.free).toBe(`Até ${FREE.actionsPerDay} por dia`)
    expect(byFeature.get('Histórico')?.free).toBe(`Últimos ${FREE.historyDays} dias`)
    expect(byFeature.get('Momentumm AI')?.free).toBe('Não disponível')
    expect(byFeature.get('Duplas no Juntos')?.free).toBe('Até 1 dupla')
    expect(byFeature.get('Juntos (a dupla)')?.free).toBe(`Hoje e os últimos ${FREE.pairDays} dias`)
    expect(byFeature.get('Incentivos no Juntos')?.free).toBe(
      `${FREE.pairEncouragementsPerDay} por dia`,
    )
  })

  it('cobre a matriz inteira, sem linha vazia', () => {
    const rows = planMatrix()
    expect(rows).toHaveLength(22)
    for (const row of rows) {
      expect(row.free.length).toBeGreaterThan(0)
      expect(row.pro.length).toBeGreaterThan(0)
    }
  })
})
