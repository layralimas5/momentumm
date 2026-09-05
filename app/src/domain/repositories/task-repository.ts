import type { NewTaskInput, Task } from '@/domain/entities/task'

export type TaskUpdate = Partial<
  Pick<
    Task,
    | 'title'
    | 'description'
    | 'goalId'
    | 'objectiveId'
    | 'axis'
    | 'estimatedMin'
    | 'effort'
    | 'priority'
    | 'minimalVersion'
    | 'day'
    | 'timeOfDay'
    | 'order'
    | 'dependsOnId'
    | 'isMainPriority'
    | 'status'
    | 'completedAt'
  >
>

export interface TaskReorder {
  readonly id: string
  readonly order: number
}

export interface TaskRepository {
  listByUser(userId: string): Promise<Task[]>
  create(input: NewTaskInput): Promise<Task>
  update(id: string, userId: string, changes: TaskUpdate): Promise<Task>
  /**
   * Reordena várias ações de uma vez. Arrastar uma linha muda a posição de
   * todas as outras, e mandar uma requisição por ação deixaria a lista em
   * estados intermediários visíveis se qualquer uma falhasse.
   */
  reorder(userId: string, items: readonly TaskReorder[]): Promise<void>
  remove(id: string, userId: string): Promise<void>
}
