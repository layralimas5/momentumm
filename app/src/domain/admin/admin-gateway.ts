import type { AdminRole } from './admin-role'
import type {
  AccountState,
  AdminAiMetrics,
  AdminAppError,
  AdminAuditLog,
  AdminCancellations,
  AdminErrorMetrics,
  AdminEvolutionMetrics,
  AdminFeatureUsage,
  AdminMember,
  AdminOverview,
  AdminQuizFunnel,
  AdminRequestDetail,
  AdminRequestList,
  AdminRetention,
  AdminSetting,
  AdminSubscriptionList,
  AdminSubscriptionMetrics,
  AdminUserDetail,
  AdminUserList,
  ErrorSeverity,
  ErrorStatus,
} from './admin-schemas'
import type { AdminSession } from './admin-session'
import type { Period } from './period'
import type {
  ContentScope,
  SupportCategory,
  SupportPriority,
  SupportStatus,
} from '@/domain/support/support-request'

export interface UserFilters {
  readonly search?: string | undefined
  readonly plan?: 'free' | 'pro' | undefined
  readonly status?: AccountState | undefined
  readonly onboarding?: boolean | undefined
  readonly activeWithinDays?: number | undefined
  readonly createdFrom?: string | undefined
  readonly createdTo?: string | undefined
  readonly page?: number | undefined
  readonly pageSize?: number | undefined
}

export interface RequestFilters {
  readonly status?: SupportStatus | undefined
  readonly category?: SupportCategory | undefined
  readonly assignee?: string | undefined
  readonly page?: number | undefined
}

export interface RequestUpdate {
  readonly status?: SupportStatus | undefined
  readonly priority?: SupportPriority | undefined
  readonly assignee?: string | undefined
  readonly dueAt?: Date | undefined
  readonly resolution?: string | undefined
  readonly note?: string | undefined
}

export interface ErrorFilters {
  readonly status?: ErrorStatus | undefined
  readonly severity?: ErrorSeverity | undefined
  readonly module?: string | undefined
  readonly page?: number | undefined
}

export interface AuditFilters {
  readonly action?: string | undefined
  readonly actor?: string | undefined
  readonly target?: string | undefined
  readonly page?: number | undefined
}

export type UserAction =
  | 'suspend'
  | 'reactivate'
  | 'revoke_sessions'
  | 'resend_confirmation'
  | 'start_deletion'
  | 'complete_deletion'

export interface UserActionInput {
  readonly action: UserAction
  readonly userId: string
  readonly reason: string
  /** Só em `start_deletion`: a solicitação de exclusão aberta pela pessoa. */
  readonly requestId?: string
}

/**
 * A porta do painel administrativo.
 *
 * Toda leitura é agregada ou mascarada no servidor; toda ação passa por
 * função com papel checado no banco ou pela Edge Function `admin-actions`.
 * O front não conhece tabela nenhuma: ele conhece esta interface.
 */
export interface AdminGateway {
  me(): Promise<AdminSession>

  overview(period: Period): Promise<AdminOverview>
  listUsers(filters: UserFilters): Promise<AdminUserList>
  userDetail(userId: string): Promise<AdminUserDetail>
  userLogs(userId: string): Promise<readonly AdminAuditLog[]>
  exportUserAdminData(userId: string, reason: string): Promise<unknown>
  runUserAction(input: UserActionInput): Promise<void>
  /**
   * Convida uma pessoa por e-mail: o GoTrue manda o link, ela escolhe a
   * senha. Serve pro caso raro de cadastrar alguém pela equipe; o caminho
   * normal continua sendo a pessoa criar a própria conta.
   */
  inviteUser(email: string, name: string, reason: string): Promise<void>

  subscriptionMetrics(period: Period): Promise<AdminSubscriptionMetrics>
  listSubscriptions(status?: string, page?: number): Promise<AdminSubscriptionList>
  cancellations(period: Period, page?: number): Promise<AdminCancellations>
  updateCancellation(
    id: string,
    changes: { status?: 'solicitado' | 'processado' | 'retido'; retentionAttempted?: boolean },
    reason: string,
  ): Promise<void>

  aiMetrics(period: Period): Promise<AdminAiMetrics>
  blockAi(userId: string, minutes: number, reason: string): Promise<void>
  unblockAi(userId: string, reason: string): Promise<void>

  listErrors(filters: ErrorFilters): Promise<{ total: number; items: readonly AdminAppError[] }>
  errorMetrics(period: Period): Promise<AdminErrorMetrics>
  setErrorStatus(id: string, status: ErrorStatus, severity?: ErrorSeverity): Promise<void>

  retention(period: Period): Promise<AdminRetention>
  featureUsage(period: Period): Promise<AdminFeatureUsage>
  /** Funil de aquisição pelo quiz (`/criar-meu-plano`), agregado por sessão. */
  quizFunnel(period: Period): Promise<AdminQuizFunnel>
  /** Distribuição por nível e XP da semana. Agregado, sem dado individual. */
  evolutionMetrics(): Promise<AdminEvolutionMetrics>

  listRequests(filters: RequestFilters): Promise<AdminRequestList>
  requestDetail(id: string): Promise<AdminRequestDetail>
  updateRequest(id: string, changes: RequestUpdate): Promise<void>
  requestContentAccess(
    requestId: string,
    reason: string,
    scopes: readonly ContentScope[],
    hours: number,
  ): Promise<void>
  readScopedContent(grantId: string): Promise<Record<string, unknown>>

  settings(): Promise<readonly AdminSetting[]>
  updateSetting(key: string, value: unknown, reason: string): Promise<void>

  listAdmins(): Promise<readonly AdminMember[]>
  grantRole(email: string, role: AdminRole, reason: string): Promise<void>
  revokeRole(userId: string, reason: string): Promise<void>

  audit(filters: AuditFilters): Promise<{ total: number; items: readonly AdminAuditLog[] }>
}
