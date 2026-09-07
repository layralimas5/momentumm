import type { AiService } from '@/domain/ai/ai-service'
import type { AuthService } from '@/domain/auth/auth-service'
import type { ActivityRepository } from '@/domain/repositories/activity-repository'
import type { ActivityTypeRepository } from '@/domain/repositories/activity-type-repository'
import type { CheckInRepository } from '@/domain/repositories/checkin-repository'
import type { GoalRepository } from '@/domain/repositories/goal-repository'
import type { HabitRepository } from '@/domain/repositories/habit-repository'
import type { JourneyEventRepository } from '@/domain/repositories/journey-event-repository'
import type { ObjectiveRepository } from '@/domain/repositories/objective-repository'
import type { PlanStageRepository } from '@/domain/repositories/plan-stage-repository'
import type { ProfileRepository } from '@/domain/repositories/profile-repository'
import type { TaskRepository } from '@/domain/repositories/task-repository'
import type { WeeklyReviewRepository } from '@/domain/repositories/weekly-review-repository'
import type { WinRepository } from '@/domain/repositories/win-repository'
import { SimulatedAiService } from './ai/simulated-ai-service'
import { isDemoMode } from './config/env'
import {
  DemoActivityRepository,
  DemoActivityTypeRepository,
  DemoAuthService,
  DemoCheckInRepository,
  DemoGoalRepository,
  DemoHabitRepository,
  DemoJourneyEventRepository,
  DemoObjectiveRepository,
  DemoPlanStageRepository,
  DemoProfileRepository,
  DemoTaskRepository,
  DemoWeeklyReviewRepository,
  DemoWinRepository,
} from './demo/demo-repositories'
import {
  SupabaseActivityRepository,
  SupabaseActivityTypeRepository,
  SupabaseAuthService,
  SupabaseCheckInRepository,
  SupabaseGoalRepository,
  SupabaseHabitRepository,
  SupabaseJourneyEventRepository,
  SupabaseObjectiveRepository,
  SupabasePlanStageRepository,
  SupabaseProfileRepository,
  SupabaseTaskRepository,
  SupabaseWeeklyReviewRepository,
  SupabaseWinRepository,
} from './supabase/supabase-repositories'

export interface Container {
  readonly auth: AuthService
  readonly activities: ActivityRepository
  readonly activityTypes: ActivityTypeRepository
  readonly goals: GoalRepository
  readonly objectives: ObjectiveRepository
  /** As etapas do plano: o degrau entre objetivo e ação. */
  readonly planStages: PlanStageRepository
  readonly profiles: ProfileRepository
  readonly habits: HabitRepository
  readonly tasks: TaskRepository
  readonly checkIns: CheckInRepository
  readonly wins: WinRepository
  readonly weeklyReviews: WeeklyReviewRepository
  /**
   * Os momentos da jornada: dia fechado, rotina cumprida, objetivo concluído.
   * É a camada que o Share Studio lê hoje e que o feed, o perfil e a comunidade
   * vão ler depois — nenhum deles fala com hábito ou objetivo direto.
   */
  readonly journeyEvents: JourneyEventRepository
  /**
   * Momentumm AI. Hoje é sempre a implementação simulada: não existe endpoint
   * de IA ainda, e chave de LLM não pode viver no frontend. Quando o endpoint
   * existir, é aqui que a troca acontece — e `simulated` deixa de ser true.
   */
  readonly ai: AiService
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
      planStages: new DemoPlanStageRepository(),
      profiles: new DemoProfileRepository(),
      habits: new DemoHabitRepository(),
      tasks: new DemoTaskRepository(),
      checkIns: new DemoCheckInRepository(),
      wins: new DemoWinRepository(),
      weeklyReviews: new DemoWeeklyReviewRepository(),
      journeyEvents: new DemoJourneyEventRepository(),
      ai: new SimulatedAiService(),
      demo: true,
    }
  : {
      auth: new SupabaseAuthService(),
      activities: new SupabaseActivityRepository(),
      activityTypes: new SupabaseActivityTypeRepository(),
      goals: new SupabaseGoalRepository(),
      objectives: new SupabaseObjectiveRepository(),
      planStages: new SupabasePlanStageRepository(),
      profiles: new SupabaseProfileRepository(),
      habits: new SupabaseHabitRepository(),
      tasks: new SupabaseTaskRepository(),
      checkIns: new SupabaseCheckInRepository(),
      wins: new SupabaseWinRepository(),
      weeklyReviews: new SupabaseWeeklyReviewRepository(),
      journeyEvents: new SupabaseJourneyEventRepository(),
      ai: new SimulatedAiService(),
      demo: false,
    }
