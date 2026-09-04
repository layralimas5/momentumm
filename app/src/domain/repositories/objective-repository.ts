import type { DayKey } from '@/domain/entities/day'
import type { NewObjectiveInput, Objective } from '@/domain/entities/objective'

export interface ObjectiveUpdate {
  readonly title?: string
  readonly target?: number
  readonly deadline?: DayKey
  readonly motive?: string | null
  readonly completedAt?: Date | null
}

export interface ObjectiveRepository {
  listByUser(userId: string): Promise<Objective[]>
  create(input: NewObjectiveInput): Promise<Objective>
  update(id: string, userId: string, changes: ObjectiveUpdate): Promise<void>
  archive(id: string, userId: string): Promise<void>
}
