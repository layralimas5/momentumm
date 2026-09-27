import type { DayKey } from '@/domain/entities/day'
import type {
  NewRoutineItemInput,
  RoutineItem,
  RoutineOccurrence,
  RoutineStatus,
} from '@/domain/entities/routine-item'

export type RoutineItemUpdate = Partial<
  Pick<
    RoutineItem,
    | 'title'
    | 'note'
    | 'category'
    | 'timeOfDay'
    | 'dayPart'
    | 'durationMin'
    | 'recurrence'
    | 'weekdays'
    | 'day'
    | 'objectiveId'
    | 'reminderMin'
    | 'order'
    | 'pausedAt'
  >
>

/**
 * O que se escreve numa ocorrência.
 *
 * `status` é o único obrigatório: marcar, pular e reagendar são todos a mesma
 * operação, uma linha por item e dia. `timeOverride` e `movedToDay` carregam a
 * decisão de reagendar, que vale SÓ naquele dia, e é o que separa "hoje eu
 * treino às 20h" de "meu treino agora é às 20h" (esse último é update do item).
 */
export interface RoutineOccurrencePatch {
  readonly status: RoutineStatus
  readonly plannedTime?: string | null
  readonly timeOverride?: string | null
  readonly movedToDay?: DayKey | null
}

export interface RoutineRepository {
  listItems(userId: string): Promise<RoutineItem[]>
  createItem(input: NewRoutineItemInput): Promise<RoutineItem>
  updateItem(id: string, userId: string, changes: RoutineItemUpdate): Promise<RoutineItem>
  archiveItem(id: string, userId: string): Promise<void>
  listOccurrences(userId: string): Promise<RoutineOccurrence[]>
  /** Uma linha por item e dia: marcar de novo substitui o estado anterior. */
  setOccurrence(
    userId: string,
    itemId: string,
    day: DayKey,
    patch: RoutineOccurrencePatch,
  ): Promise<RoutineOccurrence>
}
