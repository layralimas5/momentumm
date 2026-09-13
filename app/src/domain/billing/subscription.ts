import type { BillingCycle } from './billing-plans'

/** Os estados da tabela `subscriptions`. O plano da conta é derivado deles no banco. */
export const SUBSCRIPTION_STATUSES = ['trial', 'ativa', 'cancelada', 'vencida', 'inadimplente'] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export const SUBSCRIPTION_STATUS_LABELS: Readonly<Record<SubscriptionStatus, string>> = {
  trial: 'Período de teste',
  ativa: 'Ativa',
  cancelada: 'Cancelada',
  vencida: 'Vencida',
  inadimplente: 'Pagamento pendente',
}

/**
 * A assinatura como a pessoa a vê: o que o webhook gravou, sem nada do
 * provedor além do id. Número de cartão, bandeira e token ficam no Asaas.
 */
export interface Subscription {
  readonly id: string
  readonly provider: string
  readonly interval: BillingCycle
  readonly status: SubscriptionStatus
  readonly amountCents: number
  readonly startedAt: Date
  /** Até quando o período pago vale. É o que segura o PRO depois de um cancelamento. */
  readonly currentPeriodEnd: Date | null
  readonly canceledAt: Date | null
}

/** Cancelada mas ainda dentro do período pago: o PRO continua até `currentPeriodEnd`. */
export function isWindingDown(subscription: Subscription, now = new Date()): boolean {
  return (
    subscription.status === 'cancelada' &&
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd.getTime() > now.getTime()
  )
}

/** Tem assinatura que ainda entitula o PRO, cancelada ou não. */
export function grantsPro(subscription: Subscription, now = new Date()): boolean {
  return subscription.status === 'ativa' || subscription.status === 'trial' || isWindingDown(subscription, now)
}
