import type { GoalRepository } from '@/domain/repositories/goal-repository'
import type { BookRepository } from '@/domain/repositories/book-repository'
import type { HabitRepository } from '@/domain/repositories/habit-repository'
import type { DiaryRepository } from '@/domain/repositories/diary-repository'
import type { IdentityRepository } from '@/domain/repositories/identity-repository'
import type { ProfileRepository } from '@/domain/repositories/profile-repository'
import type { MissionRepository } from '@/domain/repositories/mission-repository'
import type { AuthService } from '@/application/auth/auth-service'
import { supabase } from '@/infrastructure/supabase/client'
import { SupabaseGoalRepository } from '@/infrastructure/repositories/supabase-goal-repository'
import { SupabaseBookRepository } from '@/infrastructure/repositories/supabase-book-repository'
import { SupabaseHabitRepository } from '@/infrastructure/repositories/supabase-habit-repository'
import { SupabaseDiaryRepository } from '@/infrastructure/repositories/supabase-diary-repository'
import { SupabaseIdentityRepository } from '@/infrastructure/repositories/supabase-identity-repository'
import { SupabaseProfileRepository } from '@/infrastructure/repositories/supabase-profile-repository'
import { SupabaseMissionRepository } from '@/infrastructure/repositories/supabase-mission-repository'
import { InMemoryGoalRepository } from '@/infrastructure/repositories/in-memory-goal-repository'
import { InMemoryBookRepository } from '@/infrastructure/repositories/in-memory-book-repository'
import { InMemoryHabitRepository } from '@/infrastructure/repositories/in-memory-habit-repository'
import { InMemoryDiaryRepository } from '@/infrastructure/repositories/in-memory-diary-repository'
import { InMemoryIdentityRepository } from '@/infrastructure/repositories/in-memory-identity-repository'
import { InMemoryProfileRepository } from '@/infrastructure/repositories/in-memory-profile-repository'
import { InMemoryMissionRepository } from '@/infrastructure/repositories/in-memory-mission-repository'
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
  readonly habits: HabitRepository
  readonly diary: DiaryRepository
  readonly identity: IdentityRepository
  readonly profiles: ProfileRepository
  readonly missions: MissionRepository
  readonly auth: AuthService
}

function build(): Container {
  if (supabase) {
    return {
      usingDemoData: false,
      goals: new SupabaseGoalRepository(supabase),
      books: new SupabaseBookRepository(supabase),
      habits: new SupabaseHabitRepository(supabase),
      diary: new SupabaseDiaryRepository(supabase),
      identity: new SupabaseIdentityRepository(supabase),
      profiles: new SupabaseProfileRepository(supabase),
      missions: new SupabaseMissionRepository(supabase),
      auth: new SupabaseAuthService(supabase),
    }
  }
  return {
    usingDemoData: true,
    goals: new InMemoryGoalRepository(),
    books: new InMemoryBookRepository(),
    habits: new InMemoryHabitRepository(),
    diary: new InMemoryDiaryRepository(),
    identity: new InMemoryIdentityRepository(),
    profiles: new InMemoryProfileRepository(),
    missions: new InMemoryMissionRepository(),
    auth: new DemoAuthService(),
  }
}

export const container: Container = build()
