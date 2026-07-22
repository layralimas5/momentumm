import type { Habit, NewHabit } from '@/domain/entities/habit'

/**
 * Port do repositório de Hábitos. A camada de aplicação depende dessa
 * interface, nunca de uma implementação concreta (Supabase, memória, etc.).
 */
export interface HabitRepository {
  listByUser(userId: string): Promise<Habit[]>
  create(userId: string, data: NewHabit): Promise<Habit>
  /** Marca (done=true) ou desmarca (done=false) a conclusão do dia. */
  setDone(userId: string, habitId: string, dayKey: string, done: boolean): Promise<void>
  remove(id: string): Promise<void>
}
