import { z } from 'zod'
import { ADMIN_ROLES } from './admin-role'
import {
  ACCESS_GRANT_STATUSES,
  CANCEL_REASONS,
  CONTENT_SCOPES,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
} from '@/domain/support/support-request'

/**
 * A forma do que o banco devolve pro painel.
 *
 * Tudo que atravessa a fronteira é validado aqui. Além de tipar, os schemas
 * são a lista do que o painel PODE receber: um campo `title`, `note` ou
 * `description` de tabela pessoal não tem lugar em nenhum deles, e adicionar
 * um seria visível na revisão.
 */

const isoDate = z.string().transform((value) => new Date(value))
const nullableDate = z.string().nullable().transform((value) => (value ? new Date(value) : null))
const count = z.number().int().nonnegative()
const nullableNumber = z.number().nullable()
const role = z.enum(ADMIN_ROLES)
const planTier = z.enum(['free', 'pro'])

export const adminSessionSchema = z.object({
  role: role.nullable(),
  aal: z.enum(['aal1', 'aal2']),
  mfa_required: z.boolean().default(true),
  mfa_verified_at: nullableDate,
  session_valid: z.boolean(),
  session_expires_at: nullableDate,
  step_up_valid: z.boolean(),
  step_up_expires_at: nullableDate,
})

const periodStatsSchema = z.object({
  new_users: count,
  active_users: count,
  new_subscriptions: count,
  cancellations: count,
  ai_calls: count,
  ai_users: count,
  errors: count,
  requests_opened: count,
  onboarding_completed: count,
  activated: count,
  retention_rate: nullableNumber,
})
export type PeriodStats = z.infer<typeof periodStatsSchema>

export const overviewSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  current: periodStatsSchema,
  previous: periodStatsSchema,
  totals: z.object({
    users: count,
    free_users: count,
    pro_users: count,
    active_today: count,
    active_7d: count,
    active_30d: count,
    active_subscriptions: count,
    conversion_rate: nullableNumber,
    mrr_cents: count,
    errors_24h: count,
    errors_open: count,
    requests_pending: count,
    requests_overdue: count,
    active_access_grants: count,
  }),
  health: z.object({
    database: z.string(),
    ai_enabled: z.boolean(),
    ai_error_rate_24h: nullableNumber,
    ai_avg_ms_24h: nullableNumber,
    critical_errors_24h: count,
    maintenance: z.boolean(),
    availability_7d: nullableNumber,
  }),
  series: z.array(
    z.object({ day: z.string(), active: count, new_users: count, ai_calls: count, errors: count }),
  ),
})
export type AdminOverview = z.infer<typeof overviewSchema>

export const accountStateSchema = z.enum(['ativa', 'suspensa', 'exclusao_solicitada'])
export type AccountState = z.infer<typeof accountStateSchema>

export const userCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  handle: z.string().nullable(),
  email_masked: z.string().nullable(),
  plan: planTier.nullable(),
  status: accountStateSchema,
  status_reason: z.string().nullable(),
  status_scheduled_for: nullableDate,
  created_at: isoDate,
  last_seen_at: nullableDate,
  email_confirmed: z.boolean(),
  mfa_enabled: z.boolean(),
  onboarding_done: z.boolean(),
  objectives_count: count,
  habits_count: count,
  tasks_count: count,
  tasks_completed_7d: count,
  ai_calls_total: count,
  ai_blocked_until: nullableDate,
  open_requests: count,
  role: role.nullable(),
})
export type AdminUserCard = z.infer<typeof userCardSchema>

export const userListSchema = z.object({ total: count, items: z.array(userCardSchema) })
export type AdminUserList = z.infer<typeof userListSchema>

const requestSummarySchema = z.object({
  id: z.string().uuid(),
  protocol: z.string(),
  category: z.enum(SUPPORT_CATEGORIES),
  status: z.enum(SUPPORT_STATUSES),
  priority: z.enum(SUPPORT_PRIORITIES),
  subject: z.string(),
  opened_at: isoDate,
})

const grantSummarySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(ACCESS_GRANT_STATUSES),
  scopes: z.array(z.enum(CONTENT_SCOPES)),
  expires_at: nullableDate,
  requested_by: z.string().uuid(),
})

export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  plan: planTier,
  interval: z.enum(['mensal', 'anual']),
  status: z.enum(['trial', 'ativa', 'cancelada', 'vencida', 'inadimplente']),
  amount_cents: count,
  currency: z.string(),
  started_at: isoDate,
  current_period_end: nullableDate,
  canceled_at: nullableDate,
  trial_ends_at: nullableDate,
})
export type AdminSubscription = z.infer<typeof subscriptionSchema>

const auditEntrySchema = z.object({
  id: z.number(),
  action: z.string(),
  result: z.string(),
  reason: z.string().nullable(),
  actor_role: z.string().nullable(),
  created_at: isoDate,
})

export const userDetailSchema = userCardSchema.extend({
  requests: z.array(requestSummarySchema),
  access_grants: z.array(grantSummarySchema),
  subscriptions: z.array(subscriptionSchema).optional(),
  subscription_events: z
    .array(z.object({ type: z.string(), amount_cents: nullableNumber, occurred_at: isoDate }))
    .optional(),
  cancellations: z
    .array(z.object({ reason: z.enum(CANCEL_REASONS), status: z.string(), created_at: isoDate, tenure_days: count }))
    .optional(),
  ai_usage: z.array(z.object({ kind: z.string(), count })).optional(),
  ai_calls_month: count.optional(),
  audit: z.array(auditEntrySchema).optional(),
})
export type AdminUserDetail = z.infer<typeof userDetailSchema>

export const auditLogSchema = z.object({
  id: z.number(),
  action: z.string(),
  resource_type: z.string(),
  resource_id: z.string().nullable(),
  actor_id: z.string().uuid().nullable(),
  actor_name: z.string().nullable().optional(),
  actor_role: z.string().nullable(),
  target_user_id: z.string().uuid().nullable().optional(),
  target_name: z.string().nullable().optional(),
  result: z.string(),
  reason: z.string().nullable(),
  before: z.unknown().nullable().optional(),
  after: z.unknown().nullable().optional(),
  context: z.record(z.unknown()).optional(),
  created_at: isoDate,
})
export type AdminAuditLog = z.infer<typeof auditLogSchema>

export const auditListSchema = z.object({ total: count, items: z.array(auditLogSchema) })

export const subscriptionMetricsSchema = z.object({
  by_status: z.record(count),
  by_interval: z.record(count),
  free_users: count,
  pro_users: count,
  mrr_cents: count,
  arr_cents: count,
  events: z.record(count),
  trials_active: count,
  conversion_rate: nullableNumber,
  period_conversion: count,
  cancel_reasons: z.record(count),
  series: z.array(z.object({ day: z.string(), new: count, canceled: count, failed: count })),
})
export type AdminSubscriptionMetrics = z.infer<typeof subscriptionMetricsSchema>

export const subscriptionListSchema = z.object({
  total: count,
  items: z.array(
    subscriptionSchema.extend({
      user_id: z.string().uuid(),
      user_name: z.string().nullable(),
      email_masked: z.string().nullable(),
    }),
  ),
})
export type AdminSubscriptionList = z.infer<typeof subscriptionListSchema>

export const cancellationsSchema = z.object({
  count,
  rate: nullableNumber,
  by_reason: z.record(count),
  by_plan_interval: z.record(count),
  avg_tenure_days: nullableNumber,
  retention_attempts: count,
  retained: count,
  features_before: z.record(count),
  by_hour: z.record(count),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      user_id: z.string().uuid(),
      user_name: z.string().nullable(),
      plan: planTier,
      interval: z.enum(['mensal', 'anual']).nullable(),
      reason: z.enum(CANCEL_REASONS),
      tenure_days: count,
      created_at: isoDate,
      status: z.enum(['solicitado', 'processado', 'retido']),
      retention_attempted: z.boolean(),
      access_until: nullableDate,
      features_used: z.array(z.string()),
      comment: z.string().nullable(),
    }),
  ),
})
export type AdminCancellations = z.infer<typeof cancellationsSchema>

export const aiMetricsSchema = z.object({
  users: count,
  calls: count,
  attempts: count,
  errors: count,
  limits_hit: count,
  blocked: count,
  success_rate: nullableNumber,
  avg_duration_ms: nullableNumber,
  p95_duration_ms: nullableNumber,
  input_tokens: count,
  output_tokens: count,
  estimated_cost_usd: nullableNumber,
  calls_per_user: nullableNumber,
  by_kind: z.record(
    z.object({ ok: count, errors: count, limits: count, avg_ms: nullableNumber }),
  ),
  by_error: z.record(count),
  by_model: z.record(count),
  blocks_active: count,
  series: z.array(z.object({ day: z.string(), calls: count, users: count, errors: count })),
  limits: z.unknown().nullable(),
})
export type AdminAiMetrics = z.infer<typeof aiMetricsSchema>

export const errorSeveritySchema = z.enum(['baixa', 'media', 'alta', 'critica'])
export const errorStatusSchema = z.enum(['novo', 'analisando', 'resolvido', 'ignorado'])
export type ErrorSeverity = z.infer<typeof errorSeveritySchema>
export type ErrorStatus = z.infer<typeof errorStatusSchema>

export const appErrorSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  module: z.string(),
  environment: z.string(),
  app_version: z.string(),
  severity: errorSeveritySchema,
  status: errorStatusSchema,
  message: z.string(),
  occurrences: count,
  affected_users: count,
  first_seen_at: isoDate,
  last_seen_at: isoDate,
  resolved_at: nullableDate,
})
export type AdminAppError = z.infer<typeof appErrorSchema>

export const errorListSchema = z.object({ total: count, items: z.array(appErrorSchema) })

export const errorMetricsSchema = z.object({
  occurrences: count,
  affected_users: count,
  by_module: z.record(count),
  by_severity: z.record(count),
  by_status: z.record(count),
  ai_failures: count,
  ai_avg_ms: nullableNumber,
  payment_failures: count,
  series: z.array(z.object({ day: z.string(), occurrences: count, critical: count })),
})
export type AdminErrorMetrics = z.infer<typeof errorMetricsSchema>

export const retentionSchema = z.object({
  cohorts: z.array(
    z.object({
      week: z.string(),
      size: count,
      d1: nullableNumber,
      d7: nullableNumber,
      d14: nullableNumber,
      d30: nullableNumber,
      activated: nullableNumber,
    }),
  ),
  by_plan: z.record(z.object({ users: count, active_30d: count })),
  active: z.object({ today: count, d7: count, d30: count }),
  frequency: z.record(count),
  time_to: z.object({
    onboarding_hours: nullableNumber,
    first_objective_hours: nullableNumber,
    first_action_hours: nullableNumber,
  }),
  comebacks: count,
  recovery_started: count,
  recovery_users: count,
  conversions: count,
  cancellations: count,
  churned_users: count,
})
export type AdminRetention = z.infer<typeof retentionSchema>

export const featureUsageSchema = z.object({
  features: z.array(
    z.object({
      feature: z.string(),
      users: count,
      total: count,
      per_user: nullableNumber,
      free_users: count,
      pro_users: count,
      retention: nullableNumber,
    }),
  ),
  series: z.array(z.object({ day: z.string(), feature: z.string(), users: count })),
  records: z.record(count),
})
export type AdminFeatureUsage = z.infer<typeof featureUsageSchema>

/** O funil do quiz: sessões distintas por evento, abandono por passo, origem e tema. */
export const quizFunnelSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  stages: z.record(count),
  abandoned_by_step: z.record(count),
  by_source: z.record(count),
  by_theme: z.record(count),
})
export type AdminQuizFunnel = z.infer<typeof quizFunnelSchema>

/** Só agregados: quantas pessoas em cada nível, nunca o histórico de alguém. */
export const evolutionMetricsSchema = z.object({
  people: count,
  xpTotal: count,
  xpThisWeek: count,
  activeThisWeek: count,
  byLevel: z.array(z.object({ level: count, people: count })),
  achievements: z.array(z.object({ key: z.string(), people: count })),
})
export type AdminEvolutionMetrics = z.infer<typeof evolutionMetricsSchema>

export const requestListSchema = z.object({
  total: count,
  items: z.array(
    requestSummarySchema.extend({
      user_id: z.string().uuid(),
      user_name: z.string().nullable(),
      assignee_id: z.string().uuid().nullable(),
      assignee_name: z.string().nullable(),
      due_at: isoDate,
      overdue: z.boolean(),
      updated_at: isoDate,
    }),
  ),
})
export type AdminRequestList = z.infer<typeof requestListSchema>

export const requestDetailSchema = requestSummarySchema.extend({
  user_id: z.string().uuid(),
  user_name: z.string().nullable(),
  user_email_masked: z.string().nullable(),
  user_plan: planTier.nullable(),
  description: z.string(),
  assignee_id: z.string().uuid().nullable(),
  assignee_name: z.string().nullable(),
  due_at: isoDate,
  updated_at: isoDate,
  resolved_at: nullableDate,
  resolution: z.string().nullable(),
  events: z.array(
    z.object({
      id: z.number(),
      actor_kind: z.enum(['usuario', 'equipe', 'sistema']),
      actor_name: z.string().nullable(),
      type: z.string(),
      note: z.string().nullable(),
      created_at: isoDate,
    }),
  ),
  access_grants: z.array(
    z.object({
      id: z.string().uuid(),
      status: z.enum(ACCESS_GRANT_STATUSES),
      scopes: z.array(z.enum(CONTENT_SCOPES)),
      reason: z.string(),
      requested_by: z.string().uuid(),
      requested_at: isoDate,
      consented_at: nullableDate,
      expires_at: nullableDate,
      revoked_at: nullableDate,
      active: z.boolean(),
    }),
  ),
})
export type AdminRequestDetail = z.infer<typeof requestDetailSchema>

export const settingSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  description: z.string(),
  public: z.boolean(),
  updated_at: isoDate,
  updated_by_name: z.string().nullable(),
})
export type AdminSetting = z.infer<typeof settingSchema>

export const adminMemberSchema = z.object({
  user_id: z.string().uuid(),
  role,
  name: z.string().nullable(),
  email_masked: z.string().nullable(),
  granted_by: z.string().uuid().nullable(),
  granted_at: isoDate,
  reason: z.string().nullable(),
  mfa_enabled: z.boolean(),
})
export type AdminMember = z.infer<typeof adminMemberSchema>

/** O que a pessoa vê dos pedidos de acesso ao conteúdo dela. */
export const myAccessGrantSchema = z.object({
  id: z.string().uuid(),
  protocol: z.string(),
  subject: z.string(),
  reason: z.string(),
  scopes: z.array(z.enum(CONTENT_SCOPES)),
  duration_hours: count,
  status: z.enum(ACCESS_GRANT_STATUSES),
  requested_at: isoDate,
  expires_at: nullableDate,
  requested_by_name: z.string().nullable(),
})
export type MyAccessGrant = z.infer<typeof myAccessGrantSchema>

export const mySupportRequestSchema = z.object({
  id: z.string().uuid(),
  protocol: z.string(),
  category: z.enum(SUPPORT_CATEGORIES),
  status: z.enum(SUPPORT_STATUSES),
  subject: z.string(),
  opened_at: isoDate,
  updated_at: isoDate,
  resolution: z.string().nullable(),
})
export type MySupportRequest = z.infer<typeof mySupportRequestSchema>

export const publicSettingsSchema = z.object({
  maintenance: z.object({ enabled: z.boolean(), message: z.string() }).optional(),
  'system.message': z
    .object({ enabled: z.boolean(), text: z.string(), tone: z.enum(['info', 'aviso', 'sucesso']) })
    .optional(),
  features: z.record(z.boolean()).optional(),
  experimental: z.record(z.boolean()).optional(),
  'legal.versions': z.object({ termos: z.string(), privacidade: z.string() }).optional(),
})
export type PublicSettings = z.infer<typeof publicSettingsSchema>
