import type { AiService } from '@/domain/ai/ai-service'
import type { AuthService } from '@/domain/auth/auth-service'
import type { ActivityRepository } from '@/domain/repositories/activity-repository'
import type { ActivityTypeRepository } from '@/domain/repositories/activity-type-repository'
import type { ChallengeRepository } from '@/domain/repositories/challenge-repository'
import type { CheckInRepository } from '@/domain/repositories/checkin-repository'
import type { GoalRepository } from '@/domain/repositories/goal-repository'
import type { FriendshipRepository } from '@/domain/repositories/friendship-repository'
import type { HabitRepository } from '@/domain/repositories/habit-repository'
import type { JourneyEventRepository } from '@/domain/repositories/journey-event-repository'
import type { ObjectiveRepository } from '@/domain/repositories/objective-repository'
import type { PlanStageRepository } from '@/domain/repositories/plan-stage-repository'
import type { ProfileRepository } from '@/domain/repositories/profile-repository'
import type { TaskRepository } from '@/domain/repositories/task-repository'
import type { WeeklyReviewRepository } from '@/domain/repositories/weekly-review-repository'
import type { WinRepository } from '@/domain/repositories/win-repository'
import { SimulatedAiService } from './ai/simulated-ai-service'
import type { LegalAcceptanceRepository } from '@/domain/repositories/legal-acceptance-repository'
import type { MediaRepository } from '@/domain/repositories/media-repository'
import type { SupportRepository } from '@/domain/repositories/support-repository'
import type { AdminGateway } from '@/domain/admin/admin-gateway'
import { SupabaseAdminGateway } from './supabase/supabase-admin'
import { SupabaseSupportRepository } from './supabase/supabase-support'
import { DemoAdminGateway, DemoSupportRepository } from './demo/demo-support'
import { SupabaseLegalAcceptanceRepository } from './supabase/supabase-legal'
import { SupabaseMediaRepository } from './supabase/supabase-media'
import { SupabaseAiService } from './ai/supabase-ai-service'
import type { BillingService } from '@/domain/billing/billing-service'
import { DemoBillingService } from './billing/demo-billing-service'
import { SupabaseBillingService } from './billing/supabase-billing-service'
import { isDemoMode } from './config/env'
import {
  DemoActivityRepository,
  DemoActivityTypeRepository,
  DemoAuthService,
  DemoChallengeRepository,
  DemoCheckInRepository,
  DemoGoalRepository,
  DemoFriendshipRepository,
  DemoHabitRepository,
  DemoJourneyEventRepository,
  DemoObjectiveRepository,
  DemoPlanStageRepository,
  DemoProfileRepository,
  DemoTaskRepository,
  DemoLegalAcceptanceRepository,
  DemoMediaRepository,
  DemoWeeklyReviewRepository,
  DemoWinRepository,
} from './demo/demo-repositories'
import {
  SupabaseActivityRepository,
  SupabaseActivityTypeRepository,
  SupabaseAuthService,
  SupabaseChallengeRepository,
  SupabaseCheckInRepository,
  SupabaseGoalRepository,
  SupabaseFriendshipRepository,
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
  /** O Círculo: amizades e a busca por gente. */
  readonly friendships: FriendshipRepository
  /**
   * Os desafios entre amigos e quem está em cada um. O progresso de cada
   * pessoa é publicado por ela mesma: aqui não se lê a rotina de ninguém.
   */
  readonly challenges: ChallengeRepository
  /**
   * Momentumm AI. No modo demo é a implementação simulada (regras fixas,
   * avisada na tela); com Supabase é a Edge Function `momentumm-ai`, que é
   * onde a chave do modelo mora. Chave de LLM não passa pelo frontend.
   */
  readonly ai: AiService
  /** Aceite dos Termos e da Política, por versão. Só leitura e gravação do próprio. */
  readonly legal: LegalAcceptanceRepository
  /** Fotos, áudios e anexos, em bucket privado com link assinado. */
  readonly media: MediaRepository
  /** Solicitações, acesso excepcional e cancelamento, pelo lado da pessoa. */
  readonly support: SupportRepository
  /**
   * O painel administrativo. Só existe de verdade com Supabase: no modo demo
   * a implementação recusa tudo, porque painel com número inventado é pior
   * que painel nenhum.
   */
  readonly admin: AdminGateway
  /**
   * A assinatura do PRO, pelo Asaas. O app abre o checkout e lê a
   * assinatura; quem escreve o plano é o webhook, no servidor.
   */
  readonly billing: BillingService
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
      friendships: new DemoFriendshipRepository(),
      challenges: new DemoChallengeRepository(),
      ai: new SimulatedAiService(),
      legal: new DemoLegalAcceptanceRepository(),
      media: new DemoMediaRepository(),
      support: new DemoSupportRepository(),
      admin: new DemoAdminGateway(),
      billing: new DemoBillingService(),
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
      friendships: new SupabaseFriendshipRepository(),
      challenges: new SupabaseChallengeRepository(),
      ai: new SupabaseAiService(),
      legal: new SupabaseLegalAcceptanceRepository(),
      media: new SupabaseMediaRepository(),
      support: new SupabaseSupportRepository(),
      admin: new SupabaseAdminGateway(),
      billing: new SupabaseBillingService(),
      demo: false,
    }
