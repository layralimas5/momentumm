/**
 * Planos. A regra de produto é explícita: o dashboard NÃO é bloqueado por
 * banner. O gratuito precisa entregar o ciclo inteiro (check-in, prioridade,
 * hábitos, foco, progresso resumido) — o PRO amplia profundidade, não libera o
 * básico. Por isso os limites aqui são de quantidade e de profundidade, nunca
 * de acesso à tela.
 */

export const PLAN_TIERS = ['free', 'pro'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]

export const PLAN_LABELS: Readonly<Record<PlanTier, string>> = {
  free: 'Gratuito',
  pro: 'PRO',
}

export interface PlanLimits {
  readonly tier: PlanTier
  readonly activeGoals: number
  readonly activeHabits: number
  /** Quantos insights diferentes ficam disponíveis por dia. */
  readonly insightsPerDay: number
  readonly historyDays: number
  readonly focusDurations: readonly number[]
  /** Análise semanal completa, com comparação e leitura por horário. */
  readonly advancedAnalytics: boolean
  readonly monthlyReport: boolean
  readonly adaptiveRecommendations: boolean
  /** Chamadas à Momentumm AI por dia. O teto é aplicado no servidor. */
  readonly aiCallsPerDay: number
}

const UNLIMITED = Number.POSITIVE_INFINITY

export const PLAN_LIMITS: Readonly<Record<PlanTier, PlanLimits>> = {
  free: {
    tier: 'free',
    activeGoals: 3,
    activeHabits: 5,
    insightsPerDay: 1,
    historyDays: 30,
    focusDurations: [15, 25],
    advancedAnalytics: false,
    monthlyReport: false,
    adaptiveRecommendations: false,
    aiCallsPerDay: 5,
  },
  pro: {
    tier: 'pro',
    activeGoals: UNLIMITED,
    activeHabits: UNLIMITED,
    insightsPerDay: UNLIMITED,
    historyDays: UNLIMITED,
    focusDurations: [15, 25, 45, 60],
    advancedAnalytics: true,
    monthlyReport: true,
    adaptiveRecommendations: true,
    aiCallsPerDay: 40,
  },
}

export function limitsOf(tier: PlanTier): PlanLimits {
  return PLAN_LIMITS[tier]
}

export function isPro(tier: PlanTier): boolean {
  return tier === 'pro'
}

export interface LimitCheck {
  readonly reached: boolean
  readonly used: number
  readonly max: number
  /** Frase curta e contextual pro ponto exato onde o limite aparece. */
  readonly message: string | null
}

export function checkLimit(used: number, max: number, what: string): LimitCheck {
  const reached = used >= max
  return {
    reached,
    used,
    max,
    message: reached ? `O plano gratuito guarda até ${max} ${what} ao mesmo tempo.` : null,
  }
}

export function formatLimit(max: number): string {
  return Number.isFinite(max) ? String(max) : 'ilimitado'
}
