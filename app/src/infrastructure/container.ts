import type { AuthService } from '@/domain/auth/auth-service'
import type { ActivityRepository } from '@/domain/repositories/activity-repository'
import type { GoalRepository } from '@/domain/repositories/goal-repository'
import type { ProfileRepository } from '@/domain/repositories/profile-repository'
import { isDemoMode } from './config/env'
import {
  DemoActivityRepository,
  DemoAuthService,
  DemoGoalRepository,
  DemoProfileRepository,
} from './demo/demo-repositories'
import {
  SupabaseActivityRepository,
  SupabaseAuthService,
  SupabaseGoalRepository,
  SupabaseProfileRepository,
} from './supabase/supabase-repositories'

export interface Container {
  readonly auth: AuthService
  readonly activities: ActivityRepository
  readonly goals: GoalRepository
  readonly profiles: ProfileRepository
  readonly demo: boolean
}

/** Única ponte entre domínio e mundo externo. A apresentação só conhece isso. */
export const container: Container = isDemoMode
  ? {
      auth: new DemoAuthService(),
      activities: new DemoActivityRepository(),
      goals: new DemoGoalRepository(),
      profiles: new DemoProfileRepository(),
      demo: true,
    }
  : {
      auth: new SupabaseAuthService(),
      activities: new SupabaseActivityRepository(),
      goals: new SupabaseGoalRepository(),
      profiles: new SupabaseProfileRepository(),
      demo: false,
    }
