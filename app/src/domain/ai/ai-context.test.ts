import { describe, expect, it } from 'vitest'
import { addDays, parseDayKey } from '@/domain/entities/day'
import { forecastOf } from '@/domain/entities/forecast'
import { createHabit, type HabitLog } from '@/domain/entities/habit'
import { calculateMomentum, momentumFactors } from '@/domain/entities/momentum'
import { createObjective, progressOfObjective } from '@/domain/entities/objective'
import { planProgressOf } from '@/domain/entities/plan-progress'
import { createPlanStage } from '@/domain/entities/plan-stage'
import { calculateStreakFromDays } from '@/domain/entities/streak'
import { createTask, type Task } from '@/domain/entities/task'
import { emptyReview } from '@/domain/entities/weekly-review'
import { buildAiContext, type AiContextInput } from './ai-context'

const TODAY = parseDayKey('2026-09-10')
const NOW = new Date('2026-08-01T08:00:00')

const objective = createObjective(
  {
    userId: 'u1',
    title: 'Ler 6 livros',
    axis: 'leitura',
    target: 1800,
    startedOn: addDays(TODAY, -30),
    deadline: addDays(TODAY, 60),
    motive: 'Voltar a ler com constância',
  },
  'obj-1',
  NOW,
)

const stages = [
  createPlanStage(
    { userId: 'u1', objectiveId: 'obj-1', title: 'Escolher os livros', order: 0, weight: 20 },
    's1',
    NOW,
  ),
  createPlanStage(
    { userId: 'u1', objectiveId: 'obj-1', title: 'Ler os três primeiros', order: 1, weight: 80 },
    's2',
    NOW,
  ),
]

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    ...createTask(
      { userId: 'u1', title: `Ação ${id}`, day: TODAY, objectiveId: 'obj-1', stageId: 's2' },
      id,
    ),
    ...overrides,
  }
}

const habit = createHabit(
  {
    userId: 'u1',
    name: 'Ler antes de dormir',
    axis: 'leitura',
    icon: 'livro',
    frequency: 'diario',
    dayPart: 'noite',
    target: 20,
    minimalTarget: 5,
    objectiveId: 'obj-1',
  },
  'h1',
  NOW,
)

function log(day: ReturnType<typeof addDays>): HabitLog {
  return { id: `log-${day}`, userId: 'u1', habitId: 'h1', day, status: 'feito', createdAt: NOW }
}

function input(overrides: Partial<AiContextInput> = {}): AiContextInput {
  const tasks = [
    task('t0', { stageId: 's1', day: addDays(TODAY, 1) }),
    task('t1', { isMainPriority: true, estimatedMin: 25 }),
    task('t2', { day: addDays(TODAY, -2) }),
    task('t3', { day: addDays(TODAY, -5), status: 'feita' }),
  ]
  const habitLogs = [log(TODAY), log(addDays(TODAY, -1)), log(addDays(TODAY, -3))]
  const plan = planProgressOf(objective, stages, tasks, [habit], TODAY)
  const momentum = calculateMomentum({
    activities: [],
    habits: [habit],
    habitLogs,
    tasks,
    today: TODAY,
  })

  return {
    today: TODAY,
    momentum,
    factors: momentumFactors(momentum),
    streak: calculateStreakFromDays(habitLogs.map((item) => item.day), TODAY),
    checkIns: [],
    objectives: [
      {
        progress: progressOfObjective(objective, [], TODAY),
        plan,
        forecast: forecastOf({ plan, habits: [habit], habitLogs, today: TODAY }),
      },
    ],
    habits: [habit],
    habitLogs,
    tasks,
    reviews: [
      {
        ...emptyReview('u1', addDays(TODAY, -10), 'r-old', NOW),
        adjustments: 'Ler de manhã',
      },
      {
        ...emptyReview('u1', addDays(TODAY, -3), 'r-new', NOW),
        difficulties: 'Semana cheia',
        completedAt: NOW,
      },
    ],
    wins: [
      { id: 'w1', userId: 'u1', day: addDays(TODAY, -1), text: 'Abri o livro', createdAt: NOW },
      { id: 'w2', userId: 'u1', day: TODAY, text: 'Li 10 páginas', createdAt: NOW },
    ],
    ...overrides,
  }
}

describe('buildAiContext', () => {
  it('descreve o objetivo pelo plano: etapa atual, próxima ação e atraso', () => {
    const [objectiveContext] = buildAiContext(input()).objectives
    expect(objectiveContext?.title).toBe('Ler 6 livros')
    expect(objectiveContext?.axis).toBe('Leitura')
    expect(objectiveContext?.planPercent).not.toBeNull()
    expect(objectiveContext?.stages.map((stage) => stage.weightPercent)).toEqual([20, 80])
    expect(objectiveContext?.currentStage).toBe('Escolher os livros')
    expect(objectiveContext?.overdueActions).toBe(1)
    expect(objectiveContext?.nextAction).toBe('Ação t0')
    expect(objectiveContext?.habitCount).toBe(1)
  })

  it('separa o dia de hoje do que ficou pra trás', () => {
    const context = buildAiContext(input())
    expect(context.todayTasks.map((item) => item.title)).toEqual(['Ação t1'])
    expect(context.todayTasks[0]?.isMainPriority).toBe(true)
    expect(context.overdueTasks.map((item) => item.title)).toEqual(['Ação t2'])
  })

  it('liga o hábito ao objetivo e diz se ele já saiu hoje', () => {
    const [habitContext] = buildAiContext(input()).habits
    expect(habitContext?.objective).toBe('Ler 6 livros')
    expect(habitContext?.doneToday).toBe(true)
    expect(habitContext?.scheduledToday).toBe(true)
    expect(habitContext?.unit).toBe('páginas')
    expect(habitContext?.consistencyPercent).toBeGreaterThan(0)
    expect(habitContext?.consistencyPercent).toBeLessThanOrEqual(100)
  })

  it('traz os reviews do mais recente pro mais antigo, com o que a pessoa escreveu', () => {
    const { reviews } = buildAiContext(input())
    expect(reviews.map((review) => review.difficulties)).toEqual(['Semana cheia', null])
    expect(reviews[1]?.adjustments).toBe('Ler de manhã')
    expect(reviews[0]?.completed).toBe(true)
  })

  it('limita reviews e vitórias ao recente', () => {
    const reviews = Array.from({ length: 6 }, (_, index) =>
      emptyReview('u1', addDays(TODAY, -7 * (index + 1)), `r${index}`, NOW),
    )
    const wins = Array.from({ length: 9 }, (_, index) => ({
      id: `w${index}`,
      userId: 'u1',
      day: addDays(TODAY, -index),
      text: `Vitória ${index}`,
      createdAt: NOW,
    }))
    const context = buildAiContext(input({ reviews, wins }))
    expect(context.reviews).toHaveLength(3)
    expect(context.recentWins).toHaveLength(5)
    expect(context.recentWins[0]).toBe('Vitória 0')
  })

  it('abre o score em fatores com peso e diz se cada um foi medido', () => {
    const { momentum, consistency } = buildAiContext(input())
    expect(momentum.factors).toHaveLength(4)
    expect(momentum.factors.reduce((sum, factor) => sum + factor.weightPercent, 0)).toBe(100)
    expect(consistency.streak).toBeGreaterThanOrEqual(1)
  })

  it('sem check-in a capacidade é a padrão e a tela sabe disso', () => {
    const { capacity } = buildAiContext(input())
    expect(capacity.checkedIn).toBe(false)
    expect(capacity.focusMin).toBeGreaterThan(0)
  })

  it('não carrega nenhum id: a IA responde por posição e por texto', () => {
    const serialized = JSON.stringify(buildAiContext(input()))
    expect(serialized).not.toContain('"id"')
    expect(serialized).not.toContain('obj-1')
    expect(serialized).not.toContain('u1')
  })
})
