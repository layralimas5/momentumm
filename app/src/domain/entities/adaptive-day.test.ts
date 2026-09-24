import { describe, expect, it } from 'vitest'
import {
  buildAdaptiveDay,
  clampAvailable,
  MAX_AVAILABLE_MIN,
  MIN_AVAILABLE_MIN,
  startableAction,
  type AdaptiveDayInput,
  type AdaptiveDayPlan,
  type AdaptiveItem,
  type AdaptiveObjective,
} from './adaptive-day'
import { CAPACITY_PROFILES } from './checkin'
import { addDays, dayKeyToDate, parseDayKey } from './day'
import { createHabit, type Habit, type HabitLog } from './habit'
import { calculateMomentum, type MomentumScore } from './momentum'
import { createObjective, progressOfObjective, type Objective } from './objective'
import { planProgressOf } from './plan-progress'
import { createPlanStage, type PlanStage } from './plan-stage'
import { createTask, type Task } from './task'

const TODAY = parseDayKey('2026-09-03')

const MOMENTUM: MomentumScore = calculateMomentum({
  activities: [],
  habits: [],
  habitLogs: [],
  tasks: [],
  today: TODAY,
})

function task(overrides: Partial<Task> = {}, id = 't1'): Task {
  const base = createTask({ userId: 'u1', title: 'Escrever o capítulo', day: TODAY }, id)
  return { ...base, ...overrides }
}

/** Ação criada há N dias: é assim que o algoritmo enxerga o arrasto. */
function agedTask(days: number, overrides: Partial<Task> = {}, id = 'velha'): Task {
  const created = dayKeyToDate(addDays(TODAY, -days))
  return { ...task(overrides, id), createdAt: created }
}

function habit(overrides: Partial<Habit> = {}, id = 'h1'): Habit {
  const base = createHabit(
    { userId: 'u1', name: 'Ler', icon: 'livro', axis: 'meditacao', dayPart: 'manha', target: 30 },
    id,
    dayKeyToDate(addDays(TODAY, -60)),
  )
  return { ...base, ...overrides }
}

function objectiveWithPlan(input: {
  id: string
  title?: string
  deadlineInDays?: number
  tasks?: readonly Task[]
  stages?: readonly PlanStage[]
}): AdaptiveObjective {
  const objective: Objective = {
    ...createObjective(
      {
        userId: 'u1',
        title: input.title ?? 'Publicar o livro',
        axis: 'escrita',
        target: 100,
        startedOn: addDays(TODAY, -30),
        deadline: addDays(TODAY, input.deadlineInDays ?? 60),
      },
      input.id,
    ),
  }

  return {
    progress: progressOfObjective(objective, [], TODAY),
    plan: planProgressOf(objective, input.stages ?? [], input.tasks ?? [], [], TODAY),
  }
}

function input(overrides: Partial<AdaptiveDayInput> = {}): AdaptiveDayInput {
  return {
    today: TODAY,
    availableMin: 90,
    capacity: CAPACITY_PROFILES.moderada,
    momentum: MOMENTUM,
    tasks: [],
    habits: [],
    habitLogs: [],
    objectives: [],
    ...overrides,
  }
}

describe('clampAvailable', () => {
  it('prende o tempo informado entre o piso e o teto', () => {
    expect(clampAvailable(0)).toBe(MIN_AVAILABLE_MIN)
    expect(clampAvailable(99_999)).toBe(MAX_AVAILABLE_MIN)
    expect(clampAvailable(Number.NaN)).toBe(MIN_AVAILABLE_MIN)
    expect(clampAvailable(90)).toBe(90)
  })
})

describe('buildAdaptiveDay: o dia que já cabe', () => {
  it('não mexe em nada quando o planejado cabe no tempo', () => {
    const plan = buildAdaptiveDay(
      input({ tasks: [task({ estimatedMin: 30 }, 'a'), task({ estimatedMin: 25 }, 'b')] }),
    )

    expect(plan.fits).toBe(true)
    expect(plan.rescheduled).toHaveLength(0)
    expect(plan.reduced).toHaveLength(0)
    expect(plan.writes).toBe(0)
    expect(plan.summary).toContain('já cabe')
  })
})

describe('buildAdaptiveDay: 1h30 com plano de 4h', () => {
  const objective = objectiveWithPlan({ id: 'obj-1', deadlineInDays: 5 })

  const tasks = [
    task({ estimatedMin: 45, objectiveId: 'obj-1', priority: 'alta', isMainPriority: true }, 'principal'),
    task({ estimatedMin: 60, objectiveId: 'obj-1', minimalVersion: 'Revisar só o índice' }, 'flexivel'),
    task({ estimatedMin: 45, title: 'Organizar a mesa' }, 'solta'),
    task({ estimatedMin: 45, title: 'Responder e-mails' }, 'email'),
  ]

  const plan = buildAdaptiveDay(input({ availableMin: 90, tasks, objectives: [objective] }))

  it('mantém a prioridade principal e ela nunca é reagendada', () => {
    const principal = plan.items.find((item) => item.id === 'principal')
    expect(principal?.verdict).not.toBe('reagendar')
    expect(principal?.locked).toBe(true)
  })

  it('reduz o que é flexível em vez de empurrar', () => {
    const flexivel = plan.items.find((item) => item.id === 'flexivel')
    expect(flexivel?.verdict).toBe('reduzir')
    expect(flexivel?.adaptedMin).toBeLessThan(60)
    expect(flexivel?.reason).toContain('Revisar só o índice')
  })

  it('reagenda a tarefa solta, que é a de menor impacto', () => {
    expect(plan.rescheduled.map((item) => item.id)).toContain('solta')
    expect(plan.rescheduled.every((item) => item.moveTo !== null)).toBe(true)
  })

  it('diz o motivo de cada escolha com o dado que a produziu', () => {
    for (const item of plan.items) {
      expect(item.reason.length).toBeGreaterThan(10)
    }
  })

  it('preserva a trajetória: o objetivo continua andando hoje', () => {
    expect(plan.protectedObjectives).toContain('Publicar o livro')
  })

  it('leva o título fixo da revisão', () => {
    expect(plan.title).toBe('Vamos proteger seu Momentumm')
  })
})

describe('buildAdaptiveDay: o que ele se recusa a fazer', () => {
  it('não puxa ação atrasada pra dentro do dia curto', () => {
    const plan = buildAdaptiveDay(
      input({
        tasks: [task({ day: addDays(TODAY, -2) }, 'atrasada'), task({ estimatedMin: 20 }, 'hoje')],
      }),
    )

    expect(plan.items.map((item) => item.id)).toEqual(['hoje'])
  })

  it('não empilha tudo no dia seguinte', () => {
    // Quatro ações grandes: espalhar é a diferença entre reagendar e acumular.
    const tasks = Array.from({ length: 4 }, (_, index) =>
      task({ estimatedMin: 50, title: `Bloco ${index}` }, `t${index}`),
    )

    const plan = buildAdaptiveDay(input({ availableMin: 30, tasks }))
    const days = new Set(plan.rescheduled.map((item) => item.moveTo))

    expect(plan.rescheduled.length).toBeGreaterThan(1)
    expect(days.size).toBeGreaterThan(1)
  })

  it('nunca reagenda hábito: ele encolhe pra versão mínima', () => {
    const plan = buildAdaptiveDay(
      input({
        availableMin: 15,
        habits: [habit({ target: 60, minimalTarget: 10, axis: 'meditacao' })],
        tasks: [task({ estimatedMin: 120 }, 'grande')],
      }),
    )

    const item = plan.items.find((entry) => entry.kind === 'habito')
    expect(item?.verdict).toBe('reduzir')
    expect(item?.adaptedMin).toBe(10)
  })

  it('nunca devolve um dia vazio', () => {
    const plan = buildAdaptiveDay(
      input({ availableMin: 10, tasks: [task({ estimatedMin: 180 }, 'enorme')] }),
    )

    expect(plan.items.some((item) => item.verdict !== 'reagendar')).toBe(true)
  })

  it('respeita o prazo do objetivo ao empurrar', () => {
    const objective = objectiveWithPlan({ id: 'obj-2', deadlineInDays: 2 })
    const plan = buildAdaptiveDay(
      input({
        availableMin: 20,
        tasks: [
          task({ estimatedMin: 60, isMainPriority: true }, 'trava'),
          task({ estimatedMin: 90, objectiveId: 'obj-2' }, 'do-objetivo'),
        ],
        objectives: [objective],
      }),
    )

    const moved = plan.items.find((item) => item.id === 'do-objetivo')
    if (moved?.moveTo) {
      expect(moved.moveTo <= objective.progress.objective.deadline).toBe(true)
    }
  })
})

describe('buildAdaptiveDay: a ordem é impacto, não quantidade', () => {
  it('a ação do objetivo atrasado ganha da tarefa solta de mesmo tamanho', () => {
    const objective = objectiveWithPlan({ id: 'obj-3', deadlineInDays: 3, title: 'Entregar o site' })

    const plan = buildAdaptiveDay(
      input({
        availableMin: 40,
        tasks: [
          task({ estimatedMin: 40, title: 'Ligar pro contador' }, 'solta'),
          task({ estimatedMin: 40, objectiveId: 'obj-3' }, 'do-objetivo'),
        ],
        objectives: [objective],
      }),
    )

    expect(plan.items.find((item) => item.id === 'do-objetivo')?.verdict).toBe('manter')
    expect(plan.items.find((item) => item.id === 'solta')?.verdict).toBe('reagendar')
  })

  it('a ação arrastada há dias sobe na fila', () => {
    const plan = buildAdaptiveDay(
      input({
        availableMin: 30,
        tasks: [
          agedTask(0, { estimatedMin: 30, title: 'Criada hoje' }, 'nova'),
          agedTask(9, { estimatedMin: 30, title: 'Arrastada' }, 'velha'),
        ],
      }),
    )

    expect(plan.items.find((item) => item.id === 'velha')?.verdict).toBe('manter')
    expect(plan.items.find((item) => item.id === 'velha')?.reason).toContain('9 dias')
  })

  it('promove uma prioridade principal quando o dia ficou sem nenhuma', () => {
    const plan = buildAdaptiveDay(input({ tasks: [task({ estimatedMin: 20 }, 'unica')] }))
    expect(plan.promoteTaskId).toBe('unica')
  })

  it('não promove nada quando a prioridade já existe', () => {
    const plan = buildAdaptiveDay(
      input({ tasks: [task({ estimatedMin: 20, isMainPriority: true }, 'principal')] }),
    )
    expect(plan.promoteTaskId).toBeNull()
  })
})

describe('buildAdaptiveDay: protectIds', () => {
  it('o passo protegido não sai do dia nem quando o tempo acaba', () => {
    const plan = buildAdaptiveDay(
      input({
        availableMin: 15,
        tasks: [
          task({ estimatedMin: 120, isMainPriority: true }, 'grande'),
          task({ estimatedMin: 60 }, 'escolhida'),
        ],
        protectIds: ['escolhida'],
      }),
    )

    expect(plan.items.find((item) => item.id === 'escolhida')?.verdict).not.toBe('reagendar')
  })
})

describe('buildAdaptiveDay: hábitos e sequência', () => {
  it('hábito com sequência viva é essencial e fica protegido', () => {
    const logs: HabitLog[] = [1, 2, 3].map((offset) => ({
      id: `l${offset}`,
      userId: 'u1',
      habitId: 'h1',
      day: addDays(TODAY, -offset),
      status: 'feito',
      createdAt: new Date(),
    }))

    const plan = buildAdaptiveDay(
      input({
        availableMin: 20,
        habits: [habit({ target: 30, minimalTarget: 5 })],
        habitLogs: logs,
        tasks: [task({ estimatedMin: 120 }, 'grande')],
      }),
    )

    const item = plan.items.find((entry) => entry.kind === 'habito')
    expect(item?.locked).toBe(true)
    expect(item?.reason).toContain('Sequência de 3 dias')
  })

  it('hábito já cumprido hoje sai do plano', () => {
    const plan = buildAdaptiveDay(
      input({
        habits: [habit()],
        habitLogs: [
          { id: 'l', userId: 'u1', habitId: 'h1', day: TODAY, status: 'feito', createdAt: new Date() },
        ],
      }),
    )

    expect(plan.items).toHaveLength(0)
  })
})

describe('buildAdaptiveDay: etapa que trava o objetivo', () => {
  it('a ação do gargalo é mantida antes das outras', () => {
    const stages: PlanStage[] = [
      createPlanStage({ userId: 'u1', objectiveId: 'obj-4', title: 'MVP', weight: 100 }, 's1'),
    ]
    const late: Task[] = [
      task({ day: addDays(TODAY, -3), objectiveId: 'obj-4', stageId: 's1' }, 'v1'),
      task({ day: addDays(TODAY, -4), objectiveId: 'obj-4', stageId: 's1' }, 'v2'),
    ]
    const hoje = task({ estimatedMin: 40, objectiveId: 'obj-4', stageId: 's1' }, 'gargalo')

    const objective = objectiveWithPlan({
      id: 'obj-4',
      stages,
      tasks: [...late, hoje],
      deadlineInDays: 40,
    })

    const plan = buildAdaptiveDay(
      input({
        availableMin: 40,
        tasks: [...late, hoje, task({ estimatedMin: 40, title: 'Outra' }, 'outra')],
        objectives: [objective],
      }),
    )

    expect(plan.items.find((item) => item.id === 'gargalo')?.verdict).toBe('manter')
  })
})

/** Casos de tamanho, contagem e integridade da conta apresentada na tela. */
describe('buildAdaptiveDay: a conta que a tela mostra', () => {
  it('o total adaptado é a soma do que ficou', () => {
    const plan = buildAdaptiveDay(
      input({
        availableMin: 60,
        tasks: [
          task({ estimatedMin: 30 }, 'a'),
          task({ estimatedMin: 30 }, 'b'),
          task({ estimatedMin: 30 }, 'c'),
        ],
      }),
    )

    const soma = plan.items.reduce((total, item) => total + item.adaptedMin, 0)
    expect(plan.adaptedMin).toBe(soma)
    expect(plan.plannedMin).toBe(90)
  })

  it('conta como escrita só o que o app vai gravar', () => {
    const plan = buildAdaptiveDay(
      input({
        availableMin: 20,
        habits: [habit({ target: 30, minimalTarget: 5 })],
        tasks: [task({ estimatedMin: 90 }, 'grande'), task({ estimatedMin: 90 }, 'outra')],
      }),
    )

    const escritas = plan.items.filter(
      (item) => item.kind === 'acao' && item.verdict !== 'manter',
    ).length

    expect(plan.writes).toBe(escritas)
  })
})

describe('startableAction', () => {
  function item(over: Partial<AdaptiveItem> = {}): AdaptiveItem {
    return {
      kind: 'acao',
      id: 'a1',
      title: 'Treinar',
      verdict: 'manter',
      minutes: 45,
      adaptedMin: 45,
      minimalTitle: null,
      moveTo: null,
      reason: '',
      locked: false,
      objectiveTitle: null,
      stageTitle: null,
      overBudget: false,
      score: 1,
      ...over,
    }
  }

  function plan(items: AdaptiveItem[]): AdaptiveDayPlan {
    return {
      today: parseDayKey('2026-09-22'),
      availableMin: 60,
      plannedMin: 90,
      adaptedMin: 60,
      items,
      kept: [],
      reduced: [],
      rescheduled: [],
      fits: false,
      writes: 1,
      promoteTaskId: null,
      protectedObjectives: [],
      title: '',
      summary: '',
    }
  }

  it('pega a de maior peso entre as que ficam', () => {
    const escolhida = startableAction(
      plan([item({ id: 'a', score: 1 }), item({ id: 'b', score: 9 })]),
    )

    expect(escolhida?.id).toBe('b')
  })

  it('a protegida passa na frente do peso', () => {
    const escolhida = startableAction(
      plan([item({ id: 'a', score: 9 }), item({ id: 'b', score: 1, locked: true })]),
    )

    expect(escolhida?.id).toBe('b')
  })

  it('hábito não vira cronômetro', () => {
    expect(startableAction(plan([item({ kind: 'habito' })]))).toBeNull()
  })

  it('o que saiu do dia não serve pra começar', () => {
    expect(
      startableAction(plan([item({ verdict: 'reagendar', adaptedMin: 0 })])),
    ).toBeNull()
  })
})
