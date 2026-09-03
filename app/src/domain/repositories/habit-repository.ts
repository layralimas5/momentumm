import type { Habit, HabitLog, HabitStatus, NewHabitInput } from '@/domain/entities/habit'
import type { DayKey } from '@/domain/entities/day'

export interface HabitRepository {
  listByUser(userId: string): Promise<Habit[]>
  create(input: NewHabitInput): Promise<Habit>
  archive(id: string, userId: string): Promise<void>
  listLogs(userId: string): Promise<HabitLog[]>
  /** Um registro por hábito e dia: marcar de novo substitui o estado anterior. */
  setStatus(
    userId: string,
    habitId: string,
    day: DayKey,
    status: HabitStatus,
  ): Promise<HabitLog>
}
