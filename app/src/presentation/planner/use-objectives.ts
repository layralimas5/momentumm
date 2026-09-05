import { useMemo } from 'react'
import type { Activity } from '@/domain/entities/activity'
import { addDays } from '@/domain/entities/day'
import { habitConsistency, type Habit, type HabitConsistency } from '@/domain/entities/habit'
import type { ObjectiveProgress } from '@/domain/entities/objective'
import { comparePriority } from '@/domain/entities/priority'
import { byPlanOrder, isPending, type Task } from '@/domain/entities/task'
import { usePlanner } from './use-planner'

/** Dias sem nenhum movimento a partir dos quais o objetivo é considerado parado. */
export const STALLED_AFTER_DAYS = 7

export interface ObjectiveView {
  readonly progress: ObjectiveProgress
  readonly habits: readonly { habit: Habit; consistency: HabitConsistency }[]
  readonly tasks: readonly Task[]
  readonly openTasks: readonly Task[]
  readonly doneTasks: number
  /** Últimas atividades do eixo dentro da janela do objetivo. */
  readonly recent: readonly Activity[]
  /** Sem nenhum movimento há mais de uma semana. */
  readonly stalled: boolean
  readonly nextTask: Task | null
}

/**
 * Os objetivos com tudo que está pendurado neles.
 *
 * A conta acontece aqui e não em componente porque a mesma leitura aparece na
 * lista, no detalhe, no dia e no progresso — e é a divergência entre essas
 * quatro que faz um app parecer quatro apps.
 */
export function useObjectives(): readonly ObjectiveView[] {
  const { objectiveProgress, habits, tasks, activities, habitLogs, today } = usePlanner()

  return useMemo(() => {
    const views = objectiveProgress.map((progress) => {
      const objective = progress.objective

      const linkedHabits = habits
        .filter((habit) => habit.objectiveId === objective.id && habit.archivedAt === null)
        .map((habit) => ({
          habit,
          consistency: habitConsistency(habit, habitLogs, objective.startedOn, today),
        }))

      const linkedTasks = tasks
        .filter((task) => task.objectiveId === objective.id)
        .sort(byPlanOrder)

      const openTasks = linkedTasks.filter(isPending)

      const recent = activities
        .filter(
          (activity) =>
            activity.type === objective.axis &&
            activity.day >= objective.startedOn &&
            activity.day <= objective.deadline,
        )
        .slice(0, 8)

      const lastMove = recent[0]?.day ?? null
      const stalled =
        progress.state === 'em-andamento' &&
        (lastMove === null || lastMove < addDays(today, -STALLED_AFTER_DAYS))

      return {
        progress,
        habits: linkedHabits,
        tasks: linkedTasks,
        openTasks,
        doneTasks: linkedTasks.filter((task) => task.status === 'feita').length,
        recent,
        stalled,
        nextTask: openTasks[0] ?? null,
      }
    })

    // Em andamento na frente, pausado e concluído no fim. Dentro de cada grupo,
    // prioridade e prazo: o que aperta primeiro é o que a pessoa precisa ver.
    return views.sort((a, b) => {
      const rank = (view: ObjectiveView) =>
        view.progress.state === 'concluido' ? 2 : view.progress.state === 'pausado' ? 1 : 0

      const byRank = rank(a) - rank(b)
      if (byRank !== 0) return byRank

      const byPriority = comparePriority(a.progress.objective.priority, b.progress.objective.priority)
      if (byPriority !== 0) return byPriority

      return a.progress.daysLeft - b.progress.daysLeft
    })
  }, [objectiveProgress, habits, tasks, activities, habitLogs, today])
}

export function useObjective(id: string | undefined): ObjectiveView | null {
  const views = useObjectives()
  return useMemo(
    () => views.find((view) => view.progress.objective.id === id) ?? null,
    [views, id],
  )
}
