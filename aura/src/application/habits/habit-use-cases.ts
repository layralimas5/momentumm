import type { HabitRepository } from '@/domain/repositories/habit-repository'
import { HabitRules, type Habit, type NewHabit } from '@/domain/entities/habit'

/**
 * Casos de uso de Hábitos. Orquestram regras de domínio + repositório, sem
 * conhecer UI nem banco. Recebem o port por injeção de dependência.
 */
export function createHabitUseCases(repo: HabitRepository) {
  return {
    list(userId: string): Promise<Habit[]> {
      return repo.listByUser(userId)
    },

    async create(userId: string, data: NewHabit): Promise<Habit> {
      if (!HabitRules.isValidTitle(data.title)) {
        throw new Error('O hábito precisa ter entre 2 e 80 caracteres.')
      }
      return repo.create(userId, {
        emoji: data.emoji?.trim() || HabitRules.defaultEmoji,
        title: data.title.trim(),
        time: data.time ?? null,
      })
    },

    /** Alterna a conclusão do hábito no dia informado. */
    toggle(habit: Habit, dayKey: string): Promise<void> {
      const done = HabitRules.isDoneOn(habit, dayKey)
      return repo.setDone(habit.userId, habit.id, dayKey, !done)
    },

    remove(id: string): Promise<void> {
      return repo.remove(id)
    },
  }
}

export type HabitUseCases = ReturnType<typeof createHabitUseCases>
