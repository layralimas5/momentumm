import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProfileRepository } from '@/domain/repositories/profile-repository'
import type { Profile, SubscriptionStatus } from '@/domain/entities/profile'
import type { Database } from '@/infrastructure/supabase/database.types'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

function toDomain(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    subscriptionStatus: row.subscription_status,
    plan: row.plan,
    createdAt: row.created_at,
  }
}

/** Perfis sobre o Postgres do Supabase (com RLS: usuária vê o próprio, admin vê todos). */
export class SupabaseProfileRepository implements ProfileRepository {
  private readonly db: SupabaseClient<Database>

  constructor(db: SupabaseClient<Database>) {
    this.db = db
  }

  async getMine(userId: string): Promise<Profile | null> {
    const { data, error } = await this.db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? toDomain(data) : null
  }

  async listAll(): Promise<Profile[]> {
    const { data, error } = await this.db
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(toDomain)
  }

  async setStatus(id: string, status: SubscriptionStatus): Promise<Profile> {
    const { data, error } = await this.db
      .from('profiles')
      .update({ subscription_status: status })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return toDomain(data)
  }
}
