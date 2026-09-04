import type { AuthService } from '@/domain/auth/auth-service'
import type { ActivityRepository } from '@/domain/repositories/activity-repository'
import type { ActivityTypeRepository } from '@/domain/repositories/activity-type-repository'
import type { CheckInRepository } from '@/domain/repositories/checkin-repository'
import type { GoalRepository } from '@/domain/repositories/goal-repository'
import type { HabitRepository } from '@/domain/repositories/habit-repository'
import type { ObjectiveRepository } from '@/domain/repositories/objective-repository'
import type { ProfileRepository } from '@/domain/repositories/profile-repository'
import type { TaskRepository } from '@/domain/repositories/task-repository'
import type { WinRepository } from '@/domain/repositories/win-repository'
import { isDemoMode } from './config/env'
import {
  DemoActivityRepository,
  DemoActivityTypeRepository,
  DemoAuthService,
  DemoCheckInRepository,
  DemoGoalRepository,
  DemoHabitRepository,
  DemoObjectiveRepository,
  DemoProfileRepository,
  DemoTaskRepository,
  DemoWinRepository,
} from './demo/demo-repositories'
import {
  SupabaseActivityRepository,
  SupabaseActivityTypeRepository,
  SupabaseAuthService,
  SupabaseCheckInRepository,
  SupabaseGoalRepository,
  SupabaseHabitRepository,
  SupabaseObjectiveRepository,
  SupabaseProfileRepository,
  SupabaseTaskRepository,
  SupabaseWinRepository,
} from './supabase/supabase-repositories'

export interface Container {
  readonly auth: AuthService
  readonly activities: ActivityRepository
  readonly activityTypes: ActivityTypeRepository
  readonly goals: GoalRepository
  readonly objectives: ObjectiveRepository
  readonly profiles: ProfileRepository
  readonly habits: HabitRepository
  readonly tasks: TaskRepository
  readonly checkIns: CheckInRepository
  readonly wins: WinRepository
  readonly demo: boolean
}

/** Única ponte entre domínio e mundo externo. A apresentação só conhece isso. */
export const container: Container = isDemoMode
  ? {
      auth: new DemoAuthService(),
      activities: new DemoActivityRepository(),
      activityTypes: new DemoActivityTypeRepository(),
      goals: new DemoGoalRepository(),
      objectives: new DemoObjectiveRepository(),
      profiles: new DemoProfileRepository(),
      habits: new DemoHabitRepository(),
      tasks: new DemoTaskRepository(),
      checkIns: new DemoCheckInRepository(),
      wins: new DemoWinRepository(),
      demo: true,
    }
  : {
      auth: new SupabaseAuthService(),
      activities: new SupabaseActivityRepository(),
      activityTypes: new SupabaseActivityTypeRepository(),
      goals: new SupabaseGoalRepository(),
      objectives: new SupabaseObjectiveRepository(),
      profiles: new SupabaseProfileRepository(),
      habits: new SupabaseHabitRepository(),
      tasks: new SupabaseTaskRepository(),
      checkIns: new SupabaseCheckInRepository(),
      wins: new SupabaseWinRepository(),
      demo: false,
    }
