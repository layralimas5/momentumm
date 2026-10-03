import { useCallback, useState } from 'react'
import { activityType, type ActivityType, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { AgendaItem } from '@/domain/entities/day-agenda'
import { XP_RULES } from '@/domain/entities/evolution'
import type { FocusItem } from '@/presentation/planner/use-dashboard'
import { usePlanner } from '@/presentation/planner/use-planner'

/** O XP que a linha rende ao ser concluída. Rotina não gera XP no Momentumm. */
export function xpOf(item: {
  readonly kind: 'acao' | 'habito' | 'rotina'
  readonly isMainPriority?: boolean
}): number | undefined {
  if (item.kind === 'habito') return XP_RULES.habit_done.points
  if (item.kind === 'acao') {
    return item.isMainPriority ? XP_RULES.priority_done.points : XP_RULES.task_done.points
  }
  return undefined
}

export function axisLabel(axes: readonly ActivityType[], slug: ActivityTypeSlug | null | undefined): string | null {
  if (!slug) return null
  return axes.find((axis) => axis.slug === slug)?.label ?? activityType(slug).label
}

/** O eixo de uma linha do foco, quando existe. */
export function axisOfFocus(item: FocusItem): ActivityTypeSlug | null {
  if (item.task) return item.task.axis
  if (item.habitState) return item.habitState.habit.axis
  return null
}

/**
 * Marcar e desmarcar uma linha do dia, seja ação, hábito ou rotina.
 *
 * É a MESMA escrita que a Rotina faz: marcar aqui e marcar lá são o mesmo
 * registro, e por isso as duas telas nunca discordam.
 */
export function useDayToggle() {
  const planner = usePlanner()
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const toggleAgenda = useCallback(
    async (item: AgendaItem) => {
      setBusyKey(item.key)
      try {
        if (item.task) {
          await planner.setTaskDone(item.task.id, !item.done)
        } else if (item.habitState) {
          await planner.setHabitStatus(item.habitState.habit.id, item.done ? 'pendente' : 'feito')
        } else if (item.routineState) {
          await planner.setRoutineStatus(item.routineState.item.id, {
            status: item.done ? 'pendente' : 'feito',
            plannedTime: item.time,
          })
        }
      } finally {
        setBusyKey(null)
      }
    },
    [planner],
  )

  const toggleFocus = useCallback(
    async (item: FocusItem) => {
      const key = `${item.kind}-${item.id}`
      setBusyKey(key)
      try {
        if (item.task) {
          await planner.setTaskDone(item.task.id, !item.done)
        } else if (item.habitState) {
          await planner.setHabitStatus(item.habitState.habit.id, item.done ? 'pendente' : 'feito')
        }
      } finally {
        setBusyKey(null)
      }
    },
    [planner],
  )

  return { busyKey, toggleAgenda, toggleFocus }
}

/** "1h30m", "45 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}m`
}

export function clockOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
