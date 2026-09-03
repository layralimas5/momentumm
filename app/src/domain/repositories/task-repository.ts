import type { NewTaskInput, Task } from '@/domain/entities/task'

export type TaskUpdate = Partial<
  Pick<
    Task,
    'title' | 'goalId' | 'axis' | 'estimatedMin' | 'effort' | 'minimalVersion' | 'day' | 'isMainPriority' | 'status' | 'completedAt'
  >
>

export interface TaskRepository {
  listByUser(userId: string): Promise<Task[]>
  create(input: NewTaskInput): Promise<Task>
  update(id: string, userId: string, changes: TaskUpdate): Promise<Task>
  remove(id: string, userId: string): Promise<void>
}
