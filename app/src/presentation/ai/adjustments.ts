import type { AiRefs } from '@/domain/ai/ai-context'
import type { AiAdjustment } from '@/domain/ai/ai-service'
import { formatDayLabel, type DayKey } from '@/domain/entities/day'
import type { Habit } from '@/domain/entities/habit'
import type { Objective } from '@/domain/entities/objective'
import type { Task } from '@/domain/entities/task'

/**
 * A tradução do ajuste pra tela e pro estado: o que ele muda, em quem, e se o
 * app tem como executar. A IA fala por ref; a pessoa lê por título; o provider
 * escreve por id. Este arquivo é o tradutor entre os três, num lugar só.
 */

export interface AdjustmentTargets {
  readonly refs: AiRefs
  readonly tasks: readonly Task[]
  readonly objectives: readonly Objective[]
  readonly habits: readonly Habit[]
  readonly today: DayKey
}

export interface ResolvedAdjustment {
  readonly adjustment: AiAdjustment
  /** O título do que muda, com a mudança. Uma linha. */
  readonly label: string
  /** O item alvo por extenso, quando existe. */
  readonly target: string | null
  /** Null quando o app consegue aplicar; senão o motivo de não dar. */
  readonly blocked: string | null
  /** O que a pessoa pode editar antes de aplicar. */
  readonly editable: 'day' | 'minutes' | 'none'
}

const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

export function resolveAdjustment(
  adjustment: AiAdjustment,
  targets: AdjustmentTargets,
): ResolvedAdjustment {
  const task = (ref: string) => {
    const id = targets.refs.tasks.get(ref)
    return id ? (targets.tasks.find((item) => item.id === id) ?? null) : null
  }
  const objective = (ref: string) => {
    const id = targets.refs.objectives.get(ref)
    return id ? (targets.objectives.find((item) => item.id === id) ?? null) : null
  }
  const habit = (ref: string) => {
    const id = targets.refs.habits.get(ref)
    return id ? (targets.habits.find((item) => item.id === id) ?? null) : null
  }
  const missing = 'A IA apontou pra um item que não está mais na conta.'

  switch (adjustment.type) {
    case 'move_action': {
      const found = task(adjustment.ref)
      return {
        adjustment,
        label: `Mover pra ${formatDayLabel(adjustment.toDay, targets.today).toLowerCase()}`,
        target: found?.title ?? null,
        blocked: !found
          ? missing
          : adjustment.toDay < targets.today
            ? 'A data proposta já passou.'
            : null,
        editable: 'day',
      }
    }
    case 'shrink_action': {
      const found = task(adjustment.ref)
      return {
        adjustment,
        label: found?.minimalVersion ? `Fazer a versão mínima: ${found.minimalVersion}` : 'Fazer a versão mínima',
        target: found?.title ?? null,
        blocked: !found ? missing : found.minimalVersion ? null : 'Essa ação não tem versão mínima escrita.',
        editable: 'none',
      }
    }
    case 'set_minutes': {
      const found = task(adjustment.ref)
      return {
        adjustment,
        label: `Estimar em ${adjustment.estimatedMin} min${found ? ` (era ${found.estimatedMin})` : ''}`,
        target: found?.title ?? null,
        blocked: found ? null : missing,
        editable: 'minutes',
      }
    }
    case 'set_main_priority': {
      const found = task(adjustment.ref)
      return {
        adjustment,
        label: 'Virar a prioridade principal de hoje',
        target: found?.title ?? null,
        blocked: found ? null : missing,
        editable: 'none',
      }
    }
    case 'extend_deadline': {
      const found = objective(adjustment.ref)
      return {
        adjustment,
        label: `Prazo pra ${formatDayLabel(adjustment.toDay, targets.today)}${found ? ` (era ${formatDayLabel(found.deadline, targets.today)})` : ''}`,
        target: found?.title ?? null,
        blocked: !found
          ? missing
          : adjustment.toDay <= targets.today
            ? 'O prazo proposto não está no futuro.'
            : null,
        editable: 'day',
      }
    }
    case 'change_habit_frequency': {
      const found = habit(adjustment.ref)
      const days =
        adjustment.weekdays.length > 0
          ? adjustment.weekdays.map((day) => WEEKDAY_SHORT[day] ?? String(day)).join(', ')
          : `${adjustment.timesPerWeek}x por semana`
      return {
        adjustment,
        label: `Frequência: ${days}`,
        target: found?.name ?? null,
        blocked: found ? null : missing,
        editable: 'none',
      }
    }
    case 'create_action': {
      const linked = adjustment.objectiveRef ? objective(adjustment.objectiveRef) : null
      return {
        adjustment,
        label: `Nova ação: ${adjustment.title} (${adjustment.estimatedMin} min, ${formatDayLabel(adjustment.day, targets.today).toLowerCase()})`,
        target: linked?.title ?? null,
        blocked: adjustment.day < targets.today ? 'A data proposta já passou.' : null,
        editable: 'day',
      }
    }
  }
}

/** Devolve o ajuste com a data ou a duração trocada pela pessoa. */
export function editAdjustment(
  adjustment: AiAdjustment,
  patch: { readonly day?: DayKey; readonly minutes?: number },
): AiAdjustment {
  switch (adjustment.type) {
    case 'move_action':
    case 'extend_deadline':
      return patch.day ? { ...adjustment, toDay: patch.day } : adjustment
    case 'create_action':
      return {
        ...adjustment,
        ...(patch.day ? { day: patch.day } : {}),
        ...(patch.minutes ? { estimatedMin: patch.minutes } : {}),
      }
    case 'set_minutes':
      return patch.minutes ? { ...adjustment, estimatedMin: patch.minutes } : adjustment
    default:
      return adjustment
  }
}

export function adjustmentDay(adjustment: AiAdjustment): DayKey | null {
  switch (adjustment.type) {
    case 'move_action':
    case 'extend_deadline':
      return adjustment.toDay
    case 'create_action':
      return adjustment.day
    default:
      return null
  }
}

export function adjustmentMinutes(adjustment: AiAdjustment): number | null {
  switch (adjustment.type) {
    case 'set_minutes':
    case 'create_action':
      return adjustment.estimatedMin
    default:
      return null
  }
}
