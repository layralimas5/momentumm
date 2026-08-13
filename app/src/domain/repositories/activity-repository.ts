import type { Activity, NewActivityInput } from '@/domain/entities/activity'

export interface ActivityRepository {
  listByUser(userId: string): Promise<Activity[]>
  create(input: NewActivityInput): Promise<Activity>
  remove(id: string, userId: string): Promise<void>
}
