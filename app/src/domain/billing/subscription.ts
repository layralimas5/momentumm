import type { BillingCycle, ProOffer } from './billing-plans'

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
  /** O valor da última cobrança paga. No primeiro mês com oferta, é o valor da oferta. */
  readonly amountCents: number
  /** O que a próxima cobrança vai ser. `null` em assinatura gravada antes da 0072: vale `amountCents`. */
  readonly renewalAmountCents: number | null
  /** A condição de entrada com que a assinatura começou, se houve uma. */
  readonly offer: ProOffer | null
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

/** O que a tela de assinatura mostra sobre dinheiro. */
export interface SubscriptionBilling {
  readonly currentCents: number
  /** Ainda está pagando o valor da oferta: a renovação vai custar mais. */
  readonly inOffer: boolean
  /** `null` quando não há próxima cobrança (cancelada, vencida). */
  readonly nextCharge: { readonly amountCents: number; readonly at: Date } | null
}

export function subscriptionBilling(subscription: Subscription): SubscriptionBilling {
  const renewal = subscription.renewalAmountCents ?? subscription.amountCents
  const renews = subscription.status === 'ativa' || subscription.status === 'inadimplente'
  return {
    currentCents: subscription.amountCents,
    inOffer: subscription.offer !== null && subscription.amountCents < renewal,
    nextCharge:
      renews && subscription.currentPeriodEnd
        ? { amountCents: renewal, at: subscription.currentPeriodEnd }
        : null,
  }
}
