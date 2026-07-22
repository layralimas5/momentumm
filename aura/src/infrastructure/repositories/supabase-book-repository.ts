import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookRepository } from '@/domain/repositories/book-repository'
import { BookRules, type Book, type NewBook, type ReadingStatus } from '@/domain/entities/book'
import type { Database } from '@/infrastructure/supabase/database.types'
import { bookRowSchema } from '@/infrastructure/supabase/schemas'
import { fromPostgrestError, parseRow, parseRows } from '@/infrastructure/supabase/parse'

type BookRow = Database['public']['Tables']['books']['Row']

function toDomain(row: BookRow): Book {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    author: row.author,
    status: row.status,
    progress: row.progress,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

/** Implementação do BookRepository sobre o Postgres do Supabase (com RLS). */
export class SupabaseBookRepository implements BookRepository {
  private readonly db: SupabaseClient<Database>

  constructor(db: SupabaseClient<Database>) {
    this.db = db
  }

  async listByUser(userId: string): Promise<Book[]> {
    const { data, error } = await this.db
      .from('books')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw fromPostgrestError(error)
    return parseRows(bookRowSchema, data, 'books').map(toDomain)
  }

  async create(userId: string, data: NewBook): Promise<Book> {
    const status = data.status ?? 'to_read'
    const { data: row, error } = await this.db
      .from('books')
      .insert({
        user_id: userId,
        title: data.title.trim(),
        author: data.author ?? null,
        status,
        progress: BookRules.progressForStatus(status),
      })
      .select('*')
      .single()
    if (error) throw fromPostgrestError(error)
    return toDomain(parseRow(bookRowSchema, row, 'books'))
  }

  async updateStatus(id: string, status: ReadingStatus): Promise<Book> {
    const { data: row, error } = await this.db
      .from('books')
      .update({ status, progress: BookRules.progressForStatus(status) })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw fromPostgrestError(error)
    return toDomain(parseRow(bookRowSchema, row, 'books'))
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from('books').delete().eq('id', id)
    if (error) throw fromPostgrestError(error)
  }
}
