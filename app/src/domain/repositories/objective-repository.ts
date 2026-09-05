import type { DayKey } from '@/domain/entities/day'
import type { NewObjectiveInput, Objective } from '@/domain/entities/objective'
import type { Priority } from '@/domain/entities/priority'

export interface ObjectiveUpdate {
  readonly title?: string
  readonly description?: string | null
  readonly target?: number
  readonly deadline?: DayKey
  readonly motive?: string | null
  readonly priority?: Priority
  readonly completedAt?: Date | null
  /** Pausar e retomar é o mesmo campo: data pra pausar, `null` pra voltar. */
  readonly pausedAt?: Date | null
}

export interface ObjectiveRepository {
  listByUser(userId: string): Promise<Objective[]>
  create(input: NewObjectiveInput): Promise<Objective>
  update(id: string, userId: string, changes: ObjectiveUpdate): Promise<void>
  archive(id: string, userId: string): Promise<void>
}
