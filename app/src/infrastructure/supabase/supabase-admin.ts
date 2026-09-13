import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import type {
  AdminGateway,
  AuditFilters,
  ErrorFilters,
  RequestFilters,
  RequestUpdate,
  UserActionInput,
  UserFilters,
} from '@/domain/admin/admin-gateway'
import type { AdminRole } from '@/domain/admin/admin-role'
import {
  adminMemberSchema,
  adminSessionSchema,
  aiMetricsSchema,
  auditListSchema,
  auditLogSchema,
  cancellationsSchema,
  errorListSchema,
  errorMetricsSchema,
  featureUsageSchema,
  overviewSchema,
  requestDetailSchema,
  requestListSchema,
  retentionSchema,
  settingSchema,
  subscriptionListSchema,
  subscriptionMetricsSchema,
  userDetailSchema,
  userListSchema,
  type ErrorSeverity,
  type ErrorStatus,
} from '@/domain/admin/admin-schemas'
import type { AdminSession } from '@/domain/admin/admin-session'
import type { Period } from '@/domain/admin/period'
import type { ContentScope } from '@/domain/support/support-request'
import { DomainError, InfrastructureError } from '@/shared/errors'
import { supabase } from './client'
import { rpc, rpcVoid } from './rpc'

export const ADMIN_FUNCTION_NAME = 'admin-actions'

/**
 * O painel falando com o Supabase.
 *
 * Leitura é `rpc` em função `security definer` que checa o papel na
 * primeira linha e devolve agregado ou mascarado. Ação sobre conta passa
 * pela Edge Function `admin-actions`, que guarda IP e agente no contexto da
 * auditoria e é a única que fala com o GoTrue (reenviar e-mail, apagar).
 *
 * Nenhum `.from('tabela')` aqui: o painel não lê tabela nenhuma direto, nem
 * as administrativas. Se uma tela precisar de um dado novo, nasce uma função
 * no banco com o papel checado — não uma consulta no cliente.
 */
export class SupabaseAdminGateway implements AdminGateway {
  async me(): Promise<AdminSession> {
    const raw = await rpc('admin_me', {}, adminSessionSchema)
    return {
      role: raw.role,
      aal: raw.aal,
      mfaRequired: raw.mfa_required,
      mfaVerifiedAt: raw.mfa_verified_at,
      sessionValid: raw.session_valid,
      sessionExpiresAt: raw.session_expires_at,
      stepUpValid: raw.step_up_valid,
      stepUpExpiresAt: raw.step_up_expires_at,
    }
  }

  overview(period: Period) {
    return rpc('admin_overview', { p_from: period.from, p_to: period.to }, overviewSchema)
  }

  listUsers(filters: UserFilters) {
    return rpc(
      'admin_list_users',
      {
        p_search: filters.search ?? null,
        p_plan: filters.plan ?? null,
        p_status: filters.status ?? null,
        p_onboarding: filters.onboarding ?? null,
        p_active_within_days: filters.activeWithinDays ?? null,
        p_created_from: filters.createdFrom ?? null,
        p_created_to: filters.createdTo ?? null,
        p_page: filters.page ?? 1,
        p_page_size: filters.pageSize ?? 25,
      },
      userListSchema,
    )
  }

  userDetail(userId: string) {
    return rpc('admin_user_detail', { p_user: userId }, userDetailSchema)
  }

  userLogs(userId: string) {
    return rpc('admin_user_logs', { p_user: userId, p_limit: 200 }, z.array(auditLogSchema))
  }

  exportUserAdminData(userId: string, reason: string) {
    return rpc('admin_export_user_admin_data', { p_user: userId, p_reason: reason }, z.unknown())
  }

  async runUserAction(input: UserActionInput): Promise<void> {
    const { error } = await supabase().functions.invoke(ADMIN_FUNCTION_NAME, {
      body: {
        action: input.action,
        userId: input.userId,
        reason: input.reason,
        requestId: input.requestId ?? null,
      },
    })
    if (error) throw await translateFunctionError(error)
  }

  subscriptionMetrics(period: Period) {
    return rpc('admin_subscription_metrics', { p_from: period.from, p_to: period.to }, subscriptionMetricsSchema)
  }

  listSubscriptions(status?: string, page = 1) {
    return rpc('admin_list_subscriptions', { p_status: status ?? null, p_page: page }, subscriptionListSchema)
  }

  cancellations(period: Period, page = 1) {
    return rpc('admin_cancellations', { p_from: period.from, p_to: period.to, p_page: page }, cancellationsSchema)
  }

  updateCancellation(
    id: string,
    changes: { status?: 'solicitado' | 'processado' | 'retido'; retentionAttempted?: boolean },
    reason: string,
  ) {
    return rpcVoid('admin_update_cancellation', {
      p_id: id,
      p_status: changes.status ?? null,
      p_retention_attempted: changes.retentionAttempted ?? null,
      p_reason: reason,
    })
  }

  aiMetrics(period: Period) {
    return rpc('admin_ai_metrics', { p_from: period.from, p_to: period.to }, aiMetricsSchema)
  }

  blockAi(userId: string, minutes: number, reason: string) {
    return rpcVoid('admin_block_ai', { p_user: userId, p_minutes: minutes, p_reason: reason })
  }

  unblockAi(userId: string, reason: string) {
    return rpcVoid('admin_unblock_ai', { p_user: userId, p_reason: reason })
  }

  listErrors(filters: ErrorFilters) {
    return rpc(
      'admin_list_errors',
      {
        p_status: filters.status ?? null,
        p_severity: filters.severity ?? null,
        p_module: filters.module ?? null,
        p_page: filters.page ?? 1,
      },
      errorListSchema,
    )
  }

  errorMetrics(period: Period) {
    return rpc('admin_error_metrics', { p_from: period.from, p_to: period.to }, errorMetricsSchema)
  }

  setErrorStatus(id: string, status: ErrorStatus, severity?: ErrorSeverity) {
    return rpcVoid('admin_set_error_status', { p_error: id, p_status: status, p_severity: severity ?? null })
  }

  retention(period: Period) {
    return rpc('admin_retention', { p_from: period.from, p_to: period.to }, retentionSchema)
  }

  featureUsage(period: Period) {
    return rpc('admin_feature_usage', { p_from: period.from, p_to: period.to }, featureUsageSchema)
  }

  listRequests(filters: RequestFilters) {
    return rpc(
      'admin_list_requests',
      {
        p_status: filters.status ?? null,
        p_category: filters.category ?? null,
        p_assignee: filters.assignee ?? null,
        p_page: filters.page ?? 1,
      },
      requestListSchema,
    )
  }

  requestDetail(id: string) {
    return rpc('admin_get_request', { p_request: id }, requestDetailSchema)
  }

  updateRequest(id: string, changes: RequestUpdate) {
    return rpcVoid('admin_update_request', {
      p_request: id,
      p_status: changes.status ?? null,
      p_priority: changes.priority ?? null,
      p_assignee: changes.assignee ?? null,
      p_due_at: changes.dueAt?.toISOString() ?? null,
      p_resolution: changes.resolution ?? null,
      p_note: changes.note ?? null,
    })
  }

  requestContentAccess(requestId: string, reason: string, scopes: readonly ContentScope[], hours: number) {
    return rpcVoid('admin_request_content_access', {
      p_request: requestId,
      p_reason: reason,
      p_scopes: scopes,
      p_hours: hours,
    })
  }

  readScopedContent(grantId: string) {
    return rpc('admin_read_scoped_content', { p_grant: grantId }, z.record(z.unknown()))
  }

  settings() {
    return rpc('admin_get_settings', {}, z.array(settingSchema))
  }

  updateSetting(key: string, value: unknown, reason: string) {
    return rpcVoid('admin_update_setting', { p_key: key, p_value: value, p_reason: reason })
  }

  listAdmins() {
    return rpc('admin_list_admins', {}, z.array(adminMemberSchema))
  }

  async grantRole(email: string, role: AdminRole, reason: string) {
    await rpc('admin_grant_role', { p_email: email, p_role: role, p_reason: reason }, z.unknown())
  }

  revokeRole(userId: string, reason: string) {
    return rpcVoid('admin_revoke_role', { p_user: userId, p_reason: reason })
  }

  audit(filters: AuditFilters) {
    return rpc(
      'admin_audit_list',
      {
        p_action: filters.action ?? null,
        p_actor: filters.actor ?? null,
        p_target: filters.target ?? null,
        p_page: filters.page ?? 1,
      },
      auditListSchema,
    )
  }
}

interface FunctionFailure {
  readonly error?: { readonly code?: string; readonly message?: string }
}

/** Resposta da Edge Function com corpo `{ error: { message } }` vira erro legível. */
async function translateFunctionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    if (error.context.status === 404) {
      return new DomainError('A função administrativa ainda não foi implantada nesse ambiente.')
    }
    try {
      const body = (await error.context.json()) as FunctionFailure
      if (body.error?.message) return new DomainError(body.error.message)
    } catch {
      // Sem corpo legível: cai na mensagem genérica abaixo.
    }
    return new DomainError('A ação foi recusada pelo servidor.')
  }
  if (error instanceof FunctionsFetchError) {
    return new DomainError('Não consegui falar com a função administrativa. Confere a conexão ou o deploy.')
  }
  return new InfrastructureError('Falha ao executar a ação administrativa.', error)
}
