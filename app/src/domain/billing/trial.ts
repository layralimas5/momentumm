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

export function isCourtesyActive(until: Date | null, now = new Date()): boolean {
  return until !== null && until.getTime() > now.getTime()
}

/**
 * A cortesia vem ANTES do teste, e isso não é detalhe de ordenação.
 *
 * Toda conta nova nasce com sete dias de teste (0034), inclusive a de quem
 * opera o produto — e quem é owner ou admin também ganha cortesia infinita
 * (0051). As duas coisas coexistem na mesma conta, e é a cortesia que decide:
 * quando o sétimo dia chegar, nada vai mudar pra ela. Com o teste na frente, o
 * app anunciava "PRO de teste até 24 de setembro (último dia)" pra quem nunca
 * vai perder o PRO, que é o produto mentindo pra própria dona.
 *
 * A comparação é entre as DATAS, não entre os papéis: cortesia que termina
 * antes do teste não é o que sustenta o PRO, então ali o teste continua sendo
 * a resposta certa.
 */
export function planAccessOf(
  plan: PlanTier,
  subscription: Subscription | null,
  trial: PlanTrial | null,
  courtesyUntil: Date | null = null,
  now = new Date(),
): PlanAccess {
  if (subscription && grantsPro(subscription, now)) return 'paid'
  if (plan !== 'pro') return 'free'

  if (isCourtesyActive(courtesyUntil, now)) {
    const sustentaMais =
      !isTrialActive(trial, now) || courtesyUntil!.getTime() >= trial.endsAt.getTime()
    if (sustentaMais) return 'courtesy'
  }

  if (isTrialActive(trial, now)) return 'trial'
  return 'courtesy'
}
