import type { SupabaseClient } from '@supabase/supabase-js'
import type { DiaryRepository } from '@/domain/repositories/diary-repository'
import type { DiaryEntry, NewDiaryEntry } from '@/domain/entities/diary'
import type { Database } from '@/infrastructure/supabase/database.types'
import { diaryEntryRowSchema } from '@/infrastructure/supabase/schemas'
import { fromPostgrestError, parseRow, parseRows } from '@/infrastructure/supabase/parse'

type DiaryRow = Database['public']['Tables']['diary_entries']['Row']

function toDomain(row: DiaryRow): DiaryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
  }
}

/** Implementação do DiaryRepository sobre o Postgres do Supabase (com RLS). */
export class SupabaseDiaryRepository implements DiaryRepository {
  private readonly db: SupabaseClient<Database>

  constructor(db: SupabaseClient<Database>) {
    this.db = db
  }

  async listByUser(userId: string): Promise<DiaryEntry[]> {
    const { data, error } = await this.db
      .from('diary_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw fromPostgrestError(error)
    return parseRows(diaryEntryRowSchema, data, 'diary_entries').map(toDomain)
  }

  async create(userId: string, data: NewDiaryEntry): Promise<DiaryEntry> {
    const { data: row, error } = await this.db
      .from('diary_entries')
      .insert({ user_id: userId, content: data.content.trim() })
      .select('*')
      .single()
    if (error) throw fromPostgrestError(error)
    return toDomain(parseRow(diaryEntryRowSchema, row, 'diary_entries'))
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from('diary_entries').delete().eq('id', id)
    if (error) throw fromPostgrestError(error)
  }
}
