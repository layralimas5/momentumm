import { describe, expect, it } from 'vitest'
import type { AdaptiveObjective } from './adaptive-day'
import { CAPACITY_PROFILES } from './checkin'
import { addDays, dayKeyToDate, parseDayKey } from './day'
import { createHabit, type Habit, type HabitLog } from './habit'
import { calculateMomentum, type DayDot, type MomentumScore } from './momentum'
import { createObjective, progressOfObjective } from './objective'
import { planProgressOf } from './plan-progress'
import { createPlanStage, type PlanStage } from './plan-stage'
import { createTask, type Task } from './task'
import {
  detectRecovery,
  MAX_RECOVERY_STEPS,
  RECOVERY_MESSAGE,
  recoveryBudgetOf,
  type RecoveryInput,
} from './recovery'

const TODAY = parseDayKey('2026-09-03')

const FLAT: MomentumScore = calculateMomentum({
  activities: [],
  habits: [],
  habitLogs: [],
  tasks: [],
  today: TODAY,
})

/** Um score com a queda que o sinal de momentum procura. */
const FALLING: MomentumScore = { ...FLAT, delta: -12 }

function series(intensities: readonly number[]): DayDot[] {
  return intensities.map((intensity, index) => ({
    day: addDays(TODAY, -(intensities.length - 1 - index)),
    intensity,
    minutes: 0,
    habitsDone: 0,
    tasksDone: 0,
  }))
}

/** Sete dias: seis parados e hoje ainda em aberto. */
const QUIET_WEEK = series([0, 0, 0, 0, 0, 0, 0])

function task(overrides: Partial<Task> = {}, id = 't1'): Task {
  const base = createTask({ userId: 'u1', title: 'Escrever o capítulo', day: TODAY }, id)
  return { ...base, ...overrides }
}

function habit(overrides: Partial<Habit> = {}, id = 'h1'): Habit {
  const base = createHabit(
    { userId: 'u1', name: 'Meditar', icon: 'lotus', axis: 'meditacao', dayPart: 'manha', target: 20 },
    id,
    dayKeyToDate(addDays(TODAY, -60)),
  )
  return { ...base, ...overrides }
}

function objective(id: string, title: string, tasks: readonly Task[] = [], stages: readonly PlanStage[] = []): AdaptiveObjective {
  const entity = createObjective(
    {
      userId: 'u1',
      title,
      axis: 'escrita',
      target: 100,
      startedOn: addDays(TODAY, -30),
      deadline: addDays(TODAY, 30),
    },
    id,
  )

  return {
    progress: progressOfObjective(entity, [], TODAY),
    plan: planProgressOf(entity, stages, tasks, [], TODAY),
  }
}

function input(overrides: Partial<RecoveryInput> = {}): RecoveryInput {
  return {
    today: TODAY,
    series: QUIET_WEEK,
    tasks: [],
    habits: [],
    habitLogs: [],
    momentum: FALLING,
    objectives: [],
    capacity: CAPACITY_PROFILES.moderada,
    ...overrides,
  }
}

/** O caso completo: semana parada, objetivo travado, atrasos e queda no score. */
function fullSlump(): RecoveryInput {
  const overdue: Task[] = [
    task({ day: addDays(TODAY, -4), estimatedMin: 90 }, 'atrasada-1'),
    task({ day: addDays(TODAY, -5), estimatedMin: 60 }, 'atrasada-2'),
    task({ day: addDays(TODAY, -6), estimatedMin: 45 }, 'atrasada-3'),
  ]

  const small = task(
    { estimatedMin: 45, objectiveId: 'obj-1', minimalVersion: 'Escrever um parágrafo' },
    'pequena',
  )

  return input({
    tasks: [...overdue, small],
    objectives: [objective('obj-1', 'Publicar o livro', [...overdue, small])],
  })
}

describe('detectRecovery: quando o modo liga', () => {
  it('exige sinais combinados: um sozinho não liga nada', () => {
    // Só a queda de momentum, sem semana parada nem atraso.
    const state = detectRecovery(
      input({ series: series([1, 1, 1, 1, 1, 1, 0]), momentum: FALLING }),
    )
    expect(state).toBeNull()
  })

  it('liga com semana parada, objetivo travado e atrasos', () => {
    const state = detectRecovery(fullSlump())

    expect(state).not.toBeNull()
    expect(state?.signals.length).toBeGreaterThanOrEqual(2)
    expect(state?.message).toBe(RECOVERY_MESSAGE)
  })

  it('cada sinal carrega o número real que o produziu', () => {
    const state = detectRecovery(fullSlump())

    for (const signal of state?.signals ?? []) {
      expect(signal.detail).toMatch(/\d/)
    }
  })

  it('não aparece pra quem já se moveu hoje', () => {
    const moved = fullSlump()
    const state = detectRecovery({
      ...moved,
      series: series([0, 0, 0, 0, 0, 0, 0.6]),
    })

    expect(state).toBeNull()
  })

  it('não conta hoje como dia fraco: ele ainda está acontecendo', () => {
    // Dois dias fracos antes de hoje não são três: o modo se cala.
    const state = detectRecovery(
      input({
        series: series([1, 1, 1, 1, 0, 0, 0]),
        tasks: [],
        objectives: [],
      }),
    )

    expect(state?.signals.some((signal) => signal.key === 'baixa-execucao')).not.toBe(true)
  })
})

describe('detectRecovery: os passos de volta', () => {
  it('oferece no máximo três', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      task({ estimatedMin: 15, title: `Passo ${index}` }, `p${index}`),
    )
    const state = detectRecovery(input({ tasks: [...many, ...fullSlump().tasks] }))

    expect(state?.steps.length).toBeLessThanOrEqual(MAX_RECOVERY_STEPS)
  })

  it('prefere o menor esforço capaz de gerar avanço real', () => {
    const state = detectRecovery(fullSlump())
    const first = state?.steps[0]

    expect(first).toBeDefined()
    expect(first?.minutes).toBeLessThanOrEqual(30)
  })

  it('usa a versão mínima quando ela existe', () => {
    const state = detectRecovery(fullSlump())
    const step = state?.steps.find((item) => item.id === 'pequena')

    expect(step?.minimal).toBe(true)
    expect(step?.title).toBe('Escrever um parágrafo')
    expect(step?.minutes).toBe(15)
  })

  it('não oferece o dia inteiro de volta como primeiro passo', () => {
    const state = detectRecovery(fullSlump())

    for (const step of state?.steps ?? []) {
      expect(step.minutes).toBeLessThanOrEqual(30)
    }
  })

  it('cada passo diz o que ele destrava', () => {
    const state = detectRecovery(fullSlump())

    for (const step of state?.steps ?? []) {
      expect(step.reason.length).toBeGreaterThan(10)
    }
  })

  it('marca a ação que precisa vir de outro dia', () => {
    const state = detectRecovery(
      input({
        tasks: [
          task({ day: addDays(TODAY, -4), estimatedMin: 20 }, 'a1'),
          task({ day: addDays(TODAY, -5), estimatedMin: 20 }, 'a2'),
          task({ day: addDays(TODAY, -6), estimatedMin: 20 }, 'a3'),
        ],
      }),
    )

    expect(state?.steps.some((step) => step.fromAnotherDay)).toBe(true)
  })

  it('o hábito volta pela versão mínima, sem encerrar sequência', () => {
    const logs: HabitLog[] = [
      { id: 'l1', userId: 'u1', habitId: 'h1', day: addDays(TODAY, -8), status: 'feito', createdAt: new Date() },
    ]

    const state = detectRecovery(
      input({
        habits: [habit({ target: 30, minimalTarget: 5 })],
        habitLogs: logs,
        tasks: fullSlump().tasks,
      }),
    )

    const step = state?.steps.find((item) => item.kind === 'habito')
    expect(step?.minutes).toBe(5)
    expect(step?.minimalTitle).toContain('5')
  })

  it('espalha os passos entre objetivos diferentes', () => {
    const stages: PlanStage[] = [
      createPlanStage({ userId: 'u1', objectiveId: 'obj-a', title: 'Começo', weight: 100 }, 'sa'),
      createPlanStage({ userId: 'u1', objectiveId: 'obj-b', title: 'Começo', weight: 100 }, 'sb'),
    ]

    const a1 = task({ estimatedMin: 15, objectiveId: 'obj-a', stageId: 'sa' }, 'a1')
    const a2 = task({ estimatedMin: 15, objectiveId: 'obj-a', stageId: 'sa' }, 'a2')
    const b1 = task({ estimatedMin: 15, objectiveId: 'obj-b', stageId: 'sb' }, 'b1')
    const atrasos = fullSlump().tasks

    const state = detectRecovery(
      input({
        tasks: [a1, a2, b1, ...atrasos],
        objectives: [
          objective('obj-a', 'Objetivo A', [a1, a2], [stages[0] as PlanStage]),
          objective('obj-b', 'Objetivo B', [b1], [stages[1] as PlanStage]),
        ],
      }),
    )

    const objetivos = (state?.steps ?? []).map((step) => step.objectiveTitle)
    expect(new Set(objetivos).size).toBe(objetivos.length)
  })
})

describe('recoveryBudgetOf', () => {
  it('devolve o passo mais a folga da capacidade, nunca o dia cheio', () => {
    const step = {
      kind: 'acao' as const,
      id: 't',
      title: 'Escrever um parágrafo',
      minutes: 15,
      minimal: true,
      minimalTitle: 'Escrever um parágrafo',
      reason: 'Versão mínima, 15 min.',
      objectiveTitle: null,
      fromAnotherDay: false,
    }

    expect(recoveryBudgetOf(step, CAPACITY_PROFILES.minima)).toBe(30)
    expect(recoveryBudgetOf(step, CAPACITY_PROFILES.plena)).toBe(60)
  })
})
