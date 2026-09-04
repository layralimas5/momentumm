import { createActivity, type Activity, type NewActivityInput } from '@/domain/entities/activity'
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
  createObjective,
  type NewObjectiveInput,
  type Objective,
} from '@/domain/entities/objective'
import type { PlanTier } from '@/domain/entities/plan'
import type { Profile } from '@/domain/entities/profile'
import { createTask, type NewTaskInput, type Task } from '@/domain/entities/task'
import { createWin, type NewWinInput, type Win } from '@/domain/entities/win'
import type { ObjectiveUpdate } from '@/domain/repositories/objective-repository'
import type { TaskUpdate } from '@/domain/repositories/task-repository'
import { DomainError } from '@/shared/errors'

/**
 * Modo demo: o app inteiro funciona sem configurar nada, com os dados no
 * `localStorage`. A versão do storage sobe junto com o formato — dado antigo
 * é descartado em silêncio em vez de quebrar a tela.
 */
const STORAGE_KEY = 'momentumm.demo.v3'

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@momentumm.app',
} as const

interface DemoState {
  profile: Profile
  activities: Activity[]
  objectives: Objective[]
  goals: Goal[]
  habits: Habit[]
  habitLogs: HabitLog[]
  tasks: Task[]
  checkIns: CheckIn[]
  wins: Win[]
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

  const objectives = [
    createObjective(
      {
        userId: DEMO_USER.id,
        title: 'Ler 6 livros até o fim do trimestre',
        axis: 'leitura',
        motive: 'Quero voltar a terminar o que começo.',
        target: 1800,
        startedOn: addDays(today, -30),
        deadline: addDays(today, 60),
      },
      'demo-objective-1',
      dateAt(addDays(today, -30), 8),
    ),
  ]

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
        icon: 'livro',
        axis: 'leitura',
        dayPart: 'noite',
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
        dayPart: 'tarde',
        weekdays: [1, 3, 5],
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
        axis: 'treino',
        estimatedMin: 45,
        effort: 'pesado',
        minimalVersion: 'Fazer 10 minutos de movimento',
        day: today,
        isMainPriority: true,
      },
      'demo-task-1',
    ),
    createTask(
      {
        userId: DEMO_USER.id,
        title: 'Ler o capítulo 4',
        goalId: 'demo-goal-1',
        axis: 'leitura',
        estimatedMin: 25,
        effort: 'leve',
        minimalVersion: 'Ler 3 páginas',
        day: today,
      },
      'demo-task-2',
    ),
    createTask(
      {
        userId: DEMO_USER.id,
        title: 'Revisar o módulo de arquitetura',
        goalId: 'demo-goal-3',
        axis: 'estudo',
        estimatedMin: 60,
        effort: 'medio',
        minimalVersion: 'Reler as anotações do módulo',
        day: addDays(today, 2),
      },
      'demo-task-3',
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

  return { profile, activities, objectives, goals, habits, habitLogs, tasks, checkIns, wins }
}

interface StoredState {
  profile: Omit<Profile, 'createdAt'> & { createdAt: string; plan?: PlanTier }
  activities: Array<Omit<Activity, 'occurredAt'> & { occurredAt: string }>
  objectives: Array<
    Omit<Objective, 'createdAt' | 'completedAt' | 'archivedAt'> & {
      createdAt: string
      completedAt: string | null
      archivedAt: string | null
    }
  >
  goals: Array<Omit<Goal, 'createdAt' | 'archivedAt'> & { createdAt: string; archivedAt: string | null }>
  habits: Array<Omit<Habit, 'createdAt' | 'archivedAt'> & { createdAt: string; archivedAt: string | null }>
  habitLogs: Array<Omit<HabitLog, 'createdAt'> & { createdAt: string }>
  tasks: Array<Omit<Task, 'createdAt' | 'completedAt'> & { createdAt: string; completedAt: string | null }>
  checkIns: Array<Omit<CheckIn, 'createdAt'> & { createdAt: string }>
  wins: Array<Omit<Win, 'createdAt'> & { createdAt: string }>
}

function revive(raw: string): DemoState {
  const parsed = JSON.parse(raw) as StoredState

  return {
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

  removeTask(id: string): void {
    const current = load()
    current.tasks = current.tasks.filter((task) => task.id !== id)
    persist()
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

  /** Zera tudo, sem seed: é o caminho pra testar o onboarding de conta nova. */
  clear(): void {
    const profile = load().profile
    state = {
      profile: { ...profile, name: profile.name },
      activities: [],
      objectives: [],
      goals: [],
      habits: [],
      habitLogs: [],
      tasks: [],
      checkIns: [],
      wins: [],
    }
    persist()
  },

  reset(): void {
    state = seed()
    persist()
  },
}
