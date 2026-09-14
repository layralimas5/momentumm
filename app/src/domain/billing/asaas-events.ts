import { z } from 'zod'
import { cycleFromProvider, type BillingCycle, PRO_PRICES } from './billing-plans'
import type { SubscriptionStatus } from './subscription'

/**
 * O que um evento do Asaas significa pra assinatura — sem banco, sem rede.
 *
 * O webhook (`supabase/functions/asaas-webhook`) recebe o evento, passa por
 * aqui e só então grava. Separar a decisão da gravação é o que deixa esta
 * parte coberta por teste de domínio: o Asaas manda mais de trinta eventos
 * de cobrança, e cada um que a função interpretar errado é uma conta PRO a
 * mais ou a menos do que a pessoa pagou.
 *
 * O contrato do Asaas que interessa:
 *   - `PAYMENT_*` traz `payment` com `customer`, `subscription` (quando a
 *     cobrança é de assinatura), `value` e `dueDate`
 *   - `SUBSCRIPTION_*` traz `subscription` com `customer` e `cycle`
 *   - `CHECKOUT_PAID` traz `checkout` com `customer` — é a primeira vez que
 *     ficamos sabendo qual cliente do Asaas é a pessoa
 *
 * Entrega é "pelo menos uma vez": o `id` do evento é a chave de repetição.
 */

const optionalString = z.string().nullish().transform((value) => value ?? null)

export const asaasPaymentSchema = z.object({
  id: z.string(),
  customer: z.string(),
  subscription: optionalString,
  externalReference: optionalString,
  checkoutSession: optionalString,
  value: z.number().nonnegative(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.string(),
  billingType: optionalString,
})

export const asaasSubscriptionSchema = z.object({
  id: z.string(),
  customer: z.string(),
  value: z.number().nonnegative(),
  cycle: z.string(),
  status: z.string(),
  nextDueDate: optionalString,
  externalReference: optionalString,
  checkoutSession: optionalString,
})

export const asaasCheckoutSchema = z.object({
  id: z.string(),
  status: z.string(),
  customer: optionalString,
  externalReference: optionalString,
})

export const asaasWebhookEventSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  payment: asaasPaymentSchema.optional(),
  subscription: asaasSubscriptionSchema.optional(),
  checkout: asaasCheckoutSchema.optional(),
})
export type AsaasWebhookEvent = z.infer<typeof asaasWebhookEventSchema>

/** A decisão: o que o evento pede pra assinatura. */
export type BillingDecision =
  | { readonly kind: 'ignore'; readonly reason: string }
  | {
      readonly kind: 'checkout_paid'
      readonly checkoutId: string
      readonly customerId: string | null
      readonly externalReference: string | null
    }
  | {
      readonly kind: 'payment_confirmed'
      readonly providerSubscriptionId: string
      readonly customerId: string
      readonly externalReference: string | null
      /** O Asaas não propaga o externalReference do checkout; a sessão, sim. */
      readonly checkoutSessionId: string | null
      readonly amountCents: number
      readonly dueDate: string
    }
  | {
      readonly kind: 'payment_failed'
      readonly providerSubscriptionId: string
      readonly customerId: string
      readonly code: string
    }
  | { readonly kind: 'payment_overdue'; readonly providerSubscriptionId: string; readonly customerId: string }
  | {
      readonly kind: 'refunded'
      readonly providerSubscriptionId: string
      readonly customerId: string
      readonly amountCents: number
    }
  | { readonly kind: 'subscription_ended'; readonly providerSubscriptionId: string; readonly customerId: string }

const PAID_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])
const FAILED_EVENTS = new Set(['PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS'])
const REFUND_EVENTS = new Set(['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED'])
const ENDED_EVENTS = new Set(['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED', 'SUBSCRIPTION_EXPIRED'])

export function toCents(value: number): number {
  return Math.round(value * 100)
}

export function decideBillingEvent(event: AsaasWebhookEvent): BillingDecision {
  if (event.event === 'CHECKOUT_PAID') {
    if (!event.checkout) return { kind: 'ignore', reason: 'checkout sem corpo' }
    return {
      kind: 'checkout_paid',
      checkoutId: event.checkout.id,
      customerId: event.checkout.customer,
      externalReference: event.checkout.externalReference,
    }
  }

  if (event.event.startsWith('SUBSCRIPTION_')) {
    if (!ENDED_EVENTS.has(event.event)) return { kind: 'ignore', reason: `evento de assinatura sem efeito: ${event.event}` }
    if (!event.subscription) return { kind: 'ignore', reason: 'assinatura sem corpo' }
    return {
      kind: 'subscription_ended',
      providerSubscriptionId: event.subscription.id,
      customerId: event.subscription.customer,
    }
  }

  if (!event.event.startsWith('PAYMENT_')) return { kind: 'ignore', reason: `evento fora do escopo: ${event.event}` }
  const payment = event.payment
  if (!payment) return { kind: 'ignore', reason: 'cobrança sem corpo' }
  // Cobrança avulsa não existe no produto: só assinatura vira PRO.
  if (!payment.subscription) return { kind: 'ignore', reason: 'cobrança sem assinatura' }

  const base = { providerSubscriptionId: payment.subscription, customerId: payment.customer }

  if (PAID_EVENTS.has(event.event)) {
    return {
      kind: 'payment_confirmed',
      ...base,
      externalReference: payment.externalReference,
      checkoutSessionId: payment.checkoutSession,
      amountCents: toCents(payment.value),
      dueDate: payment.dueDate,
    }
  }
  if (event.event === 'PAYMENT_OVERDUE') return { kind: 'payment_overdue', ...base }
  if (FAILED_EVENTS.has(event.event)) return { kind: 'payment_failed', ...base, code: event.event }
  if (REFUND_EVENTS.has(event.event)) return { kind: 'refunded', ...base, amountCents: toCents(payment.value) }

  return { kind: 'ignore', reason: `evento de cobrança sem efeito: ${event.event}` }
}

/**
 * Até quando um pagamento com vencimento em `dueDate` sustenta o PRO. O
 * Asaas gera a cobrança seguinte no vencimento seguinte, então o período é
 * o ciclo inteiro a partir da data de vencimento — não da data de pagamento,
 * que pode vir antes (cartão) ou depois (boleto pago com atraso).
 */
export function periodEndAfter(dueDate: string, cycle: BillingCycle): Date {
  const [year, month, day] = dueDate.split('-').map(Number) as [number, number, number]
  const end = new Date(Date.UTC(year, month - 1 + PRO_PRICES[cycle].months, day, 23, 59, 59))
  return end
}

/** O ciclo que a assinatura do Asaas usa, ou `null` se não for um que o produto vende. */
export function intervalOfProviderSubscription(cycle: string): BillingCycle | null {
  return cycleFromProvider(cycle)
}

export type SubscriptionEventType =
  | 'criada'
  | 'renovada'
  | 'reativada'
  | 'pagamento_falhou'
  | 'reembolso'
  | 'cancelada'
  | 'vencida'

export interface SubscriptionTransition {
  readonly status: SubscriptionStatus
  readonly eventType: SubscriptionEventType
}

/**
 * O estado seguinte, dado o atual. `current` é `null` quando a assinatura
 * ainda não existe no nosso banco (primeiro pagamento).
 */
export function transitionFor(
  current: SubscriptionStatus | null,
  decision: Exclude<BillingDecision, { kind: 'ignore' } | { kind: 'checkout_paid' }>,
): SubscriptionTransition | null {
  switch (decision.kind) {
    case 'payment_confirmed':
      if (current === null) return { status: 'ativa', eventType: 'criada' }
      if (current === 'ativa' || current === 'trial') return { status: 'ativa', eventType: 'renovada' }
      return { status: 'ativa', eventType: 'reativada' }
    case 'payment_overdue':
      if (current === null || current === 'cancelada') return null
      return { status: 'inadimplente', eventType: 'vencida' }
    case 'payment_failed':
      if (current === null) return null
      return { status: current, eventType: 'pagamento_falhou' }
    case 'refunded':
      if (current === null) return null
      return { status: 'cancelada', eventType: 'reembolso' }
    case 'subscription_ended':
      if (current === null || current === 'cancelada') return null
      return { status: 'cancelada', eventType: 'cancelada' }
  }
}
