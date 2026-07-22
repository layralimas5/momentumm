import type { HabitRepository } from '@/domain/repositories/habit-repository'
import { HabitRules, type Habit, type NewHabit } from '@/domain/entities/habit'

/**
 * Repositório de Hábitos em memória — modo demo, sem Supabase. Não persiste
 * entre reloads. Já vem com uma rotina de exemplo e histórico dos últimos dias,
 * pra sequência, porcentagem e calendário aparecerem vivos.
 */
export class InMemoryHabitRepository implements HabitRepository {
  private habits: Habit[]

  constructor(seed: Habit[] = defaultSeed()) {
    this.habits = [...seed]
  }

  async listByUser(userId: string): Promise<Habit[]> {
    return this.habits.filter((h) => h.userId === userId)
  }

  async create(userId: string, data: NewHabit): Promise<Habit> {
    const habit: Habit = {
      id: crypto.randomUUID(),
      userId,
      emoji: data.emoji?.trim() || HabitRules.defaultEmoji,
      title: data.title.trim(),
      time: data.time ?? null,
      completedDates: [],
      createdAt: new Date().toISOString(),
    }
    this.habits = [...this.habits, habit]
    return habit
  }

  async setDone(_userId: string, habitId: string, dayKey: string, done: boolean): Promise<void> {
    const habit = this.habits.find((h) => h.id === habitId)
    if (!habit) throw new Error(`Hábito ${habitId} não encontrado`)
    const set = new Set(habit.completedDates)
    if (done) set.add(dayKey)
    else set.delete(dayKey)
    habit.completedDates = [...set].sort()
  }

  async remove(id: string): Promise<void> {
    this.habits = this.habits.filter((h) => h.id !== id)
  }
}

function defaultSeed(): Habit[] {
  const today = HabitRules.dayKey()
  const createdAt = `${HabitRules.shift(today, -45)}T09:00:00.000Z`
  const done = (offsets: number[]): string[] =>
    offsets.map((o) => HabitRules.shift(today, -o)).sort()

  const habit = (
    id: string,
    emoji: string,
    title: string,
    time: string,
    offsets: number[],
  ): Habit => ({
    id,
    userId: 'demo',
    emoji,
    title,
    time,
    completedDates: done(offsets),
    createdAt,
  })

  return [
    habit('seed-habit-1', '💧', 'Água', '07:00', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
    habit('seed-habit-2', '🧴', 'Skincare', '08:00', [0, 1, 2, 4, 5, 6, 7, 9, 10, 11, 13]),
    habit('seed-habit-3', '🏋️', 'Academia', '18:00', [0, 2, 3, 5, 6, 9, 10, 12]),
    habit('seed-habit-4', '📖', 'Leitura', '22:00', [1, 2, 3, 4, 6, 7, 10, 11, 13]),
  ]
}
