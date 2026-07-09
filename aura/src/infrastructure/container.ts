import type { GoalRepository } from '@/domain/repositories/goal-repository'
import type { BookRepository } from '@/domain/repositories/book-repository'
import type { ProfileRepository } from '@/domain/repositories/profile-repository'
import type { AuthService } from '@/application/auth/auth-service'
import { supabase } from '@/infrastructure/supabase/client'
import { SupabaseGoalRepository } from '@/infrastructure/repositories/supabase-goal-repository'
import { SupabaseBookRepository } from '@/infrastructure/repositories/supabase-book-repository'
import { SupabaseProfileRepository } from '@/infrastructure/repositories/supabase-profile-repository'
import { InMemoryGoalRepository } from '@/infrastructure/repositories/in-memory-goal-repository'
import { InMemoryBookRepository } from '@/infrastructure/repositories/in-memory-book-repository'
import { InMemoryProfileRepository } from '@/infrastructure/repositories/in-memory-profile-repository'
import { SupabaseAuthService } from '@/infrastructure/auth/supabase-auth-service'
import { DemoAuthService } from '@/infrastructure/auth/demo-auth-service'

/**
 * Composition root: monta as dependências uma única vez e entrega ao resto da
 * app via interfaces. Se o Supabase estiver configurado, usa os adapters reais
 * (auth + dados persistidos); senão, cai no modo demo (em memória).
 */
export interface Container {
  readonly usingDemoData: boolean
  readonly goals: GoalRepository
  readonly books: BookRepository
  readonly profiles: ProfileRepository
  readonly auth: AuthService
}

function build(): Container {
  if (supabase) {
    return {
      usingDemoData: false,
      goals: new SupabaseGoalRepository(supabase),
      books: new SupabaseBookRepository(supabase),
      profiles: new SupabaseProfileRepository(supabase),
      auth: new SupabaseAuthService(supabase),
    }
  }
  return {
    usingDemoData: true,
    goals: new InMemoryGoalRepository(),
    books: new InMemoryBookRepository(),
    profiles: new InMemoryProfileRepository(),
    auth: new DemoAuthService(),
  }
}

export const container: Container = build()
