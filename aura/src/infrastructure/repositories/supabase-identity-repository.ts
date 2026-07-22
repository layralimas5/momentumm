import type { SupabaseClient } from '@supabase/supabase-js'
import type { IdentityRepository } from '@/domain/repositories/identity-repository'
import type { Identity, IdentityAnswers } from '@/domain/entities/identity'
import type { Database } from '@/infrastructure/supabase/database.types'
import { identityRowSchema } from '@/infrastructure/supabase/schemas'
import { fromPostgrestError, parseRow } from '@/infrastructure/supabase/parse'

type IdentityRow = Database['public']['Tables']['identities']['Row']

function toDomain(row: IdentityRow): Identity {
  return {
    userId: row.user_id,
    becoming: row.becoming,
    morning: row.morning,
    dressing: row.dressing,
    daily: row.daily,
    neverAgain: row.never_again,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Implementação do IdentityRepository sobre o Postgres do Supabase (com RLS). */
export class SupabaseIdentityRepository implements IdentityRepository {
  private readonly db: SupabaseClient<Database>

  constructor(db: SupabaseClient<Database>) {
    this.db = db
  }

  async get(userId: string): Promise<Identity | null> {
    const { data, error } = await this.db
      .from('identities')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw fromPostgrestError(error)
    return data ? toDomain(parseRow(identityRowSchema, data, 'identities')) : null
  }

  async save(userId: string, answers: IdentityAnswers): Promise<Identity> {
    const { data: row, error } = await this.db
      .from('identities')
      .upsert(
        {
          user_id: userId,
          becoming: answers.becoming,
          morning: answers.morning,
          dressing: answers.dressing,
          daily: answers.daily,
          never_again: answers.neverAgain,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single()
    if (error) throw fromPostgrestError(error)
    return toDomain(parseRow(identityRowSchema, row, 'identities'))
  }
}
