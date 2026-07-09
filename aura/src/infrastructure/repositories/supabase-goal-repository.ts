import type { SupabaseClient } from '@supabase/supabase-js'
import type { GoalRepository } from '@/domain/repositories/goal-repository'
import { GoalRules, type Goal, type NewGoal } from '@/domain/entities/goal'
import type { Database } from '@/infrastructure/supabase/database.types'

type GoalRow = Database['public']['Tables']['goals']['Row']

function toDomain(row: GoalRow): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    progress: row.progress,
    status: row.status,
    dueDate: row.due_date,
    createdAt: row.created_at,
  }
}

/** Implementação do GoalRepository sobre o Postgres do Supabase (com RLS). */
export class SupabaseGoalRepository implements GoalRepository {
  private readonly db: SupabaseClient<Database>

  constructor(db: SupabaseClient<Database>) {
    this.db = db
  }

  async listByUser(userId: string): Promise<Goal[]> {
    const { data, error } = await this.db
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(toDomain)
  }

  async create(userId: string, data: NewGoal): Promise<Goal> {
    const { data: row, error } = await this.db
      .from('goals')
      .insert({
        user_id: userId,
        title: data.title.trim(),
        description: data.description ?? null,
        due_date: data.dueDate ?? null,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return toDomain(row)
  }

  async updateProgress(id: string, progress: number): Promise<Goal> {
    const clamped = GoalRules.clampProgress(progress)
    const { data: row, error } = await this.db
      .from('goals')
      .update({ progress: clamped, status: clamped >= 100 ? 'completed' : 'active' })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return toDomain(row)
  }

  async complete(id: string): Promise<Goal> {
    const { data: row, error } = await this.db
      .from('goals')
      .update({ progress: 100, status: 'completed' })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return toDomain(row)
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from('goals').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }
}
