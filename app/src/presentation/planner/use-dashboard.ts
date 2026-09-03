import { useCallback, useMemo, useState } from 'react'
import { totalMinutes } from '@/domain/entities/activity'
import { capacityOf, checkInOfDay, type CapacityProfile, type CheckIn } from '@/domain/entities/checkin'
import { paceOf, type GoalPace, type GoalProgress } from '@/domain/entities/goal'
import { habitDayProgress, habitDayStates, type HabitDayProgress, type HabitDayState } from '@/domain/entities/habit'
import { primaryInsight, type Insight, type InsightInput } from '@/domain/entities/insight'
import {
  calculateMomentum,
  recommendationFor,
  type MomentumInput,
  type MomentumScore,
} from '@/domain/entities/momentum'
import { isPending, mainPriorityOf, nextTaskForGoal, supportingTasksOf, type Task } from '@/domain/entities/task'
import { summarizeWeek, type WeeklySummary } from '@/domain/entities/week'
import { winOfDay, type Win } from '@/domain/entities/win'
import { usePlanner } from './use-planner'

const DISMISSED_KEY = 'momentumm.insights.dismissed.v1'

export interface GoalInMotion {
  readonly progress: GoalProgress
  readonly pace: GoalPace
  readonly nextTask: Task | null
}

export interface DashboardView {
  readonly checkIn: CheckIn | null
  readonly capacity: CapacityProfile
  readonly momentum: MomentumScore
  readonly recommendation: string
  readonly mainPriority: Task | null
  readonly supportingTasks: readonly Task[]
  readonly habitStates: readonly HabitDayState[]
  readonly habitProgress: HabitDayProgress
  readonly week: WeeklySummary
  readonly goalsInMotion: readonly GoalInMotion[]
  readonly insight: Insight | null
  readonly todayWin: Win | null
  readonly focusMinutesToday: number
  /** Todos os hábitos do dia concluídos: o dashboard muda de tom. */
  readonly dayComplete: boolean
  dismissInsight(id: string): void
}

/**
 * A leitura do dia. Aqui as seções deixam de ser independentes: o check-in
 * define a capacidade, a capacidade calibra a recomendação, hábitos e ações
 * alimentam o momentum, o momentum vira progresso semanal e o conjunto gera o
 * insight. Nenhuma dessas contas mora em componente.
 */
export function useDashboard(): DashboardView {
  const planner = usePlanner()
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(loadDismissed)

  const {
    today,
    activities,
    todayActivities,
    habits,
    habitLogs,
    tasks,
    checkIns,
    wins,
    goalProgress,
    streak,
  } = planner

  const checkIn = useMemo(() => checkInOfDay(checkIns, today), [checkIns, today])
  const capacity = useMemo(() => capacityOf(checkIn), [checkIn])

  const momentumInput = useMemo<MomentumInput>(
    () => ({ activities, habits, habitLogs, tasks, today }),
    [activities, habits, habitLogs, tasks, today],
  )

  const momentum = useMemo(() => calculateMomentum(momentumInput), [momentumInput])
  const week = useMemo(() => summarizeWeek(momentumInput), [momentumInput])

  const habitStates = useMemo(
    () => habitDayStates(habits, habitLogs, today),
    [habits, habitLogs, today],
  )
  const habitProgress = useMemo(() => habitDayProgress(habitStates), [habitStates])

  const mainPriority = useMemo(() => mainPriorityOf(tasks, today), [tasks, today])
  const supportingTasks = useMemo(() => supportingTasksOf(tasks, today), [tasks, today])

  const goalsInMotion = useMemo<GoalInMotion[]>(
    () =>
      goalProgress.map((progress) => ({
        progress,
        pace: paceOf(progress, today),
        nextTask: nextTaskForGoal(tasks, progress.goal.id),
      })),
    [goalProgress, tasks, today],
  )

  const insight = useMemo(() => {
    const input: InsightInput = {
      activities,
      habits,
      habitLogs,
      tasks,
      checkIns,
      streak,
      momentum,
      capacity,
      today,
    }
    return primaryInsight(input, dismissed)
  }, [activities, habits, habitLogs, tasks, checkIns, streak, momentum, capacity, today, dismissed])

  const dismissInsight = useCallback((id: string) => {
    setDismissed((current) => {
      const next = new Set(current)
      next.add(id)
      persistDismissed(next)
      return next
    })
  }, [])

  const pendingToday = tasks.filter((task) => task.day === today && isPending(task)).length

  return {
    checkIn,
    capacity,
    momentum,
    recommendation: recommendationFor(momentum, capacity),
    mainPriority,
    supportingTasks,
    habitStates,
    habitProgress,
    week,
    goalsInMotion,
    insight,
    todayWin: winOfDay(wins, today),
    focusMinutesToday: totalMinutes(todayActivities),
    dayComplete: habitProgress.allDone && pendingToday === 0 && habitProgress.total > 0,
    dismissInsight,
  }
}

/**
 * Insight dispensado fica só no dispositivo: é preferência de leitura, não dado
 * de negócio, e não vale uma escrita de rede.
 */
function loadDismissed(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function persistDismissed(ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
  } catch {
    // Sem armazenamento o insight simplesmente volta na próxima sessão.
  }
}
