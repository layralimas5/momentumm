import type { PlanTier } from '@/domain/entities/plan'
import { grantsPro, type Subscription } from './subscription'

/** Quantos dias de PRO uma conta nova ganha. O mesmo número de `public.trial_days()`. */
export const TRIAL_DAYS = 7

export const TRIAL_STATUSES = ['ativo', 'encerrado', 'convertido'] as const
export type TrialStatus = (typeof TRIAL_STATUSES)[number]

/** O teste como o banco guarda: uma linha por conta, nunca recriada. */
export interface PlanTrial {
  readonly startedAt: Date
  readonly endsAt: Date
  readonly status: TrialStatus
}

export function isTrialActive(trial: PlanTrial | null, now = new Date()): trial is PlanTrial {
  return trial !== null && trial.status === 'ativo' && trial.endsAt.getTime() > now.getTime()
}

/** Dias inteiros até o fim, contando o dia de hoje. Zero quando já passou. */
export function trialDaysLeft(trial: PlanTrial, now = new Date()): number {
  const ms = trial.endsAt.getTime() - now.getTime()
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000)
}

/**
 * De onde vem o PRO da conta. A tela precisa saber a ORIGEM, não só o plano:
 * "PRO de teste até sexta" e "PRO pago" pedem frases e botões diferentes, e
 * quem está no teste ainda tem que conseguir assinar.
 */
export type PlanAccess = 'paid' | 'trial' | 'courtesy' | 'free'

export function planAccessOf(
  plan: PlanTier,
  subscription: Subscription | null,
  trial: PlanTrial | null,
  now = new Date(),
): PlanAccess {
  if (subscription && grantsPro(subscription, now)) return 'paid'
  if (plan !== 'pro') return 'free'
  if (isTrialActive(trial, now)) return 'trial'
  return 'courtesy'
}
