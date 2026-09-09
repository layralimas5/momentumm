import { beforeAll, describe, expect, it } from 'vitest'
import { addDays, dayKeyOf } from '@/domain/entities/day'
import { forecastOf } from '@/domain/entities/forecast'
import { countsAsDone } from '@/domain/entities/habit'
import { generateInsights } from '@/domain/entities/insight'
import { calculateMomentum } from '@/domain/entities/momentum'
import { planProgressOf } from '@/domain/entities/plan-progress'
import { totalWeightOf } from '@/domain/entities/plan-stage'
import { CAPACITY_PROFILES } from '@/domain/entities/checkin'
import { calculateStreakFromDays } from '@/domain/entities/streak'
import type { Objective } from '@/domain/entities/objective'
import type { PlanStage } from '@/domain/entities/plan-stage'
import type { Task } from '@/domain/entities/task'
import type { Habit } from '@/domain/entities/habit'
import {
  DemoHabitRepository,
  DemoObjectiveRepository,
  DemoPlanStageRepository,
  DemoTaskRepository,
} from './demo-repositories'
import { DEMO_USER } from './demo-store'

/**
 * O fluxo principal do produto, ponta a ponta, pelo mesmo caminho que a tela
 * usa: objetivo → etapas → ações e hábitos → dia de hoje → execução →
 * progresso e momentum → insight → ajuste do plano.
 *
 * É o teste que pega o erro que nenhum teste de unidade pega: um elo que grava
 * mas não aparece no elo seguinte. Roda sobre os repositórios demo, que são os
 * mesmos que o `container` entrega à apresentação quando não há Supabase.
 */

const objectives = new DemoObjectiveRepository()
const stagesRepo = new DemoPlanStageRepository()
const tasksRepo = new DemoTaskRepository()
const habitsRepo = new DemoHabitRepository()

const TODAY = dayKeyOf(new Date())

let objective: Objective
let pesquisa: PlanStage
let mvp: PlanStage
let habit: Habit

/** As etapas e ações deste objetivo, relidas do repositório a cada checagem. */
async function readPlan() {
  const [allStages, allTasks, allHabits] = await Promise.all([
    stagesRepo.listByUser(),
    tasksRepo.listByUser(),
    habitsRepo.listByUser(),
  ])

  return {
    allTasks,
    stages: allStages.filter((stage) => stage.objectiveId === objective.id),
    progress: planProgressOf(objective, allStages, allTasks, allHabits, TODAY),
  }
}

beforeAll(async () => {
  objective = await objectives.create({
    userId: DEMO_USER.id,
    title: 'Lançar o site novo',
    axis: 'meditacao',
    target: 600,
    startedOn: addDays(TODAY, -10),
    deadline: addDays(TODAY, 60),
  })

  pesquisa = await stagesRepo.create({
    userId: DEMO_USER.id,
    objectiveId: objective.id,
    title: 'Pesquisa',
    order: 0,
  })

  mvp = await stagesRepo.create({
    userId: DEMO_USER.id,
    objectiveId: objective.id,
    title: 'MVP',
    order: 1,
  })

  habit = await habitsRepo.create({
    userId: DEMO_USER.id,
    name: 'Uma hora de construção',
    icon: 'cerebro',
    axis: 'meditacao',
    objectiveId: objective.id,
    stageId: mvp.id,
    dayPart: 'manha',
    target: 60,
  })
})

describe('objetivo vira plano', () => {
  it('as etapas nascem somando 100% sem ninguém fazer conta', async () => {
    const { stages } = await readPlan()

    expect(stages).toHaveLength(2)
    expect(totalWeightOf(stages)).toBe(100)
  })

  it('objetivo sem ação nenhuma tem plano, mas ainda não tem progresso', async () => {
    const { progress } = await readPlan()

    expect(progress.hasPlan).toBe(true)
    expect(progress.ratio).toBe(0)
    expect(progress.nextTask).toBeNull()
  })
})

describe('ações e hábitos dentro da etapa', () => {
  let futura: Task

  beforeAll(async () => {
    await tasksRepo.create({
      userId: DEMO_USER.id,
      title: 'Mapear os concorrentes',
      objectiveId: objective.id,
      stageId: pesquisa.id,
      axis: 'meditacao',
      day: TODAY,
      order: 0,
    })

    futura = await tasksRepo.create({
      userId: DEMO_USER.id,
      title: 'Escrever a primeira tela',
      objectiveId: objective.id,
      stageId: mvp.id,
      axis: 'meditacao',
      day: addDays(TODAY, 7),
      order: 1,
    })
  })

  it('a ação entra na etapa e vira a próxima do plano', async () => {
    const { progress } = await readPlan()

    expect(progress.stages[0]?.totalTasks).toBe(1)
    expect(progress.nextTask?.title).toBe('Mapear os concorrentes')
  })

  it('o hábito acompanha o objetivo sem entrar na conta de execução', async () => {
    const { progress } = await readPlan()

    expect(progress.habits.map((item) => item.id)).toContain(habit.id)
    expect(progress.ratio).toBe(0)
  })

  it('ação marcada pra frente não aparece no dia até ser trazida', async () => {
    const { allTasks } = await readPlan()
    const ofToday = allTasks.filter((task) => task.day === TODAY && task.objectiveId === objective.id)

    expect(ofToday.map((task) => task.title)).not.toContain('Escrever a primeira tela')

    // É o que o botão "Trazer pra hoje" faz, no plano e no card do dashboard.
    await tasksRepo.update(futura.id, DEMO_USER.id, { day: TODAY })

    const after = await tasksRepo.listByUser()
    const broughtIn = after.filter((task) => task.day === TODAY && task.objectiveId === objective.id)
    expect(broughtIn.map((task) => task.title)).toContain('Escrever a primeira tela')
  })
})

describe('execução move o progresso', () => {
  beforeAll(async () => {
    const tasks = await tasksRepo.listByUser()
    const first = tasks.find((task) => task.title === 'Mapear os concorrentes')
    if (first) {
      await tasksRepo.update(first.id, DEMO_USER.id, {
        status: 'feita',
        completedAt: new Date(),
      })
    }
    await habitsRepo.setStatus(DEMO_USER.id, habit.id, TODAY, 'feito')
  })

  it('a etapa concluída empurra a porcentagem do objetivo', async () => {
    const { progress } = await readPlan()
    const stage = progress.stages.find((item) => item.stage.id === pesquisa.id)

    expect(stage?.ratio).toBe(1)
    expect(stage?.canSuggestCompletion).toBe(true)
    expect(progress.ratio).toBeGreaterThan(0)
  })

  it('o hábito cumprido é lido pelo momentum', async () => {
    const [allTasks, allHabits, logs] = await Promise.all([
      tasksRepo.listByUser(),
      habitsRepo.listByUser(),
      habitsRepo.listLogs(),
    ])

    const done = logs.find((log) => log.habitId === habit.id && log.day === TODAY)
    expect(done && countsAsDone(done.status)).toBe(true)

    const momentum = calculateMomentum({
      activities: [],
      habits: allHabits,
      habitLogs: logs,
      tasks: allTasks,
      today: TODAY,
    })

    expect(momentum.value).toBeGreaterThan(0)
    expect(momentum.explanation.length).toBeGreaterThan(0)
  })

  it('o insight lê a hierarquia inteira e devolve um ajuste com destino', async () => {
    const { progress, allTasks } = await readPlan()

    const insights = generateInsights({
      activities: [],
      habits: [],
      habitLogs: [],
      tasks: allTasks,
      checkIns: [],
      streak: calculateStreakFromDays(new Set([TODAY]), TODAY),
      momentum: calculateMomentum({
        activities: [],
        habits: [],
        habitLogs: [],
        tasks: allTasks,
        today: TODAY,
      }),
      capacity: CAPACITY_PROFILES.plena,
      today: TODAY,
      objectives: [
        {
          plan: progress,
          forecast: forecastOf({ plan: progress, habits: [], habitLogs: [], today: TODAY }),
        },
      ],
    })

    // Nem todo dia tem padrão — o que não pode é o insight apontar pra lugar
    // nenhum quando ele existe.
    for (const insight of insights) {
      expect(insight.actionLabel.length > 0 || insight.action === 'nenhuma').toBe(true)
    }
  })
})

describe('ajuste do plano', () => {
  it('apagar uma etapa redistribui o peso e solta as ações dela', async () => {
    await stagesRepo.remove(mvp.id)

    const { stages, progress, allTasks } = await readPlan()

    expect(stages).toHaveLength(1)
    expect(totalWeightOf(stages)).toBe(100)

    const orphan = allTasks.find((task) => task.title === 'Escrever a primeira tela')
    expect(orphan?.stageId).toBeNull()
    expect(progress.unstaged.map((task) => task.title)).toContain('Escrever a primeira tela')
  })

  it('o dado sobrevive a uma leitura nova, como depois de recarregar a página', async () => {
    const reread = await new DemoPlanStageRepository().listByUser()
    const mine = reread.filter((stage) => stage.objectiveId === objective.id)

    expect(mine.map((stage) => stage.title)).toEqual(['Pesquisa'])
  })

  it('arquivar o objetivo tira ele da lista sem levar o histórico junto', async () => {
    await objectives.archive(objective.id)

    const remaining = await objectives.listByUser()
    expect(remaining.map((item) => item.id)).not.toContain(objective.id)

    const tasks = await tasksRepo.listByUser()
    expect(tasks.some((task) => task.title === 'Mapear os concorrentes')).toBe(true)
  })
})
