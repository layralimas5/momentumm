import { describe, expect, it } from 'vitest'
import { addDays, dayKeyOf, parseDayKey, type DayKey } from './day'
import { forecastOf } from './forecast'
import { createHabit, type Habit, type HabitLog } from './habit'
import { generateInsights, type InsightInput } from './insight'
import { calculateMomentum } from './momentum'
import { createObjective, type Objective } from './objective'
import { planProgressOf, planRatioAt, stageProgressOf } from './plan-progress'
import {
  assertWeightsComplete,
  createPlanStage,
  distributeWeights,
  rebalanceWeights,
  viewStatusOf,
  weightsAreComplete,
  type PlanStage,
} from './plan-stage'
import { createTask, inboxTasks, tasksOfStage, unstagedTasks, type Task } from './task'
import { CAPACITY_PROFILES } from './checkin'
import { calculateStreakFromDays } from './streak'

/**
 * A hierarquia inteira, do peso da ação até a previsão de conclusão.
 *
 * O caso que fecha o arquivo é o exemplo completo do produto — objetivo, cinco
 * etapas, ações no MVP, hábito de apoio — porque é ele que prova que as peças
 * conversam. Testar cada função sozinha não pega o erro que importa aqui, que é
 * o de duas telas chegando em números diferentes pro mesmo objetivo.
 */

const TODAY = parseDayKey('2026-09-07')

function objective(overrides: Partial<Parameters<typeof createObjective>[0]> = {}): Objective {
  return createObjective(
    {
      userId: 'u1',
      title: 'Lançar meu SaaS',
      axis: 'estudo',
      target: 3000,
      startedOn: addDays(TODAY, -60),
      deadline: addDays(TODAY, 90),
      ...overrides,
    },
    'obj-1',
    new Date('2026-07-09T08:00:00'),
  )
}

function stage(
  id: string,
  title: string,
  order: number,
  weight: number,
  overrides: Partial<PlanStage> = {},
): PlanStage {
  return {
    ...createPlanStage(
      { userId: 'u1', objectiveId: 'obj-1', title, order, weight },
      id,
      new Date('2026-07-09T08:00:00'),
    ),
    ...overrides,
  }
}

function task(id: string, stageId: string | null, overrides: Partial<Task> = {}): Task {
  return {
    ...createTask(
      {
        userId: 'u1',
        title: `Ação ${id}`,
        day: TODAY,
        objectiveId: stageId ? 'obj-1' : null,
        stageId,
      },
      id,
    ),
    ...overrides,
  }
}

function doneOn(id: string, stageId: string, day: DayKey, weight = 1): Task {
  return task(id, stageId, {
    weight,
    status: 'feita',
    day,
    completedAt: new Date(`${day}T18:00:00`),
  })
}

// ---------------------------------------------------------------------------
// Pesos
// ---------------------------------------------------------------------------

describe('pesos das etapas', () => {
  it('distribui 100 sem sobra nem falta', () => {
    for (const count of [1, 2, 3, 4, 5, 7, 12]) {
      const weights = distributeWeights(count)
      expect(weights).toHaveLength(count)
      expect(weights.reduce((sum, weight) => sum + weight, 0)).toBe(100)
    }
  })

  it('joga o resto da divisão nas primeiras etapas', () => {
    expect(distributeWeights(3)).toEqual([34, 33, 33])
  })

  it('recusa um conjunto que não fecha 100', () => {
    const stages = [stage('s1', 'Pesquisa', 0, 30), stage('s2', 'MVP', 1, 30)]
    expect(weightsAreComplete(stages)).toBe(false)
    expect(() => assertWeightsComplete(stages)).toThrow(/faltam 40%/i)
  })

  it('reequilibra reordenando e somando 100 de novo', () => {
    const balanced = rebalanceWeights([
      stage('s1', 'Pesquisa', 0, 70),
      stage('s2', 'MVP', 1, 30),
      stage('s3', 'Beta', 2, 0),
    ])
    expect(balanced.map((item) => item.weight)).toEqual([34, 33, 33])
    expect(balanced.map((item) => item.order)).toEqual([0, 1, 2])
  })

  it('etapa sem data não fica atrasada, e pausada nunca fica', () => {
    expect(viewStatusOf(stage('s1', 'Pesquisa', 0, 100), TODAY)).toBe('nao-iniciada')
    expect(
      viewStatusOf(stage('s1', 'Pesquisa', 0, 100, { dueOn: addDays(TODAY, -3) }), TODAY),
    ).toBe('atrasada')
    expect(
      viewStatusOf(
        stage('s1', 'Pesquisa', 0, 100, { dueOn: addDays(TODAY, -3), status: 'pausada' }),
        TODAY,
      ),
    ).toBe('pausada')
  })
})

// ---------------------------------------------------------------------------
// Progresso da etapa
// ---------------------------------------------------------------------------

describe('progresso da etapa', () => {
  it('quatro ações de peso igual valem 25% cada', () => {
    const stages = stage('s1', 'MVP', 0, 100)
    const tasks = [
      doneOn('t1', 's1', TODAY),
      task('t2', 's1'),
      task('t3', 's1'),
      task('t4', 's1'),
    ]

    expect(stageProgressOf(stages, tasks, TODAY).ratio).toBeCloseTo(0.25)
  })

  it('o peso da ação manda: uma de peso 3 vale três das de peso 1', () => {
    const tasks = [doneOn('t1', 's1', TODAY, 3), task('t2', 's1'), task('t3', 's1')]
    expect(stageProgressOf(stage('s1', 'MVP', 0, 100), tasks, TODAY).ratio).toBeCloseTo(0.6)
  })

  it('cancelada sai da conta inteira, não derruba a barra', () => {
    const withCancelled = stageProgressOf(
      stage('s1', 'MVP', 0, 100),
      [doneOn('t1', 's1', TODAY), task('t2', 's1', { status: 'cancelada' })],
      TODAY,
    )
    expect(withCancelled.ratio).toBe(1)
    expect(withCancelled.totalTasks).toBe(1)
  })

  it('sugere concluir quando as obrigatórias saíram, mesmo com opcional em aberto', () => {
    const progress = stageProgressOf(
      stage('s1', 'MVP', 0, 100),
      [doneOn('t1', 's1', TODAY), task('t2', 's1', { isRequired: false })],
      TODAY,
    )
    expect(progress.canSuggestCompletion).toBe(true)
    expect(progress.hasOptionalLeft).toBe(true)
    expect(progress.requiredLeft).toBe(0)
  })

  it('não sugere concluir com obrigatória em aberto', () => {
    const progress = stageProgressOf(
      stage('s1', 'MVP', 0, 100),
      [doneOn('t1', 's1', TODAY), task('t2', 's1')],
      TODAY,
    )
    expect(progress.canSuggestCompletion).toBe(false)
  })

  it('etapa sem ação vale zero aberta e 100% concluída na mão', () => {
    expect(stageProgressOf(stage('s1', 'Contrato', 0, 100), [], TODAY).ratio).toBe(0)
    expect(
      stageProgressOf(stage('s1', 'Contrato', 0, 100, { status: 'concluida' }), [], TODAY).ratio,
    ).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Progresso do objetivo
// ---------------------------------------------------------------------------

describe('progresso ponderado do objetivo', () => {
  const stages = [
    stage('s1', 'Pesquisa', 0, 10),
    stage('s2', 'MVP', 1, 35),
    stage('s3', 'Landing Page', 2, 20),
    stage('s4', 'Beta', 3, 15),
    stage('s5', 'Lançamento', 4, 20),
  ]

  it('reproduz o exemplo do produto: pesquisa fechada e MVP em 60% dão 31%', () => {
    const withDone = [
      { ...stages[0]!, status: 'concluida' as const, completedAt: new Date() },
      ...stages.slice(1),
    ]

    // MVP com 3 de 5 ações concluídas: 0,6 × 35 = 21 pontos.
    const tasks = [
      doneOn('t1', 's2', TODAY),
      doneOn('t2', 's2', TODAY),
      doneOn('t3', 's2', TODAY),
      task('t4', 's2'),
      task('t5', 's2'),
    ]

    const plan = planProgressOf(objective(), withDone, tasks, [], TODAY)
    expect(Math.round(plan.ratio * 100)).toBe(31)
  })

  it('objetivo sem etapa nenhuma não inventa progresso', () => {
    const plan = planProgressOf(objective(), [], [task('t1', null)], [], TODAY)
    expect(plan.hasPlan).toBe(false)
    expect(plan.ratio).toBe(0)
  })

  it('aponta a etapa atual e a próxima ação executável', () => {
    const tasks = [
      task('t1', 's2', { order: 1 }),
      task('t2', 's2', { order: 0, dependsOnId: 't1' }),
    ]
    const plan = planProgressOf(objective(), stages, tasks, [], TODAY)

    expect(plan.currentStage?.stage.id).toBe('s1')
    // A de ordem menor está travada pela dependência: a próxima é a livre.
    expect(plan.stages[1]?.nextTask?.id).toBe('t1')
  })

  it('elege como gargalo a etapa com mais ações atrasadas', () => {
    const late = addDays(TODAY, -4)
    const tasks = [
      task('t1', 's2', { day: late }),
      task('t2', 's2', { day: late }),
      task('t3', 's3', { day: late }),
    ]

    const plan = planProgressOf(objective(), stages, tasks, [], TODAY)
    expect(plan.bottleneck?.stage.id).toBe('s2')
    expect(plan.overdueCount).toBe(3)
  })

  it('sem atraso e sem etapa parada de peso, não inventa gargalo', () => {
    const plan = planProgressOf(objective(), stages.slice(0, 1), [task('t1', 's1')], [], TODAY)
    expect(plan.bottleneck).toBeNull()
  })

  it('separa ação sem etapa de ação sem objetivo', () => {
    const tasks = [
      task('t1', null),
      { ...task('t2', null), objectiveId: 'obj-1' },
      task('t3', 's1'),
    ]

    expect(inboxTasks(tasks).map((item) => item.id)).toEqual(['t1'])
    expect(unstagedTasks(tasks, 'obj-1').map((item) => item.id)).toEqual(['t2'])
    expect(tasksOfStage(tasks, 's1').map((item) => item.id)).toEqual(['t3'])
  })

  it('progresso num dia passado só conta o que já tinha sido concluído', () => {
    const stagesOne = [stage('s1', 'MVP', 0, 100)]
    const tasks = [
      doneOn('t1', 's1', addDays(TODAY, -20)),
      doneOn('t2', 's1', TODAY),
      task('t3', 's1'),
      task('t4', 's1'),
    ]

    const progress = [stageProgressOf(stagesOne[0]!, tasks, TODAY)]
    expect(planRatioAt(progress, addDays(TODAY, -10), dayKeyOf)).toBeCloseTo(0.25)
    expect(planRatioAt(progress, TODAY, dayKeyOf)).toBeCloseTo(0.5)
  })
})

// ---------------------------------------------------------------------------
// Previsão
// ---------------------------------------------------------------------------

describe('previsão de conclusão', () => {
  const stages = [stage('s1', 'MVP', 0, 100)]

  function forecastWith(tasks: readonly Task[], overrides: Partial<Objective> = {}) {
    const target = { ...objective(), ...overrides }
    return forecastOf({
      plan: planProgressOf(target, stages, tasks, [], TODAY),
      habits: [],
      habitLogs: [],
      today: TODAY,
    })
  }

  it('cala a boca quando o objetivo é novo demais', () => {
    const forecast = forecastWith([doneOn('t1', 's1', TODAY), task('t2', 's1')], {
      startedOn: addDays(TODAY, -3),
    })
    expect(forecast.kind).toBe('sem-dados')
    expect(forecast.message).toContain('mais alguns dias')
  })

  it('cala a boca com uma única ação concluída', () => {
    const forecast = forecastWith([doneOn('t1', 's1', addDays(TODAY, -2)), task('t2', 's1')])
    expect(forecast.kind).toBe('sem-dados')
  })

  it('não projeta quando não houve avanço na janela', () => {
    const old = addDays(TODAY, -40)
    const forecast = forecastWith([
      doneOn('t1', 's1', old),
      doneOn('t2', 's1', old),
      task('t3', 's1'),
      task('t4', 's1'),
    ])
    expect(forecast.kind).toBe('sem-dados')
    expect(forecast.message).toContain('Nenhum avanço')
  })

  it('projeta a partir do ritmo recente e fala de forma condicional', () => {
    // Metade do plano saiu nos últimos 7 dias: a outra metade pede outros 7.
    const forecast = forecastWith([
      doneOn('t1', 's1', addDays(TODAY, -6)),
      doneOn('t2', 's1', addDays(TODAY, -2)),
      task('t3', 's1'),
      task('t4', 's1'),
    ])

    expect(forecast.kind).toBe('estimado')
    expect(forecast.day).not.toBeNull()
    expect(forecast.message).toContain('Mantendo esse ritmo')
    expect(forecast.dailyRate).toBeGreaterThan(0)
  })

  it('diz quantos dias passa do prazo quando passa', () => {
    const forecast = forecastWith(
      [
        doneOn('t1', 's1', addDays(TODAY, -10)),
        doneOn('t2', 's1', addDays(TODAY, -1)),
        ...Array.from({ length: 18 }, (_, index) => task(`p${index}`, 's1')),
      ],
      { deadline: addDays(TODAY, 10) },
    )

    expect(forecast.kind).toBe('estimado')
    expect(forecast.daysLate).toBeGreaterThan(0)
    expect(forecast.message).toContain('depois do prazo')
  })

  it('usa a consistência do hábito de apoio na frase quando existe', () => {
    const habit: Habit = createHabit(
      {
        userId: 'u1',
        name: 'Desenvolver 1h por dia',
        icon: 'cerebro',
        axis: 'estudo',
        objectiveId: 'obj-1',
        dayPart: 'manha',
        target: 60,
      },
      'h1',
      new Date('2026-07-09T08:00:00'),
    )

    const logs: HabitLog[] = Array.from({ length: 12 }, (_, index) => ({
      id: `l${index}`,
      userId: 'u1',
      habitId: 'h1',
      day: addDays(TODAY, -index),
      status: 'feito',
      createdAt: new Date(),
    }))

    const tasks = [
      doneOn('t1', 's1', addDays(TODAY, -6)),
      doneOn('t2', 's1', addDays(TODAY, -2)),
      task('t3', 's1'),
      task('t4', 's1'),
    ]

    const forecast = forecastOf({
      plan: planProgressOf(objective(), stages, tasks, [habit], TODAY),
      habits: [habit],
      habitLogs: logs,
      today: TODAY,
    })

    expect(forecast.consistency).not.toBeNull()
    expect(forecast.message).toContain('consistência')
  })
})

// ---------------------------------------------------------------------------
// Insights da hierarquia
// ---------------------------------------------------------------------------

describe('insights da hierarquia', () => {
  function insightInput(overrides: Partial<InsightInput> = {}): InsightInput {
    const base: InsightInput = {
      activities: [],
      habits: [],
      habitLogs: [],
      tasks: [],
      checkIns: [],
      streak: calculateStreakFromDays(new Set<DayKey>(), TODAY),
      momentum: calculateMomentum({
        activities: [],
        habits: [],
        habitLogs: [],
        tasks: [],
        today: TODAY,
      }),
      capacity: CAPACITY_PROFILES.plena,
      today: TODAY,
    }
    return { ...base, ...overrides }
  }

  it('aponta a etapa que está segurando o objetivo, com contagem e peso', () => {
    const stages = [stage('s1', 'Pesquisa', 0, 30), stage('s2', 'MVP', 1, 70)]
    const late = addDays(TODAY, -5)
    const tasks = [
      task('t1', 's2', { day: late }),
      task('t2', 's2', { day: late }),
      task('t3', 's2', { day: late }),
    ]

    const plan = planProgressOf(objective(), stages, tasks, [], TODAY)
    const insights = generateInsights(
      insightInput({
        tasks,
        objectives: [
          { plan, forecast: forecastOf({ plan, habits: [], habitLogs: [], today: TODAY }) },
        ],
      }),
    )

    const bottleneck = insights.find((item) => item.id === 'etapa-travada-s2')
    expect(bottleneck).toBeDefined()
    expect(bottleneck?.reason).toContain('3 ações atrasadas')
    expect(bottleneck?.reason).toContain('70%')
    expect(bottleneck?.focus?.stageId).toBe('s2')
  })

  it('avisa quando o ritmo joga a conclusão pra depois do prazo', () => {
    const stages = [stage('s1', 'MVP', 0, 100)]
    const tasks = [
      doneOn('t1', 's1', addDays(TODAY, -10)),
      doneOn('t2', 's1', addDays(TODAY, -1)),
      ...Array.from({ length: 18 }, (_, index) => task(`p${index}`, 's1')),
    ]

    const plan = planProgressOf(
      { ...objective(), deadline: addDays(TODAY, 10) },
      stages,
      tasks,
      [],
      TODAY,
    )

    const insights = generateInsights(
      insightInput({
        tasks,
        objectives: [
          { plan, forecast: forecastOf({ plan, habits: [], habitLogs: [], today: TODAY }) },
        ],
      }),
    )

    expect(insights.some((item) => item.id.startsWith('ritmo-fora-do-prazo'))).toBe(true)
  })

  it('cobra destino quando a caixa de entrada enche', () => {
    const tasks = [task('t1', null), task('t2', null), task('t3', null)]
    const insights = generateInsights(insightInput({ tasks }))

    const inbox = insights.find((item) => item.id === 'caixa-de-entrada-cheia')
    expect(inbox?.title).toContain('3 ações')
  })

  it('não inventa insight de etapa quando não recebe a hierarquia', () => {
    const insights = generateInsights(insightInput({ tasks: [task('t1', 's2')] }))
    expect(insights.some((item) => item.id.startsWith('etapa-travada'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// O exemplo completo do produto
// ---------------------------------------------------------------------------

describe('cenário completo: lançar meu SaaS', () => {
  const saas = objective({ title: 'Lançar meu SaaS até dezembro' })

  const stages = [
    stage('s1', 'Pesquisa', 0, 10, {
      status: 'concluida',
      completedAt: new Date('2026-08-01T18:00:00'),
    }),
    stage('s2', 'MVP', 1, 35, { status: 'em-andamento', dueOn: addDays(TODAY, 20) }),
    stage('s3', 'Landing Page', 2, 20),
    stage('s4', 'Beta', 3, 15),
    stage('s5', 'Lançamento', 4, 20),
  ]

  const tasks: Task[] = [
    doneOn('mvp-1', 's2', addDays(TODAY, -9)),
    doneOn('mvp-2', 's2', addDays(TODAY, -3)),
    { ...task('mvp-3', 's2', { order: 2 }), title: 'Configurar pagamentos' },
  ]

  const habit = createHabit(
    {
      userId: 'u1',
      name: 'Desenvolver uma hora por dia',
      icon: 'cerebro',
      axis: 'estudo',
      objectiveId: 'obj-1',
      stageId: 's2',
      dayPart: 'manha',
      target: 60,
    },
    'h1',
    new Date('2026-07-09T08:00:00'),
  )

  const habitLogs: HabitLog[] = Array.from({ length: 12 }, (_, index) => ({
    id: `l${index}`,
    userId: 'u1',
    habitId: 'h1',
    day: addDays(TODAY, -index),
    status: 'feito' as const,
    createdAt: new Date(),
  }))

  const plan = planProgressOf(saas, stages, tasks, [habit], TODAY)

  it('a pesquisa fechada e o MVP em dois terços somam o progresso ponderado', () => {
    // 10 (pesquisa) + 0,667 × 35 (MVP) ≈ 33%.
    expect(Math.round(plan.ratio * 100)).toBe(33)
    expect(plan.currentStage?.stage.title).toBe('MVP')
  })

  it('a próxima ação é a que falta na etapa atual', () => {
    expect(plan.nextTask?.title).toBe('Configurar pagamentos')
  })

  it('o hábito sustenta o objetivo sem concluir etapa nenhuma', () => {
    expect(plan.habits.map((item) => item.id)).toEqual(['h1'])
    // Doze dias de hábito cumprido não movem o progresso: execução é execução.
    expect(plan.stages[1]?.ratio).toBeCloseTo(2 / 3)
  })

  it('a previsão sai com data e fala de consistência', () => {
    const forecast = forecastOf({ plan, habits: [habit], habitLogs, today: TODAY })
    expect(forecast.kind).toBe('estimado')
    expect(forecast.message).toMatch(/consistência/)
    expect(forecast.message).toMatch(/previsão de conclusão/)
  })

  it('o momentum enxerga o avanço do plano sem virar progresso do objetivo', () => {
    const gain = plan.ratio - planRatioAt(plan.stages, addDays(TODAY, -7), dayKeyOf)

    const withPlan = calculateMomentum({
      activities: [],
      habits: [habit],
      habitLogs,
      tasks,
      today: TODAY,
      planGain: gain,
      previousPlanGain: 0,
    })

    expect(withPlan.parts.objectives).toBeGreaterThan(0)
    expect(withPlan.value).toBeGreaterThan(0)
    expect(withPlan.value).toBeLessThanOrEqual(100)
  })
})
