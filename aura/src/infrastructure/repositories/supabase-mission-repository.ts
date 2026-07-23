import type { SupabaseClient } from '@supabase/supabase-js'
import type { MissionRepository } from '@/domain/repositories/mission-repository'
import type { DayKey } from '@/domain/entities/day'
import type { Database } from '@/infrastructure/supabase/database.types'
import { missionCompletionRefSchema } from '@/infrastructure/supabase/schemas'
import { fromPostgrestError, parseRows } from '@/infrastructure/supabase/parse'

/**
 * Implementação do MissionRepository sobre o Postgres do Supabase (com RLS).
 * Cada conclusão de dia é uma linha em mission_completions.
 */
export class SupabaseMissionRepository implements MissionRepository {
  private readonly db: SupabaseClient<Database>

  constructor(db: SupabaseClient<Database>) {
    this.db = db
  }

  async listCompletedDates(userId: string): Promise<DayKey[]> {
    const { data, error } = await this.db
      .from('mission_completions')
      .select('done_on')
      .eq('user_id', userId)
    if (error) throw fromPostgrestError(error)
    return parseRows(missionCompletionRefSchema, data, 'mission_completions')
      .map((row) => row.done_on)
      .sort()
  }

  async setDone(userId: string, day: DayKey, done: boolean): Promise<void> {
    if (done) {
      const { error } = await this.db
        .from('mission_completions')
        .upsert({ user_id: userId, done_on: day }, { onConflict: 'user_id,done_on' })
      if (error) throw fromPostgrestError(error)
      return
    }
    const { error } = await this.db
      .from('mission_completions')
      .delete()
      .eq('user_id', userId)
      .eq('done_on', day)
    if (error) throw fromPostgrestError(error)
  }
}
