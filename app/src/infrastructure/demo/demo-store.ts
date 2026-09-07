import { createActivity, type Activity, type NewActivityInput } from '@/domain/entities/activity'
import { createActivityType, type ActivityType } from '@/domain/entities/activity-type'
import {
  createCheckIn,
  type CheckIn,
  type NewCheckInInput,
} from '@/domain/entities/checkin'
import { addDays, dayKeyOf, type DayKey } from '@/domain/entities/day'
import {
  createHabit,
  type Habit,
  type HabitLog,
  type HabitStatus,
  type NewHabitInput,
} from '@/domain/entities/habit'
import { createGoal, type Goal, type NewGoalInput } from '@/domain/entities/goal'
import {
  createJourneyEvent,
  journeyEventKey,
  type JourneyEvent,
  type NewJourneyEventInput,
} from '@/domain/entities/journey-event'
import {
  createObjective,
  type NewObjectiveInput,
  type Objective,
} from '@/domain/entities/objective'
import type { PlanTier } from '@/domain/entities/plan'
import {
  createPlanStage,
  rebalanceWeights,
  type NewPlanStageInput,
  type PlanStage,
} from '@/domain/entities/plan-stage'
import type { Profile } from '@/domain/entities/profile'
import { createTask, type NewTaskInput, type Task } from '@/domain/entities/task'
import {
  applyDraft,
  emptyReview,
  type WeeklyReview,
  type WeeklyReviewDraft,
} from '@/domain/entities/weekly-review'
import { createWin, type NewWinInput, type Win } from '@/domain/entities/win'
import type { HabitUpdate } from '@/domain/repositories/habit-repository'
import type { ObjectiveUpdate } from '@/domain/repositories/objective-repository'
import type {
  PlanStageReweight,
  PlanStageUpdate,
} from '@/domain/repositories/plan-stage-repository'
import type { TaskReorder, TaskUpdate } from '@/domain/repositories/task-repository'
import { DomainError } from '@/shared/errors'

/**
 * Modo demo: o app inteiro funciona sem configurar nada, com os dados no
 * `localStorage`. A versão do storage sobe junto com o formato — dado antigo
 * é descartado em silêncio em vez de quebrar a tela.
 */
const STORAGE_KEY = 'momentumm.demo.v7'

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@momentumm.app',
} as const

interface DemoState {
  profile: Profile
  customAxes: ActivityType[]
  activities: Activity[]
  objectives: Objective[]
  planStages: PlanStage[]
  goals: Goal[]
  habits: Habit[]
  habitLogs: HabitLog[]
  tasks: Task[]
  checkIns: CheckIn[]
  wins: Win[]
  weeklyReviews: WeeklyReview[]
  journeyEvents: JourneyEvent[]
}

let state: DemoState | null = null

function newId(): string {
  return crypto.randomUUID()
}

function dateAt(day: DayKey, hour: number, minute = 0): Date {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, date, hour, minute, 0, 0)
}

function seed(): DemoState {
  const today = dayKeyOf(new Date())

  const profile: Profile = {
    id: DEMO_USER.id,
    handle: 'voce',
    name: 'Você',
    bio: 'Explorando o Momentumm em modo demo.',
    avatarUrl: null,
    defaultVisibility: 'publica',
    plan: 'free',
    createdAt: new Date(),
  }

  // Histórico com furo de propósito: sequência viva, mas não perfeita. Uma
  // semana impecável esconde justamente os estados que o produto precisa tratar.
  const plan: ReadonlyArray<readonly [number, NewActivityInput['type'], number, number]> = [
    [-6, 'leitura', 24, 7],
    [-5, 'estudo', 45, 8],
    [-5, 'treino', 40, 19],
    [-4, 'leitura', 18, 7],
    [-3, 'meditacao', 10, 6],
    [-3, 'estudo', 30, 9],
    [-1, 'leitura', 26, 8],
    [-1, 'treino', 35, 18],
  ]

  const activities = plan.map(([offset, type, value, hour], index) =>
    createActivity(
      { userId: DEMO_USER.id, type, value, occurredAt: dateAt(addDays(today, offset), hour) },
      `demo-activity-${index}`,
    ),
  )

  // Três objetivos em estados diferentes de propósito: um em andamento, um
  // recém-criado sem progresso e um pausado. É o que mostra na demo que pausar
  // não é apagar — que é justamente a decisão de produto mais fácil de perder
  // de vista quando a tela só tem exemplos que deram certo.
  const objectives = [
    createObjective(
      {
        userId: DEMO_USER.id,
        title: 'Ler 6 livros até o fim do trimestre',
        axis: 'leitura',
        motive: 'Quero voltar a terminar o que começo.',
        description: 'Seis livros, sem contar releitura. Vale audiolivro se eu anotar.',
        priority: 'alta',
        target: 1800,
        startedOn: addDays(today, -30),
        deadline: addDays(today, 60),
      },
      'demo-objective-1',
      dateAt(addDays(today, -30), 8),
    ),
    createObjective(
      {
        userId: DEMO_USER.id,
        title: 'Terminar o curso de arquitetura',
        axis: 'estudo',
        motive: 'Trava minha promoção.',
        priority: 'media',
        target: 1200,
        startedOn: addDays(today, -20),
        deadline: addDays(today, 70),
      },
      'demo-objective-2',
      dateAt(addDays(today, -20), 8),
    ),
    {
      ...createObjective(
        {
          userId: DEMO_USER.id,
          title: 'Correr 10 km sem parar',
          axis: 'treino',
          motive: 'Voltar ao ritmo de antes da lesão.',
          priority: 'baixa',
          target: 900,
          startedOn: addDays(today, -40),
          deadline: addDays(today, 50),
        },
        'demo-objective-3',
        dateAt(addDays(today, -40), 8),
      ),
      pausedAt: dateAt(addDays(today, -6), 9),
    },
  ]

  /*
    Etapas dos dois objetivos em andamento.

    Os pesos não são iguais de propósito: "ler os três primeiros" pesa mais que
    "escolher os livros", e é isso que faz a barra do objetivo significar
    alguma coisa. A demo precisa mostrar essa diferença, senão a primeira
    impressão do produto é a de uma barra que anda sozinha.
  */
  const planStages: PlanStage[] = [
    stageAt('demo-stage-1', 'demo-objective-1', 'Escolher os seis livros', 0, 10, 'concluida', -25),
    stageAt('demo-stage-2', 'demo-objective-1', 'Ler os três primeiros', 1, 45, 'em-andamento', 20),
    stageAt('demo-stage-3', 'demo-objective-1', 'Ler os três últimos', 2, 45, 'nao-iniciada', 60),
    stageAt('demo-stage-4', 'demo-objective-2', 'Fundamentos', 0, 30, 'em-andamento', -2),
    stageAt('demo-stage-5', 'demo-objective-2', 'Projeto prático', 1, 45, 'nao-iniciada', 40),
    stageAt('demo-stage-6', 'demo-objective-2', 'Prova final', 2, 25, 'nao-iniciada', 70),
  ]

  function stageAt(
    id: string,
    objectiveId: string,
    title: string,
    order: number,
    weight: number,
    status: PlanStage['status'],
    dueOffset: number,
  ): PlanStage {
    const stage = createPlanStage(
      {
        userId: DEMO_USER.id,
        objectiveId,
        title,
        order,
        weight,
        status,
        dueOn: addDays(today, dueOffset),
      },
      id,
      dateAt(addDays(today, -30), 8),
    )
    return status === 'concluida'
      ? { ...stage, completedAt: dateAt(addDays(today, dueOffset), 18) }
      : stage
  }

  const goals = [
    createGoal({ userId: DEMO_USER.id, type: 'leitura', target: 20, period: 'dia' }, 'demo-goal-1'),
    createGoal(
      { userId: DEMO_USER.id, type: 'treino', target: 150, period: 'semana' },
      'demo-goal-2',
    ),
    createGoal(
      { userId: DEMO_USER.id, type: 'estudo', target: 600, period: 'mes' },
      'demo-goal-3',
    ),
  ]

  const habits = [
    createHabit(
      {
        userId: DEMO_USER.id,
        name: 'Ler antes de dormir',
        description: 'Vinte páginas, sem celular na mesa de cabeceira.',
        icon: 'livro',
        axis: 'leitura',
        objectiveId: 'demo-objective-1',
        stageId: 'demo-stage-2',
        priority: 'alta',
        dayPart: 'noite',
        timeOfDay: '22:00',
        target: 20,
        minimalTarget: 5,
      },
      'demo-habit-1',
      dateAt(addDays(today, -30), 8),
    ),
    createHabit(
      {
        userId: DEMO_USER.id,
        name: 'Respirar 10 minutos',
        icon: 'lotus',
        axis: 'meditacao',
        dayPart: 'manha',
        target: 10,
        minimalTarget: 3,
      },
      'demo-habit-2',
      dateAt(addDays(today, -30), 8),
    ),
    createHabit(
      {
        userId: DEMO_USER.id,
        name: 'Treinar',
        icon: 'halter',
        axis: 'treino',
        priority: 'media',
        // Cota semanal em vez de dias fixos: é o hábito que mais muda de dia
        // na vida real, e é ele que mostra a diferença das duas frequências.
        frequency: 'vezes-semana',
        timesPerWeek: 3,
        dayPart: 'tarde',
        target: 45,
        minimalTarget: 10,
      },
      'demo-habit-3',
      dateAt(addDays(today, -30), 8),
    ),
  ]

  const habitLogs: HabitLog[] = []
  for (let offset = -6; offset <= -1; offset += 1) {
    const day = addDays(today, offset)
    for (const habit of habits) {
      // Falha ocasional no meio da semana: é o que gera insight de verdade.
      if (offset === -2) continue
      const status: HabitStatus = offset === -4 && habit.id === 'demo-habit-3' ? 'minimo' : 'feito'
      habitLogs.push({
        id: `demo-log-${habit.id}-${offset}`,
        userId: DEMO_USER.id,
        habitId: habit.id,
        day,
        status,
        createdAt: dateAt(day, 20),
      })
    }
  }

  const tasks = [
    createTask(
      {
        userId: DEMO_USER.id,
        title: 'Treinar 45 minutos',
        goalId: 'demo-goal-2',
        objectiveId: 'demo-objective-3',
        axis: 'treino',
        estimatedMin: 45,
        effort: 'pesado',
        priority: 'alta',
        minimalVersion: 'Fazer 10 minutos de movimento',
        day: today,
        timeOfDay: '18:30',
        isMainPriority: true,
      },
      'demo-task-1',
    ),
    createTask(
      {
        userId: DEMO_USER.id,
        title: 'Ler o capítulo 4',
        goalId: 'demo-goal-1',
        objectiveId: 'demo-objective-1',
        stageId: 'demo-stage-2',
        axis: 'leitura',
        estimatedMin: 25,
        effort: 'leve',
        priority: 'alta',
        minimalVersion: 'Ler 3 páginas',
        day: today,
        order: 0,
      },
      'demo-task-2',
    ),
    /*
      Duas ações já concluídas, com data.

      Existem pra a demo mostrar o ciclo INTEIRO: sem conclusão carimbada não
      há velocidade, e sem velocidade a previsão responde "sem dados" — que é o
      comportamento correto, mas deixa metade do produto invisível na primeira
      visita.
    */
    {
      ...createTask(
        {
          userId: DEMO_USER.id,
          title: 'Terminar o primeiro livro',
          goalId: 'demo-goal-1',
          objectiveId: 'demo-objective-1',
          stageId: 'demo-stage-2',
          axis: 'leitura',
          estimatedMin: 40,
          effort: 'medio',
          day: addDays(today, -11),
          order: 0,
        },
        'demo-task-6',
      ),
      status: 'feita' as const,
      completedAt: dateAt(addDays(today, -11), 21),
    },
    {
      ...createTask(
        {
          userId: DEMO_USER.id,
          title: 'Ler os capítulos 1 a 3',
          goalId: 'demo-goal-1',
          objectiveId: 'demo-objective-1',
          stageId: 'demo-stage-2',
          axis: 'leitura',
          estimatedMin: 35,
          effort: 'leve',
          day: addDays(today, -4),
          order: 1,
        },
        'demo-task-7',
      ),
      status: 'feita' as const,
      completedAt: dateAt(addDays(today, -4), 22),
    },
    createTask(
      {
        userId: DEMO_USER.id,
        title: 'Revisar o módulo de arquitetura',
        goalId: 'demo-goal-3',
        objectiveId: 'demo-objective-2',
        stageId: 'demo-stage-4',
        axis: 'estudo',
        estimatedMin: 60,
        effort: 'medio',
        minimalVersion: 'Reler as anotações do módulo',
        day: addDays(today, 2),
        order: 0,
      },
      'demo-task-3',
    ),
    createTask(
      {
        userId: DEMO_USER.id,
        title: 'Fazer o exercício final do módulo',
        objectiveId: 'demo-objective-2',
        stageId: 'demo-stage-4',
        axis: 'estudo',
        estimatedMin: 45,
        effort: 'pesado',
        day: addDays(today, 4),
        order: 1,
        // Depende da revisão: é o caso que faz a tela do plano mostrar
        // uma ação travada em vez de esconder o tamanho real do caminho.
        dependsOnId: 'demo-task-3',
      },
      'demo-task-4',
    ),
    createTask(
      {
        userId: DEMO_USER.id,
        title: 'Escolher o próximo livro',
        objectiveId: 'demo-objective-1',
        stageId: 'demo-stage-2',
        axis: 'leitura',
        estimatedMin: 10,
        effort: 'leve',
        priority: 'baixa',
        day: addDays(today, -2),
        order: 1,
      },
      'demo-task-5',
    ),
  ]

  const checkIns = [-3, -2, -1].map((offset) =>
    createCheckIn(
      {
        userId: DEMO_USER.id,
        day: addDays(today, offset),
        mood: offset === -2 ? 'sem-energia' : 'estavel',
        energy: offset === -2 ? 2 : 3,
        focus: offset === -2 ? 'disperso' : 'oscilando',
      },
      `demo-checkin-${offset}`,
      dateAt(addDays(today, offset), 8),
    ),
  )

  const wins = [
    createWin(
      { userId: DEMO_USER.id, day: addDays(today, -1), text: 'Voltei a treinar depois de duas semanas.' },
      'demo-win-1',
      dateAt(addDays(today, -1), 21),
    ),
    createWin(
      { userId: DEMO_USER.id, day: addDays(today, -3), text: 'Terminei o capítulo que estava travado.' },
      'demo-win-2',
      dateAt(addDays(today, -3), 22),
    ),
  ]

  return {
    profile,
    customAxes: [],
    activities,
    objectives,
    planStages,
    goals,
    habits,
    habitLogs,
    tasks,
    checkIns,
    wins,
    weeklyReviews: [],
    // Sem momento de fábrica: evento é resultado do que a pessoa fez, e um
    // "objetivo concluído" plantado no seed seria a primeira coisa que ela
    // veria pronta pra compartilhar sem ter feito nada.
    journeyEvents: [],
  }
}

interface StoredState {
  customAxes?: ActivityType[]
  profile: Omit<Profile, 'createdAt'> & { createdAt: string; plan?: PlanTier }
  activities: Array<Omit<Activity, 'occurredAt'> & { occurredAt: string }>
  objectives: Array<
    Omit<Objective, 'createdAt' | 'completedAt' | 'archivedAt'> & {
      createdAt: string
      completedAt: string | null
      archivedAt: string | null
    }
  >
  planStages?: Array<
    Omit<PlanStage, 'createdAt' | 'completedAt'> & {
      createdAt: string
      completedAt: string | null
    }
  >
  goals: Array<Omit<Goal, 'createdAt' | 'archivedAt'> & { createdAt: string; archivedAt: string | null }>
  habits: Array<Omit<Habit, 'createdAt' | 'archivedAt'> & { createdAt: string; archivedAt: string | null }>
  habitLogs: Array<Omit<HabitLog, 'createdAt'> & { createdAt: string }>
  tasks: Array<Omit<Task, 'createdAt' | 'completedAt'> & { createdAt: string; completedAt: string | null }>
  checkIns: Array<Omit<CheckIn, 'createdAt'> & { createdAt: string }>
  wins: Array<Omit<Win, 'createdAt'> & { createdAt: string }>
  weeklyReviews?: Array<
    Omit<WeeklyReview, 'createdAt' | 'updatedAt' | 'completedAt'> & {
      createdAt: string
      updatedAt: string
      completedAt: string | null
    }
  >
  journeyEvents?: Array<
    Omit<JourneyEvent, 'createdAt' | 'completedAt'> & {
      createdAt: string
      completedAt: string | null
    }
  >
}

function revive(raw: string): DemoState {
  const parsed = JSON.parse(raw) as StoredState

  return {
    customAxes: parsed.customAxes ?? [],
    profile: {
      ...parsed.profile,
      plan: parsed.profile.plan ?? 'free',
      createdAt: new Date(parsed.profile.createdAt),
    },
    activities: parsed.activities.map((item) => ({
      ...item,
      occurredAt: new Date(item.occurredAt),
    })),
    objectives: (parsed.objectives ?? []).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      completedAt: item.completedAt ? new Date(item.completedAt) : null,
      archivedAt: item.archivedAt ? new Date(item.archivedAt) : null,
    })),
    planStages: (parsed.planStages ?? []).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      completedAt: item.completedAt ? new Date(item.completedAt) : null,
    })),
    goals: parsed.goals.map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      archivedAt: item.archivedAt ? new Date(item.archivedAt) : null,
    })),
    habits: (parsed.habits ?? []).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      archivedAt: item.archivedAt ? new Date(item.archivedAt) : null,
    })),
    habitLogs: (parsed.habitLogs ?? []).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
    })),
    tasks: (parsed.tasks ?? []).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      completedAt: item.completedAt ? new Date(item.completedAt) : null,
    })),
    checkIns: (parsed.checkIns ?? []).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
    })),
    wins: (parsed.wins ?? []).map((item) => ({ ...item, createdAt: new Date(item.createdAt) })),
    weeklyReviews: (parsed.weeklyReviews ?? []).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
      completedAt: item.completedAt ? new Date(item.completedAt) : null,
    })),
    journeyEvents: (parsed.journeyEvents ?? []).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      completedAt: item.completedAt ? new Date(item.completedAt) : null,
    })),
  }
}

function load(): DemoState {
  if (state) return state

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    state = raw ? revive(raw) : seed()
  } catch {
    // localStorage bloqueado ou dado corrompido: começa limpo em vez de quebrar.
    state = seed()
  }

  return state
}

function persist(): void {
  if (!state) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Sem persistência o app continua funcionando na sessão atual.
  }
}

export const demoStore = {
  profile(): Profile {
    return load().profile
  },

  updateProfile(changes: Partial<Profile>): Profile {
    const current = load()
    current.profile = { ...current.profile, ...changes }
    persist()
    return current.profile
  },

  activities(): Activity[] {
    return [...load().activities]
  },

  addActivity(input: NewActivityInput): Activity {
    const current = load()
    const activity = createActivity(input, newId())
    current.activities = [activity, ...current.activities]
    persist()
    return activity
  },

  removeActivity(id: string): void {
    const current = load()
    current.activities = current.activities.filter((activity) => activity.id !== id)
    persist()
  },

  customAxes(): ActivityType[] {
    return [...load().customAxes]
  },

  addCustomAxis(label: string): ActivityType {
    const current = load()
    const axis = createActivityType({ label, order: current.customAxes.length })

    if (current.customAxes.some((item) => item.slug === axis.slug)) {
      throw new DomainError('Você já tem uma área com esse nome.')
    }

    current.customAxes = [...current.customAxes, axis]
    persist()
    return axis
  },

  objectives(): Objective[] {
    return [...load().objectives]
  },

  addObjective(input: NewObjectiveInput): Objective {
    const current = load()
    const duplicate = current.objectives.some(
      (objective) => objective.archivedAt === null && objective.axis === input.axis,
    )
    if (duplicate) {
      throw new DomainError(
        'Você já tem um objetivo ativo nessa área. Fecha ou arquiva ele antes de abrir outro.',
      )
    }

    const objective = createObjective(input, newId())
    current.objectives = [...current.objectives, objective]
    persist()
    return objective
  },

  updateObjective(id: string, changes: ObjectiveUpdate): void {
    const current = load()
    current.objectives = current.objectives.map((objective) =>
      objective.id === id ? { ...objective, ...changes } : objective,
    )
    persist()
  },

  archiveObjective(id: string): void {
    const current = load()
    current.objectives = current.objectives.map((objective) =>
      objective.id === id ? { ...objective, archivedAt: new Date() } : objective,
    )

    // As etapas somem com o objetivo arquivado, como o `on delete cascade` do
    // banco faz. Elas não existem fora dele: uma etapa órfã não significa nada.
    const orphans = new Set(
      current.planStages.filter((stage) => stage.objectiveId === id).map((stage) => stage.id),
    )
    current.planStages = current.planStages.filter((stage) => stage.objectiveId !== id)
    current.tasks = current.tasks.map((task) =>
      task.stageId && orphans.has(task.stageId) ? { ...task, stageId: null } : task,
    )
    current.habits = current.habits.map((habit) =>
      habit.stageId && orphans.has(habit.stageId) ? { ...habit, stageId: null } : habit,
    )

    persist()
  },

  planStages(): PlanStage[] {
    return [...load().planStages]
  },

  addPlanStage(input: NewPlanStageInput): PlanStage {
    const current = load()

    const siblings = current.planStages.filter(
      (stage) => stage.objectiveId === input.objectiveId,
    )

    const stage = createPlanStage(
      { ...input, order: input.order ?? siblings.length },
      newId(),
    )

    /*
      Peso redistribuído quando não vem definido.

      É o comportamento que mantém a promessa do domínio: os pesos somam 100 o
      tempo todo, sem obrigar quem só quer escrever "MVP" a fazer conta. Quem
      quiser mexer, mexe depois — e aí o peso informado é respeitado.
    */
    if (input.weight === undefined) {
      const balanced = rebalanceWeights([...siblings, stage])
      const byId = new Map(balanced.map((item) => [item.id, item]))
      current.planStages = [
        ...current.planStages.filter((item) => item.objectiveId !== input.objectiveId),
        ...balanced,
      ]
      persist()
      return byId.get(stage.id) ?? stage
    }

    current.planStages = [...current.planStages, stage]
    persist()
    return stage
  },

  updatePlanStage(id: string, changes: PlanStageUpdate): PlanStage {
    const current = load()
    const found = current.planStages.find((stage) => stage.id === id)
    if (!found) throw new DomainError('Essa etapa não existe mais.')

    const updated: PlanStage = { ...found, ...changes }
    current.planStages = current.planStages.map((stage) => (stage.id === id ? updated : stage))
    persist()
    return updated
  },

  reweightPlanStages(items: readonly PlanStageReweight[]): void {
    const current = load()
    const byId = new Map(items.map((item) => [item.id, item]))
    current.planStages = current.planStages.map((stage) => {
      const change = byId.get(stage.id)
      return change ? { ...stage, order: change.order, weight: change.weight } : stage
    })
    persist()
  },

  removePlanStage(id: string): void {
    const current = load()
    current.planStages = current.planStages.filter((stage) => stage.id !== id)

    // O trabalho não some com a organização: ação e hábito voltam pro objetivo
    // sem etapa, exatamente como o `on delete set null` do banco faz.
    current.tasks = current.tasks.map((task) =>
      task.stageId === id ? { ...task, stageId: null } : task,
    )
    current.habits = current.habits.map((habit) =>
      habit.stageId === id ? { ...habit, stageId: null } : habit,
    )

    persist()
  },

  goals(): Goal[] {
    return [...load().goals]
  },

  addGoal(input: NewGoalInput): Goal {
    const current = load()
    const duplicate = current.goals.some(
      (goal) => goal.archivedAt === null && goal.type === input.type && goal.period === input.period,
    )
    if (duplicate) {
      throw new DomainError('Você já tem uma meta ativa pra esse eixo nesse período.')
    }

    const goal = createGoal(input, newId())
    current.goals = [...current.goals, goal]
    persist()
    return goal
  },

  archiveGoal(id: string): void {
    const current = load()
    current.goals = current.goals.map((goal) =>
      goal.id === id ? { ...goal, archivedAt: new Date() } : goal,
    )
    persist()
  },

  habits(): Habit[] {
    return [...load().habits]
  },

  addHabit(input: NewHabitInput): Habit {
    const current = load()
    const habit = createHabit(input, newId())
    current.habits = [...current.habits, habit]
    persist()
    return habit
  },

  updateHabit(id: string, changes: HabitUpdate): Habit {
    const current = load()
    const found = current.habits.find((habit) => habit.id === id)
    if (!found) throw new DomainError('Esse hábito não existe mais.')

    const updated: Habit = { ...found, ...changes }
    current.habits = current.habits.map((habit) => (habit.id === id ? updated : habit))
    persist()
    return updated
  },

  archiveHabit(id: string): void {
    const current = load()
    current.habits = current.habits.map((habit) =>
      habit.id === id ? { ...habit, archivedAt: new Date() } : habit,
    )
    persist()
  },

  habitLogs(): HabitLog[] {
    return [...load().habitLogs]
  },

  setHabitStatus(habitId: string, day: DayKey, status: HabitStatus): HabitLog {
    const current = load()
    const existing = current.habitLogs.find((log) => log.habitId === habitId && log.day === day)

    // Voltar pra pendente é desfazer: some do histórico em vez de virar registro.
    if (status === 'pendente') {
      current.habitLogs = current.habitLogs.filter((log) => log !== existing)
      persist()
      return (
        existing ?? {
          id: newId(),
          userId: DEMO_USER.id,
          habitId,
          day,
          status,
          createdAt: new Date(),
        }
      )
    }

    const log: HabitLog = {
      id: existing?.id ?? newId(),
      userId: DEMO_USER.id,
      habitId,
      day,
      status,
      createdAt: new Date(),
    }

    current.habitLogs = existing
      ? current.habitLogs.map((item) => (item === existing ? log : item))
      : [...current.habitLogs, log]

    persist()
    return log
  },

  tasks(): Task[] {
    return [...load().tasks]
  },

  addTask(input: NewTaskInput): Task {
    const current = load()
    const task = createTask(input, newId())
    // Só uma prioridade principal por dia: a nova destrona a anterior.
    if (task.isMainPriority) {
      current.tasks = current.tasks.map((item) =>
        item.day === task.day ? { ...item, isMainPriority: false } : item,
      )
    }
    current.tasks = [...current.tasks, task]
    persist()
    return task
  },

  updateTask(id: string, changes: TaskUpdate): Task {
    const current = load()
    const found = current.tasks.find((task) => task.id === id)
    if (!found) throw new DomainError('Essa ação não existe mais.')

    const updated: Task = { ...found, ...changes }

    current.tasks = current.tasks.map((task) => {
      if (task.id === id) return updated
      if (updated.isMainPriority && task.day === updated.day) {
        return { ...task, isMainPriority: false }
      }
      return task
    })

    persist()
    return updated
  },

  reorderTasks(items: readonly TaskReorder[]): void {
    const current = load()
    const order = new Map(items.map((item) => [item.id, item.order]))
    current.tasks = current.tasks.map((task) =>
      order.has(task.id) ? { ...task, order: order.get(task.id) ?? task.order } : task,
    )
    persist()
  },

  removeTask(id: string): void {
    const current = load()
    // A dependência morre junto: manter o vínculo com uma ação apagada travaria
    // a próxima pra sempre, sem nada na tela explicando o porquê.
    current.tasks = current.tasks
      .filter((task) => task.id !== id)
      .map((task) => (task.dependsOnId === id ? { ...task, dependsOnId: null } : task))
    persist()
  },

  weeklyReviews(): WeeklyReview[] {
    return [...load().weeklyReviews]
  },

  saveWeeklyReview(weekStart: DayKey, draft: WeeklyReviewDraft): WeeklyReview {
    const current = load()
    const existing = current.weeklyReviews.find((item) => item.weekStart === weekStart)
    const base = existing ?? emptyReview(DEMO_USER.id, weekStart, newId())
    const review = applyDraft(base, draft)

    current.weeklyReviews = existing
      ? current.weeklyReviews.map((item) => (item.weekStart === weekStart ? review : item))
      : [...current.weeklyReviews, review]

    persist()
    return review
  },

  checkIns(): CheckIn[] {
    return [...load().checkIns]
  },

  saveCheckIn(input: NewCheckInInput): CheckIn {
    const current = load()
    const existing = current.checkIns.find((item) => item.day === input.day)
    const checkIn = createCheckIn(input, existing?.id ?? newId())

    current.checkIns = existing
      ? current.checkIns.map((item) => (item.day === input.day ? checkIn : item))
      : [...current.checkIns, checkIn]

    persist()
    return checkIn
  },

  wins(): Win[] {
    return [...load().wins]
  },

  saveWin(input: NewWinInput): Win {
    const current = load()
    const existing = current.wins.find((item) => item.day === input.day)
    const win = createWin(input, existing?.id ?? newId())

    current.wins = existing
      ? current.wins.map((item) => (item.day === input.day ? win : item))
      : [...current.wins, win]

    persist()
    return win
  },

  journeyEvents(): JourneyEvent[] {
    return [...load().journeyEvents]
  },

  /**
   * Grava o momento, deduplicado pela mesma chave do índice do Postgres: tipo,
   * origem e dia. Sem isso, desmarcar e remarcar o último hábito do dia
   * empilharia três "dia concluído" no histórico.
   */
  recordJourneyEvent(input: NewJourneyEventInput): JourneyEvent {
    const current = load()
    const event = createJourneyEvent(input, newId())
    const key = journeyEventKey(event)

    const index = current.journeyEvents.findIndex(
      (item) => item.sourceId !== null && journeyEventKey(item) === key,
    )

    if (index >= 0) {
      const previous = current.journeyEvents[index]
      const updated = { ...event, id: previous?.id ?? event.id }
      current.journeyEvents = current.journeyEvents.map((item, position) =>
        position === index ? updated : item,
      )
      persist()
      return updated
    }

    current.journeyEvents = [event, ...current.journeyEvents]
    persist()
    return event
  },

  /** Zera tudo, sem seed: é o caminho pra testar o onboarding de conta nova. */
  clear(): void {
    const profile = load().profile
    state = {
      profile: { ...profile, name: profile.name },
      customAxes: [],
      activities: [],
      objectives: [],
      planStages: [],
      goals: [],
      habits: [],
      habitLogs: [],
      tasks: [],
      checkIns: [],
      wins: [],
      weeklyReviews: [],
      journeyEvents: [],
    }
    persist()
  },

  reset(): void {
    state = seed()
    persist()
  },
}
