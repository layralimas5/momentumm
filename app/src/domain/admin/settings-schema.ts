import { z } from 'zod'

/**
 * A forma de cada configuração do produto. Espelha `public.validate_setting`:
 * o painel recusa antes de enviar, o banco recusa de novo ao gravar.
 */
const planLimits = z
  .object({
    activeObjectives: z.number().int().positive().nullable(),
    activeHabits: z.number().int().positive().nullable(),
    activePlans: z.number().int().positive().nullable(),
    actionsPerDay: z.number().int().positive().nullable(),
    historyDays: z.number().int().positive().nullable(),
  })
  .strict()

const aiLimits = z
  .object({
    enabled: z.boolean(),
    monthlyPerPlan: z.object({ free: z.number().int().nonnegative(), pro: z.number().int().nonnegative() }).strict(),
    dailySafetyLimit: z.number().int().positive(),
    perMinute: z.number().int().positive(),
    costAlertUsd: z.number().nonnegative(),
    costPerMillionInputUsd: z.number().nonnegative().nullable(),
    costPerMillionOutputUsd: z.number().nonnegative().nullable(),
    abuseBlockMinutes: z.number().int().positive(),
    kinds: z.record(z.boolean()),
  })
  .strict()

const flags = z.record(z.boolean())

const maintenance = z.object({ enabled: z.boolean(), message: z.string().max(280) }).strict()

const systemMessage = z
  .object({ enabled: z.boolean(), text: z.string().max(280), tone: z.enum(['info', 'aviso', 'sucesso']) })
  .strict()

const legalVersions = z
  .object({ termos: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), privacidade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
  .strict()

const adminSecurity = z
  .object({
    requireMfa: z.boolean(),
    /* Quanto tempo a sessão do painel vale depois da verificação. */
    sessionMinutes: z.number().int().min(5).max(1440).optional(),
  })
  .strict()

export const SETTING_SCHEMAS: Readonly<Record<string, z.ZodTypeAny>> = {
  'admin.security': adminSecurity,
  'plans.free': planLimits,
  'plans.pro': planLimits,
  'ai.limits': aiLimits,
  features: flags,
  experimental: flags,
  maintenance,
  'system.message': systemMessage,
  'legal.versions': legalVersions,
}

export const SETTING_LABELS: Readonly<Record<string, string>> = {
  'admin.security': 'Segurança do painel (MFA obrigatório)',
  'plans.free': 'Limites do plano Gratuito',
  'plans.pro': 'Limites do plano PRO',
  'ai.limits': 'Limites da Momentumm AI',
  features: 'Disponibilidade de funcionalidades',
  experimental: 'Recursos experimentais',
  maintenance: 'Manutenção temporária',
  'system.message': 'Mensagem geral do sistema',
  'legal.versions': 'Versões dos Termos e da Política',
}

/** Chaves cuja mudança muda o que TODO mundo vê ou pode fazer. */
export const SENSITIVE_SETTINGS: ReadonlySet<string> = new Set([
  'admin.security',
  'plans.free',
  'plans.pro',
  'ai.limits',
  'maintenance',
  'legal.versions',
])

export interface SettingValidation {
  readonly ok: boolean
  readonly message: string | null
}

export function validateSetting(key: string, value: unknown): SettingValidation {
  const schema = SETTING_SCHEMAS[key]
  if (!schema) return { ok: false, message: 'Configuração desconhecida.' }
  const result = schema.safeParse(value)
  if (result.success) return { ok: true, message: null }
  const issue = result.error.issues[0]
  return { ok: false, message: issue ? `${issue.path.join('.') || 'valor'}: ${issue.message}` : 'Valor inválido.' }
}
