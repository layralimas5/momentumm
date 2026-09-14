import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import { BillingError, isBillingErrorCode } from '@/domain/billing/billing-error'
import { BILLING_CYCLES } from '@/domain/billing/billing-plans'
import {
  BILLING_FUNCTION_NAME,
  type BillingEndpointRequest,
  type BillingService,
  type CheckoutSession,
  type PixCharge,
  type PixCustomer,
} from '@/domain/billing/billing-service'
import { SUBSCRIPTION_STATUSES, type Subscription } from '@/domain/billing/subscription'
import { track } from '@/infrastructure/analytics/track'
import { supabase } from '@/infrastructure/supabase/client'
import { InfrastructureError } from '@/shared/errors'

/**
 * A cobrança de verdade, pela Edge Function `asaas-billing`.
 *
 * O app pede a sessão de checkout com o JWT da pessoa e recebe um link; o
 * pagamento acontece no Asaas. A assinatura é lida direto da tabela, pela
 * RLS de dono — o webhook é quem escreve nela, e o app nunca.
 */

const NOT_CONFIGURED = 'A assinatura ainda não está disponível nesse ambiente.'

const subscriptionRowSchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  interval: z.enum(BILLING_CYCLES),
  status: z.enum(SUBSCRIPTION_STATUSES),
  amount_cents: z.number().int().nonnegative(),
  started_at: z.string(),
  current_period_end: z.string().nullable(),
  canceled_at: z.string().nullable(),
})

const checkoutResponseSchema = z.object({ url: z.string().url() })

const pixResponseSchema = z.object({
  paymentId: z.string().min(1),
  qrCodeImage: z.string().min(1),
  qrCodePayload: z.string().min(1),
  expiresAt: z.string().min(1),
  invoiceUrl: z.string().url(),
})

interface EndpointFailure {
  readonly error?: { readonly code?: string; readonly message?: string }
}

export class SupabaseBillingService implements BillingService {
  readonly available = true

  async startCheckout(cycle: Subscription['interval'], returnTo: string): Promise<CheckoutSession> {
    const data = await this.call({ action: 'checkout', cycle, returnTo })
    const parsed = checkoutResponseSchema.safeParse(data)
    if (!parsed.success) throw new BillingError('provider_unavailable', 'O checkout veio sem endereço. Tenta de novo.')
    track('checkout_started', 'assinatura', { kind: cycle })
    return { url: parsed.data.url }
  }

  async startPix(cycle: Subscription['interval'], customer: PixCustomer): Promise<PixCharge> {
    const data = await this.call({ action: 'pix', cycle, customer })
    const parsed = pixResponseSchema.safeParse(data)
    if (!parsed.success) throw new BillingError('provider_unavailable', 'A cobrança Pix veio sem QR code. Tenta de novo.')
    track('checkout_started', 'assinatura', { kind: cycle, mode: 'pix' })
    return parsed.data
  }

  async cancelSubscription(): Promise<void> {
    await this.call({ action: 'cancel' })
    track('subscription_canceled', 'assinatura')
  }

  async mySubscription(): Promise<Subscription | null> {
    const { data, error } = await supabase()
      .from('subscriptions')
      .select('id, provider, interval, status, amount_cents, started_at, current_period_end, canceled_at')
      .order('created_at', { ascending: false })
      .limit(5)
    if (error) throw new InfrastructureError('Não consegui ler a assinatura.', error)
    const rows = z.array(subscriptionRowSchema).parse(data ?? [])
    const chosen = rows.find((row) => row.status === 'ativa' || row.status === 'trial') ?? rows[0]
    if (!chosen) return null
    return {
      id: chosen.id,
      provider: chosen.provider,
      interval: chosen.interval,
      status: chosen.status,
      amountCents: chosen.amount_cents,
      startedAt: new Date(chosen.started_at),
      currentPeriodEnd: chosen.current_period_end ? new Date(chosen.current_period_end) : null,
      canceledAt: chosen.canceled_at ? new Date(chosen.canceled_at) : null,
    }
  }

  private async call(request: BillingEndpointRequest): Promise<unknown> {
    const { data, error } = await supabase().functions.invoke<unknown>(BILLING_FUNCTION_NAME, { body: request })
    if (error) throw await translate(error)
    return data
  }
}

async function translate(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const response: unknown = error.context
    if (response instanceof Response) {
      if (response.status === 404) return new BillingError('not_configured', NOT_CONFIGURED)
      const body = await readFailure(response)
      const code = body?.error?.code
      if (isBillingErrorCode(code)) return new BillingError(code, body?.error?.message ?? NOT_CONFIGURED)
    }
    return new BillingError('provider_unavailable', 'A cobrança respondeu com erro. Tenta de novo.')
  }
  if (error instanceof FunctionsFetchError) {
    return new BillingError(
      'provider_unavailable',
      'Não consegui falar com a cobrança. Ou ela ainda não foi configurada nesse ambiente, ou a conexão caiu.',
    )
  }
  return new InfrastructureError('Falha ao chamar a cobrança.', error)
}

async function readFailure(response: Response): Promise<EndpointFailure | null> {
  try {
    return (await response.json()) as EndpointFailure
  } catch {
    return null
  }
}
