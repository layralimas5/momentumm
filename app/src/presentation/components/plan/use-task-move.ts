import { useCallback } from 'react'
import { resequence, type Task } from '@/domain/entities/task'
import { usePlanner } from '@/presentation/planner/use-planner'
import { moveItem } from '@/shared/lib/move-item'

/**
 * Mover uma ação de lugar dentro da lista em que ela aparece.
 *
 * A ordem é renumerada do zero a cada movimento (`resequence`): guardar a
 * posição relativa deixaria duas ações com o mesmo número na primeira inserção
 * no meio, e aí a lista passa a depender da ordem em que o banco devolve.
 */
export function useTaskMove(tasks: readonly Task[]): (from: number, to: number) => void {
  const planner = usePlanner()

  return useCallback(
    (from: number, to: number) => {
      void planner.reorderTasks(resequence(moveItem(tasks, from, to)))
    },
    [planner, tasks],
  )
}
