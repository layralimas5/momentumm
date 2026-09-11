import { useCallback, useMemo, useState } from 'react'
import type { AiRefs } from '@/domain/ai/ai-context'
import type { AiAdjustment } from '@/domain/ai/ai-service'
import { shrinkToMinimal } from '@/domain/entities/task'
import { usePlanner } from '@/presentation/planner/use-planner'
import { toUserMessage } from '@/shared/errors'
import { resolveAdjustment, type AdjustmentTargets, type ResolvedAdjustment } from './adjustments'

export interface ApplyOutcome {
  readonly applied: number
  /** O que não foi aplicado, com o motivo. A pessoa vê a lista, nunca um "deu certo" pela metade. */
  readonly failed: readonly { readonly label: string; readonly reason: string }[]
}

/**
 * Aplicar o que a pessoa aceitou.
 *
 * Um ajuste por vez, pelas MESMAS funções do provider que a tela usa (mover,
 * encolher, priorizar, prazo, frequência, criar): a IA não tem caminho
 * próprio pro banco. Um ajuste que falha não derruba os outros — cada um é
 * uma decisão que ela tomou — e o resultado diz exatamente o que entrou.
 *
 * `set_main_priority` vai por último de propósito: a prioridade é uma por
 * dia, e movê-la antes de mover as outras ações deixaria a antiga prioridade
 * sem o rebaixamento que o provider faz ao promover.
 */
export function useAiAdjustments(refs: AiRefs) {
  const planner = usePlanner()
  const [applying, setApplying] = useState(false)
  const [outcome, setOutcome] = useState<ApplyOutcome | null>(null)

  const targets = useMemo<AdjustmentTargets>(
    () => ({
      refs,
      tasks: planner.tasks,
      objectives: planner.objectives,
      habits: planner.habits,
      today: planner.today,
    }),
    [refs, planner.tasks, planner.objectives, planner.habits, planner.today],
  )

  const resolve = useCallback(
    (adjustments: readonly AiAdjustment[]): ResolvedAdjustment[] =>
      adjustments.map((adjustment) => resolveAdjustment(adjustment, targets)),
    [targets],
  )

  const applyOne = useCallback(
    async (adjustment: AiAdjustment) => {
      const taskId = 'ref' in adjustment ? refs.tasks.get(adjustment.ref) : undefined

      switch (adjustment.type) {
        case 'move_action': {
          if (!taskId) throw new Error('missing')
          await planner.updateTask(taskId, {
            day: adjustment.toDay,
            ...(adjustment.toDay !== planner.today ? { isMainPriority: false } : {}),
          })
          return
        }
        case 'shrink_action': {
          const task = planner.tasks.find((item) => item.id === taskId)
          if (!task) throw new Error('missing')
          const smaller = shrinkToMinimal(task)
          await planner.updateTask(task.id, {
            title: smaller.title,
            minimalVersion: null,
            estimatedMin: smaller.estimatedMin,
            effort: smaller.effort,
          })
          return
        }
        case 'set_minutes': {
          if (!taskId) throw new Error('missing')
          await planner.updateTask(taskId, { estimatedMin: adjustment.estimatedMin })
          return
        }
        case 'set_main_priority': {
          if (!taskId) throw new Error('missing')
          await planner.updateTask(taskId, { isMainPriority: true, day: planner.today })
          return
        }
        case 'extend_deadline': {
          const objectiveId = refs.objectives.get(adjustment.ref)
          if (!objectiveId) throw new Error('missing')
          await planner.updateObjective(objectiveId, { deadline: adjustment.toDay })
          return
        }
        case 'change_habit_frequency': {
          const habitId = refs.habits.get(adjustment.ref)
          if (!habitId) throw new Error('missing')
          const fixedDays = adjustment.weekdays.length > 0
          await planner.updateHabit(habitId, {
            frequency:
              fixedDays && adjustment.weekdays.length === 7
                ? 'diario'
                : fixedDays
                  ? 'dias-semana'
                  : 'vezes-semana',
            weekdays: adjustment.weekdays,
            timesPerWeek: adjustment.timesPerWeek,
          })
          return
        }
        case 'create_action': {
          const objectiveId = adjustment.objectiveRef
            ? (refs.objectives.get(adjustment.objectiveRef) ?? null)
            : null
          await planner.createTask({
            title: adjustment.title,
            day: adjustment.day,
            estimatedMin: adjustment.estimatedMin,
            minimalVersion: adjustment.minimalVersion,
            objectiveId,
          })
          return
        }
      }
    },
    [planner, refs],
  )

  const apply = useCallback(
    async (accepted: readonly AiAdjustment[]): Promise<ApplyOutcome> => {
      setApplying(true)
      const failed: { label: string; reason: string }[] = []
      let applied = 0

      const ordered = [
        ...accepted.filter((item) => item.type !== 'set_main_priority'),
        ...accepted.filter((item) => item.type === 'set_main_priority'),
      ]

      try {
        for (const adjustment of ordered) {
          const resolved = resolveAdjustment(adjustment, targets)
          if (resolved.blocked) {
            failed.push({ label: resolved.label, reason: resolved.blocked })
            continue
          }
          try {
            await applyOne(adjustment)
            applied += 1
          } catch (cause) {
            failed.push({
              label: resolved.label,
              reason:
                cause instanceof Error && cause.message === 'missing'
                  ? 'Esse item não está mais na conta.'
                  : toUserMessage(cause),
            })
          }
        }
      } finally {
        setApplying(false)
      }

      const result = { applied, failed }
      setOutcome(result)
      return result
    },
    [applyOne, targets],
  )

  const reset = useCallback(() => setOutcome(null), [])

  return { resolve, apply, applying, outcome, reset }
}
