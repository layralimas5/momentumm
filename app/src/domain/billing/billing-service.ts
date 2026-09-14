import type { BillingCycle } from './billing-plans'
import type { Subscription } from './subscription'

/** O nome da Edge Function que fala com o Asaas em nome da pessoa. */
export const BILLING_FUNCTION_NAME = 'asaas-billing'

/** O que a função aceita. `cycle` e `cpf` são validados nos dois lados. */
export type BillingEndpointRequest =
  | { readonly action: 'checkout'; readonly cycle: BillingCycle; readonly returnTo: string }
  | { readonly action: 'pix'; readonly cycle: BillingCycle; readonly customer: PixCustomer }
  | { readonly action: 'cancel' }

export interface CheckoutSession {
  /** A página de pagamento do Asaas. O app manda a pessoa pra lá e ela volta por `returnTo`. */
  readonly url: string
}

/** O que o Asaas exige pra abrir uma assinatura Pix: o cartão não existe, então o cliente precisa ter dono. */
export interface PixCustomer {
  readonly name: string
  readonly cpf: string
}

/**
 * A primeira cobrança Pix da assinatura. O QR fica na tela do app; a
 * pessoa paga no banco dela e o webhook confirma. As seguintes chegam
 * por e-mail, a cada ciclo, geradas pelo Asaas.
 */
export interface PixCharge {
  readonly paymentId: string
  /** PNG em base64, sem o prefixo `data:`. */
  readonly qrCodeImage: string
  /** O "copia e cola". */
  readonly qrCodePayload: string
  readonly expiresAt: string
  /** A fatura no Asaas, com o mesmo QR, pra quem prefere abrir lá. */
  readonly invoiceUrl: string
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
  /** Abre a assinatura por Pix e devolve a primeira cobrança pra pagar aqui mesmo. */
  startPix(cycle: BillingCycle, customer: PixCustomer): Promise<PixCharge>
  /** Cancela no provedor. O PRO continua até o fim do período já pago. */
  cancelSubscription(): Promise<void>
  /** A assinatura mais relevante da conta, ou `null` sem nenhuma. */
  mySubscription(): Promise<Subscription | null>
}
