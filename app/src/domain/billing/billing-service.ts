import type { BillingCycle } from './billing-plans'
import type { Subscription } from './subscription'

/** O nome da Edge Function que fala com o Asaas em nome da pessoa. */
export const BILLING_FUNCTION_NAME = 'asaas-billing'

/** O que a função aceita. `cycle` é validado nos dois lados. */
export type BillingEndpointRequest =
  | { readonly action: 'checkout'; readonly cycle: BillingCycle; readonly returnTo: string }
  | { readonly action: 'cancel' }

export interface CheckoutSession {
  /** A página de pagamento do Asaas. O app manda a pessoa pra lá e ela volta por `returnTo`. */
  readonly url: string
}

/**
 * A porta da cobrança.
 *
 * O app nunca fala com o Asaas: a chave da API mora no segredo da função, e
 * o que o app faz é pedir uma sessão de checkout, mandar a pessoa pra ela e
 * ler a assinatura que o webhook gravou. Nada de plano é escrito por aqui —
 * `profiles.plan` segue `subscriptions` por trigger, e só o webhook grava
 * `subscriptions`.
 */
export interface BillingService {
  /** Se este ambiente consegue cobrar de verdade. No demo é `false`, e a tela diz isso. */
  readonly available: boolean
  startCheckout(cycle: BillingCycle, returnTo: string): Promise<CheckoutSession>
  /** Cancela no provedor. O PRO continua até o fim do período já pago. */
  cancelSubscription(): Promise<void>
  /** A assinatura mais relevante da conta, ou `null` sem nenhuma. */
  mySubscription(): Promise<Subscription | null>
}
