import { createActivity, type Activity, type NewActivityInput } from '@/domain/entities/activity'
import { addDays, dayKeyOf } from '@/domain/entities/day'
import { createGoal, type Goal, type NewGoalInput } from '@/domain/entities/goal'
import type { Profile } from '@/domain/entities/profile'
import { DomainError } from '@/shared/errors'

const STORAGE_KEY = 'momentumm.demo.v1'

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@momentumm.app',
} as const

interface DemoState {
  profile: Profile
  activities: Activity[]
  goals: Goal[]
}

let state: DemoState | null = null

function newId(): string {
  return crypto.randomUUID()
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
    createdAt: new Date(),
  }

  // Sequência dos últimos dias pra tela não nascer vazia na primeira visita.
  const plan: ReadonlyArray<readonly [number, NewActivityInput['type'], number]> = [
    [-4, 'leitura', 22],
    [-3, 'leitura', 18],
    [-3, 'treino', 40],
    [-2, 'estudo', 45],
    [-1, 'leitura', 26],
    [-1, 'meditacao', 10],
  ]

  const activities = plan.map(([offset, type, value], index) => {
    const day = addDays(today, offset)
    const [year, month, date] = day.split('-').map(Number) as [number, number, number]
    return createActivity(
      { userId: DEMO_USER.id, type, value, occurredAt: new Date(year, month - 1, date, 8 + index) },
      `demo-${index}`,
    )
  })

  const goals = [
    createGoal({ userId: DEMO_USER.id, type: 'leitura', target: 20, period: 'dia' }, 'demo-goal-1'),
    createGoal({ userId: DEMO_USER.id, type: 'treino', target: 150, period: 'semana' }, 'demo-goal-2'),
  ]

  return { profile, activities, goals }
}

function revive(raw: string): DemoState {
  const parsed = JSON.parse(raw) as {
    profile: Profile
    activities: Array<Omit<Activity, 'occurredAt'> & { occurredAt: string }>
    goals: Array<Omit<Goal, 'createdAt' | 'archivedAt'> & {
      createdAt: string
      archivedAt: string | null
    }>
  }

  return {
    profile: { ...parsed.profile, createdAt: new Date(parsed.profile.createdAt) },
    activities: parsed.activities.map((item) => ({ ...item, occurredAt: new Date(item.occurredAt) })),
    goals: parsed.goals.map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      archivedAt: item.archivedAt ? new Date(item.archivedAt) : null,
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

  goals(): Goal[] {
    return [...load().goals]
  },

  addGoal(input: NewGoalInput): Goal {
    const current = load()
    const duplicate = current.goals.some(
      (goal) =>
        goal.archivedAt === null && goal.type === input.type && goal.period === input.period,
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

  reset(): void {
    state = seed()
    persist()
  },
}
