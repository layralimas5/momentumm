import type { SupabaseClient } from '@supabase/supabase-js'
import type { HabitRepository } from '@/domain/repositories/habit-repository'
import type { Habit, NewHabit } from '@/domain/entities/habit'
import { HabitRules } from '@/domain/entities/habit'
import type { Database } from '@/infrastructure/supabase/database.types'

type HabitRow = Database['public']['Tables']['habits']['Row']

function toDomain(row: HabitRow, completedDates: string[]): Habit {
  return {
    id: row.id,
    userId: row.user_id,
    emoji: row.emoji,
    title: row.title,
    time: row.scheduled_time,
    completedDates,
    createdAt: row.created_at,
  }
}

/**
 * Implementação do HabitRepository sobre o Postgres do Supabase (com RLS).
 * Cada conclusão de dia é uma linha em habit_logs; o hábito agrega o histórico.
 */
export class SupabaseHabitRepository implements HabitRepository {
  private readonly db: SupabaseClient<Database>

  constructor(db: SupabaseClient<Database>) {
    this.db = db
  }

  async listByUser(userId: string): Promise<Habit[]> {
    const [{ data: habitRows, error: habitsError }, { data: logRows, error: logsError }] =
      await Promise.all([
        this.db.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        this.db.from('habit_logs').select('habit_id, done_on').eq('user_id', userId),
      ])
    if (habitsError) throw new Error(habitsError.message)
    if (logsError) throw new Error(logsError.message)

    const byHabit = new Map<string, string[]>()
    for (const log of logRows ?? []) {
      const list = byHabit.get(log.habit_id) ?? []
      list.push(log.done_on)
      byHabit.set(log.habit_id, list)
    }

    return (habitRows ?? []).map((row) =>
      toDomain(row, (byHabit.get(row.id) ?? []).sort()),
    )
  }

  async create(userId: string, data: NewHabit): Promise<Habit> {
    const { data: row, error } = await this.db
      .from('habits')
      .insert({
        user_id: userId,
        emoji: data.emoji?.trim() || HabitRules.defaultEmoji,
        title: data.title.trim(),
        scheduled_time: data.time ?? null,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return toDomain(row, [])
  }

  async setDone(userId: string, habitId: string, dayKey: string, done: boolean): Promise<void> {
    if (done) {
      const { error } = await this.db
        .from('habit_logs')
        .upsert(
          { habit_id: habitId, user_id: userId, done_on: dayKey },
          { onConflict: 'habit_id,done_on' },
        )
      if (error) throw new Error(error.message)
      return
    }
    const { error } = await this.db
      .from('habit_logs')
      .delete()
      .eq('habit_id', habitId)
      .eq('done_on', dayKey)
    if (error) throw new Error(error.message)
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from('habits').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }
}
