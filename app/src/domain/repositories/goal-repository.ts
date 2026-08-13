import type { Goal, NewGoalInput } from '@/domain/entities/goal'

export interface GoalRepository {
  listByUser(userId: string): Promise<Goal[]>
  create(input: NewGoalInput): Promise<Goal>
  archive(id: string, userId: string): Promise<void>
}
