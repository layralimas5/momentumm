import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { AuthService, AuthUser, Unsubscribe } from '@/application/auth/auth-service'
import type { Database } from '@/infrastructure/supabase/database.types'

function toAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null
  return { id: user.id, email: user.email ?? null }
}

/** Autenticação real via Supabase Auth. */
export class SupabaseAuthService implements AuthService {
  private readonly db: SupabaseClient<Database>

  constructor(db: SupabaseClient<Database>) {
    this.db = db
  }

  async getUser(): Promise<AuthUser | null> {
    const { data } = await this.db.auth.getSession()
    return toAuthUser(data.session?.user)
  }

  onChange(callback: (user: AuthUser | null) => void): Unsubscribe {
    const { data } = this.db.auth.onAuthStateChange((_event, session) => {
      callback(toAuthUser(session?.user))
    })
    return () => data.subscription.unsubscribe()
  }

  async signUp(email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> {
    const { data, error } = await this.db.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
    return { needsEmailConfirmation: data.session === null }
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.db.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  async signOut(): Promise<void> {
    const { error } = await this.db.auth.signOut()
    if (error) throw new Error(error.message)
  }
}
