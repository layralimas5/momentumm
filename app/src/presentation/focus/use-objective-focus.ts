import { useCallback } from 'react'
import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { Task } from '@/domain/entities/task'
import { track } from '@/infrastructure/analytics/track'
import type { ObjectiveView } from '@/presentation/planner/use-objectives'
import { usePlanner } from '@/presentation/planner/use-planner'
import { useFocus } from './use-focus'

const FREE_SESSION_MIN = 25

/** Sessão de ação: nem tão curta que não renda, nem tão longa que assuste. */
export function plannedMinutesOf(task: Task): number {
  return Math.min(60, Math.max(15, task.estimatedMin))
}

/**
 * O eixo em que a sessão é gravada.
 *
 * O progresso do objetivo soma as atividades do eixo DELE. Uma ação sem eixo
 * próprio que caísse em "estudo" sumiria de um objetivo de leitura: por isso
 * ela herda o eixo do objetivo a que pertence.
 */
export function focusAxisOf(task: Task | null, objectiveAxis: ActivityTypeSlug | null): ActivityTypeSlug {
  return task?.axis ?? objectiveAxis ?? 'estudo'
}

/**
 * Focar num objetivo: retoma se estiver pausado e abre o cronômetro na próxima
 * ação do plano. Sem ação, abre uma sessão livre do objetivo. Ao terminar, a
 * sessão vira atividade no eixo do objetivo e, se havia ação, ela é concluída:
 * os dois caminhos empurram as métricas dele.
 */
export function useObjectiveFocus(): (view: ObjectiveView) => Promise<void> {
  const planner = usePlanner()
  const focus = useFocus()

  return useCallback(
    async (view: ObjectiveView) => {
      const objective = view.progress.objective
      if (view.progress.state === 'pausado') await planner.setObjectivePaused(objective.id, false)

      const task = view.nextTask ?? view.plan.nextTask

      track('action_started', 'objetivos', {
        objective_id: objective.id,
        ...(task ? { action_id: task.id } : {}),
      })

      focus.start({
        axis: focusAxisOf(task, objective.axis),
        label: task?.title ?? objective.title,
        plannedMin: task ? plannedMinutesOf(task) : FREE_SESSION_MIN,
        taskId: task?.id ?? null,
      })
      focus.setImmersive(true)
    },
    [planner, focus],
  )
}
