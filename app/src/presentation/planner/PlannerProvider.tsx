import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Activity, NewActivityInput } from '@/domain/entities/activity'
import {
  activityTypeList,
  registerCustomActivityTypes,
  type ActivityType,
} from '@/domain/entities/activity-type'
import { sortByRecent } from '@/domain/entities/activity'
import type { CheckIn, NewCheckInInput } from '@/domain/entities/checkin'
import { dayKeyOf, type DayKey } from '@/domain/entities/day'
import { isActive, progressOf, type Goal, type NewGoalInput } from '@/domain/entities/goal'
import {
  countsAsDone,
  type Habit,
  type HabitLog,
  type HabitStatus,
  type NewHabitInput,
} from '@/domain/entities/habit'
import {
  isActiveObjective,
  progressOfObjective,
  type NewObjectiveInput,
  type Objective,
} from '@/domain/entities/objective'
import { limitsOf } from '@/domain/entities/plan'
import type { PlanDraft } from '@/domain/entities/plan-builder'
import { calculateStreakFromDays } from '@/domain/entities/streak'
import type { NewTaskInput, Task } from '@/domain/entities/task'
import type { NewWinInput, Win } from '@/domain/entities/win'
import type { ObjectiveUpdate } from '@/domain/repositories/objective-repository'
import type { TaskUpdate } from '@/domain/repositories/task-repository'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { toUserMessage } from '@/shared/errors'
import { PlannerContext, type PlannerState } from './planner-context'

interface Snapshot {
  readonly customAxes: ActivityType[]
  readonly activities: Activity[]
  readonly objectives: Objective[]
  readonly goals: Goal[]
  readonly habits: Habit[]
  readonly habitLogs: HabitLog[]
  readonly tasks: Task[]
  readonly checkIns: CheckIn[]
  readonly wins: Win[]
}

const EMPTY: Snapshot = {
  customAxes: [],
  activities: [],
  objectives: [],
  goals: [],
  habits: [],
  habitLogs: [],
  tasks: [],
  checkIns: [],
  wins: [],
}

/**
 * Carrega o planejamento inteiro de uma vez e mantém tudo em um estado só.
 *
 * Uma busca por tela criaria dashboards que discordam entre si — a meta diria
 * uma coisa e o progresso diria outra. Aqui a fonte é única e as escritas são
 * otimistas: a tela responde na hora e volta atrás se o servidor recusar.
 */
export function PlannerProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [data, setData] = useState<Snapshot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const mounted = useRef(true)

  // Recalculado a cada render: o app aberto virando o dia acompanha a data.
  const today = dayKeyOf(new Date())

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const reload = useCallback(async () => {
    if (!user) {
      setData(EMPTY)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [customAxes, activities, objectives, goals, habits, habitLogs, tasks, checkIns, wins] =
        await Promise.all([
        container.activityTypes.listCustom(user.id),
        container.activities.listByUser(user.id),
        container.objectives.listByUser(user.id),
        container.goals.listByUser(user.id),
        container.habits.listByUser(user.id),
        container.habits.listLogs(user.id),
        container.tasks.listByUser(user.id),
        container.checkIns.listByUser(user.id),
        container.wins.listByUser(user.id),
      ])

      if (!mounted.current) return

      // Antes do setData: qualquer tela que renderizar já precisa saber
      // traduzir o slug de uma área criada em nome e cor.
      registerCustomActivityTypes(customAxes)

      setData({
        customAxes,
        activities: sortByRecent(activities),
        objectives: objectives.filter(isActiveObjective),
        goals: goals.filter(isActive),
        habits,
        habitLogs,
        tasks,
        checkIns,
        wins,
      })
      setError(null)
    } catch (cause) {
      if (mounted.current) setError(toUserMessage(cause))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Escrita otimista: aplica, e se o servidor recusar volta ao estado anterior. */
  const mutate = useCallback(
    async (optimistic: (current: Snapshot) => Snapshot, persist: () => Promise<void>) => {
      let previous: Snapshot = EMPTY
      setData((current) => {
        previous = current
        return optimistic(current)
      })
      try {
        await persist()
        setError(null)
      } catch (cause) {
        setData(previous)
        setError(toUserMessage(cause))
        throw cause
      }
    },
    [],
  )

  const logActivity = useCallback(
    async (input: Omit<NewActivityInput, 'userId'>) => {
      if (!user) return
      const created = await container.activities.create({
        userId: user.id,
        visibility: profile?.defaultVisibility ?? 'publica',
        ...input,
      })
      setData((current) => ({
        ...current,
        activities: sortByRecent([created, ...current.activities]),
      }))
      setError(null)
    },
    [user, profile],
  )

  const removeActivity = useCallback(
    async (id: string) => {
      if (!user) return
      await mutate(
        (current) => ({
          ...current,
          activities: current.activities.filter((activity) => activity.id !== id),
        }),
        () => container.activities.remove(id, user.id),
      )
    },
    [user, mutate],
  )

  const createAxis = useCallback(
    async (label: string): Promise<ActivityType | null> => {
      if (!user) return null

      const axis = await container.activityTypes.createCustom({
        userId: user.id,
        label,
        order: data.customAxes.length,
      })

      const next = [...data.customAxes, axis]
      registerCustomActivityTypes(next)
      setData((current) => ({ ...current, customAxes: next }))
      setError(null)
      return axis
    },
    [user, data.customAxes],
  )

  const createObjective = useCallback(
    async (input: Omit<NewObjectiveInput, 'userId'>): Promise<Objective | null> => {
      if (!user) return null
      const objective = await container.objectives.create({ userId: user.id, ...input })
      setData((current) => ({ ...current, objectives: [...current.objectives, objective] }))
      setError(null)
      return objective
    },
    [user],
  )

  const updateObjective = useCallback(
    async (id: string, changes: ObjectiveUpdate) => {
      if (!user) return
      await mutate(
        (current) => ({
          ...current,
          objectives: current.objectives.map((objective) =>
            objective.id === id ? { ...objective, ...changes } : objective,
          ),
        }),
        () => container.objectives.update(id, user.id, changes),
      )
    },
    [user, mutate],
  )

  const archiveObjective = useCallback(
    async (id: string) => {
      if (!user) return
      await mutate(
        (current) => ({
          ...current,
          objectives: current.objectives.filter((objective) => objective.id !== id),
        }),
        () => container.objectives.archive(id, user.id),
      )
    },
    [user, mutate],
  )

  const createGoal = useCallback(
    async (input: Omit<NewGoalInput, 'userId'>): Promise<Goal | null> => {
      if (!user) return null
      const goal = await container.goals.create({ userId: user.id, ...input })
      setData((current) => ({ ...current, goals: [...current.goals, goal] }))
      setError(null)
      return goal
    },
    [user],
  )

  const archiveGoal = useCallback(
    async (id: string) => {
      if (!user) return
      await mutate(
        (current) => ({
          ...current,
          goals: current.goals.filter((goal) => goal.id !== id),
          // A ação órfã continua existindo, só perde o vínculo com a meta.
          tasks: current.tasks.map((task) =>
            task.goalId === id ? { ...task, goalId: null } : task,
          ),
        }),
        () => container.goals.archive(id, user.id),
      )
    },
    [user, mutate],
  )

  const createHabit = useCallback(
    async (input: Omit<NewHabitInput, 'userId'>): Promise<Habit | null> => {
      if (!user) return null
      const habit = await container.habits.create({ userId: user.id, ...input })
      setData((current) => ({ ...current, habits: [...current.habits, habit] }))
      setError(null)
      return habit
    },
    [user],
  )

  const archiveHabit = useCallback(
    async (id: string) => {
      if (!user) return
      await mutate(
        (current) => ({ ...current, habits: current.habits.filter((habit) => habit.id !== id) }),
        () => container.habits.archive(id, user.id),
      )
    },
    [user, mutate],
  )

  const setHabitStatus = useCallback(
    async (habitId: string, status: HabitStatus, day: DayKey = today) => {
      if (!user) return

      const optimisticLog: HabitLog = {
        id: `optimistic-${habitId}-${day}`,
        userId: user.id,
        habitId,
        day,
        status,
        createdAt: new Date(),
      }

      await mutate(
        (current) => {
          const withoutDay = current.habitLogs.filter(
            (log) => !(log.habitId === habitId && log.day === day),
          )
          // Voltar pra pendente é desfazer: o registro some em vez de virar histórico.
          return {
            ...current,
            habitLogs: status === 'pendente' ? withoutDay : [...withoutDay, optimisticLog],
          }
        },
        async () => {
          const saved = await container.habits.setStatus(user.id, habitId, day, status)
          if (status === 'pendente') return
          setData((current) => ({
            ...current,
            habitLogs: current.habitLogs.map((log) => (log.id === optimisticLog.id ? saved : log)),
          }))
        },
      )
    },
    [user, today, mutate],
  )

  const createTask = useCallback(
    async (input: Omit<NewTaskInput, 'userId'>): Promise<Task | null> => {
      if (!user) return null
      const task = await container.tasks.create({ userId: user.id, ...input })
      setData((current) => ({
        ...current,
        tasks: [
          ...(task.isMainPriority
            ? current.tasks.map((item) =>
                item.day === task.day ? { ...item, isMainPriority: false } : item,
              )
            : current.tasks),
          task,
        ],
      }))
      setError(null)
      return task
    },
    [user],
  )

  const updateTask = useCallback(
    async (id: string, changes: TaskUpdate) => {
      if (!user) return
      await mutate(
        (current) => {
          const target = current.tasks.find((task) => task.id === id)
          if (!target) return current
          const updated: Task = { ...target, ...changes }
          return {
            ...current,
            tasks: current.tasks.map((task) => {
              if (task.id === id) return updated
              if (updated.isMainPriority && task.day === updated.day) {
                return { ...task, isMainPriority: false }
              }
              return task
            }),
          }
        },
        async () => {
          await container.tasks.update(id, user.id, changes)
        },
      )
    },
    [user, mutate],
  )

  const removeTask = useCallback(
    async (id: string) => {
      if (!user) return
      await mutate(
        (current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }),
        () => container.tasks.remove(id, user.id),
      )
    },
    [user, mutate],
  )

  const saveCheckIn = useCallback(
    async (input: Omit<NewCheckInInput, 'userId'>) => {
      if (!user) return
      const checkIn = await container.checkIns.save({ userId: user.id, ...input })
      setData((current) => ({
        ...current,
        checkIns: [
          ...current.checkIns.filter((item) => item.day !== checkIn.day),
          checkIn,
        ],
      }))
      setError(null)
    },
    [user],
  )

  const saveWin = useCallback(
    async (input: Omit<NewWinInput, 'userId'>) => {
      if (!user) return
      const win = await container.wins.save({ userId: user.id, ...input })
      setData((current) => ({
        ...current,
        wins: [...current.wins.filter((item) => item.day !== win.day), win],
      }))
      setError(null)
    },
    [user],
  )

  /**
   * Os planos gerados no onboarding virando dado de verdade.
   *
   * A ordem dentro de cada plano importa: o objetivo primeiro (é ele que pode
   * ser recusado por já existir um ativo no eixo), depois o ritmo semanal,
   * depois os hábitos e por último as ações — que nascem já apontando pra meta
   * criada, senão o card de "próxima ação" da meta nasceria vazio.
   *
   * Só a primeira ação do primeiro plano fica como prioridade principal: a
   * regra do produto é uma por dia, e três objetivos não podem virar três
   * prioridades disputando o mesmo dia.
   */
  const applyPlan = useCallback(
    async (plans: readonly PlanDraft[]) => {
      if (!user) return

      let priorityTaken = false

      for (const plan of plans) {
        await createObjective(plan.objective)
        const goal = await createGoal(plan.goal).catch(() => null)

        for (const habit of plan.habits) {
          await createHabit(habit)
        }

        for (const task of plan.tasks) {
          const isMainPriority = (task.isMainPriority ?? false) && !priorityTaken
          if (isMainPriority) priorityTaken = true
          await createTask({ ...task, isMainPriority, goalId: goal?.id ?? null })
        }
      }
    },
    [user, createObjective, createGoal, createHabit, createTask],
  )

  const todayActivities = useMemo(
    () => data.activities.filter((activity) => activity.day === today),
    [data.activities, today],
  )

  /**
   * Dia com movimento é dia com atividade OU com hábito cumprido. Contar só
   * atividade zeraria a sequência de quem manteve os hábitos do dia.
   */
  const streak = useMemo(() => {
    const days = new Set<DayKey>(data.activities.map((activity) => activity.day))
    for (const log of data.habitLogs) {
      if (countsAsDone(log.status)) days.add(log.day)
    }
    return calculateStreakFromDays(days, today)
  }, [data.activities, data.habitLogs, today])

  const goalProgress = useMemo(
    () => data.goals.map((goal) => progressOf(goal, data.activities, today)),
    [data.goals, data.activities, today],
  )

  // Recalculado quando as áreas mudam: o registro global já foi atualizado, e
  // é essa dependência que faz a tela redesenhar com a área nova.
  const axes = useMemo(() => activityTypeList(), [data.customAxes])

  const objectiveProgress = useMemo(
    () =>
      data.objectives.map((objective) => progressOfObjective(objective, data.activities, today)),
    [data.objectives, data.activities, today],
  )

  const limits = useMemo(() => limitsOf(profile?.plan ?? 'free'), [profile])

  const isNewUser =
    !loading &&
    data.objectives.length === 0 &&
    data.habits.length === 0 &&
    data.goals.length === 0 &&
    data.tasks.length === 0 &&
    data.activities.length === 0

  const value = useMemo<PlannerState>(
    () => ({
      today,
      activities: data.activities,
      todayActivities,
      axes,
      objectives: data.objectives,
      objectiveProgress,
      goals: data.goals,
      goalProgress,
      habits: data.habits,
      habitLogs: data.habitLogs,
      tasks: data.tasks,
      checkIns: data.checkIns,
      wins: data.wins,
      streak,
      limits,
      loading,
      error,
      online,
      isNewUser,
      logActivity,
      removeActivity,
      createAxis,
      createObjective,
      updateObjective,
      archiveObjective,
      applyPlan,
      createGoal,
      archiveGoal,
      createHabit,
      archiveHabit,
      setHabitStatus,
      createTask,
      updateTask,
      removeTask,
      saveCheckIn,
      saveWin,
      reload,
    }),
    [
      today,
      data,
      todayActivities,
      axes,
      goalProgress,
      objectiveProgress,
      streak,
      limits,
      loading,
      error,
      online,
      isNewUser,
      logActivity,
      removeActivity,
      createAxis,
      createObjective,
      updateObjective,
      archiveObjective,
      applyPlan,
      createGoal,
      archiveGoal,
      createHabit,
      archiveHabit,
      setHabitStatus,
      createTask,
      updateTask,
      removeTask,
      saveCheckIn,
      saveWin,
      reload,
    ],
  )

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}
