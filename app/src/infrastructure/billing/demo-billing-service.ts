import { BillingError } from '@/domain/billing/billing-error'
import type { BillingService, CheckoutSession, PixCharge } from '@/domain/billing/billing-service'
import type { Subscription } from '@/domain/billing/subscription'
import type { PlanTrial } from '@/domain/billing/trial'

/**
 * Sem servidor não há cobrança. O modo demo troca de plano pelo botão
 * "Simular o PRO" em Configurações; a tela de assinatura diz isso em vez
 * de fingir um checkout.
 */
export class DemoBillingService implements BillingService {
  readonly available = false

  startCheckout(): Promise<CheckoutSession> {
    return Promise.reject(
      new BillingError('not_configured', 'No modo demo não existe cobrança. Usa "Simular o PRO" em Configurações.'),
    )
  }

  startPix(): Promise<PixCharge> {
    return Promise.reject(
      new BillingError('not_configured', 'No modo demo não existe cobrança. Usa "Simular o PRO" em Configurações.'),
    )
  }

  cancelSubscription(): Promise<void> {
    return Promise.reject(new BillingError('no_subscription', 'No modo demo não existe assinatura pra cancelar.'))
  }

  mySubscription(): Promise<Subscription | null> {
    return Promise.resolve(null)
  }

  /** No demo o plano é escolhido em Configurações; não existe teste com prazo. */
  settlePlan(): Promise<PlanTrial | null> {
    return Promise.resolve(null)
  }
}
