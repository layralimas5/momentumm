// Momentumm — o webhook do Asaas.
//
// É a ÚNICA coisa que grava em `subscriptions`. O Asaas avisa que uma
// cobrança foi confirmada, venceu, foi estornada, ou que uma assinatura
// acabou; a decisão do que isso significa mora no domínio
// (`decideBillingEvent` + `transitionFor`, em `_shared/billing.ts`, com
// teste), e aqui fica só o que precisa de banco e de rede:
//
//   1. autenticar: o header `asaas-access-token` tem que bater com
//      `ASAAS_WEBHOOK_TOKEN` (o mesmo cadastrado no painel do Asaas)
//   2. registrar o evento pela chave do Asaas; repetido, responde 200 e
//      para — entrega é "pelo menos uma vez"
//   3. descobrir QUEM é a pessoa: pelo cliente do Asaas já vinculado, pela
//      assinatura já conhecida, pela referência externa (o user_id que o
//      checkout carrega) ou, em último caso, pelo e-mail do cliente
//   4. aplicar a transição e gravar o evento de assinatura
//
// Sempre responde 2xx depois de registrar: erro nosso não pode fazer o
// Asaas reenviar quinze vezes e pausar a fila. O que não deu pra aplicar
// fica em `billing_webhook_events.outcome` pra reprocessar.
//
// Deploy (sem verificação de JWT: quem chama é o Asaas, não uma pessoa):
//   supabase functions deploy asaas-webhook --no-verify-jwt
//   supabase secrets set ASAAS_WEBHOOK_TOKEN=<32+ caracteres>

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0'
import { AsaasError, getCustomer, getSubscription } from '../_shared/asaas.ts'
import {
  asaasWebhookEventSchema,
  decideBillingEvent,
  intervalOfProviderSubscription,
  periodEndAfter,
  toCents,
  transitionFor,
  type BillingDecision,
  type SubscriptionStatus,
} from '../_shared/billing.ts'

const PROVIDER = 'asaas'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Admin = SupabaseClient

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function linkCustomer(admin: Admin, userId: string, customerId: string): Promise<void> {
  await admin
    .from('billing_customers')
    .upsert({ user_id: userId, provider: PROVIDER, provider_customer_id: customerId }, { onConflict: 'user_id' })
}

/** Quem é a pessoa por trás do cliente do Asaas. `null` quando nenhum vínculo bate. */
async function resolveUser(
  admin: Admin,
  customerId: string,
  providerSubscriptionId: string | null,
  externalReference: string | null,
): Promise<string | null> {
  const { data: linked } = await admin
    .from('billing_customers')
    .select('user_id')
    .eq('provider', PROVIDER)
    .eq('provider_customer_id', customerId)
    .maybeSingle()
  if (linked?.user_id) return linked.user_id as string

  if (providerSubscriptionId) {
    const { data: known } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('provider', PROVIDER)
      .eq('provider_subscription_id', providerSubscriptionId)
      .maybeSingle()
    if (known?.user_id) {
      await linkCustomer(admin, known.user_id as string, customerId)
      return known.user_id as string
    }
  }

  const references = [externalReference]
  if (providerSubscriptionId) {
    const subscription = await getSubscription(providerSubscriptionId).catch(() => null)
    references.push(subscription?.externalReference ?? null)
  }
  for (const reference of references) {
    if (reference && UUID.test(reference)) {
      const { data: exists } = await admin.from('profiles').select('id').eq('id', reference).maybeSingle()
      if (exists?.id) {
        await linkCustomer(admin, reference, customerId)
        return reference
      }
    }
  }

  const customer = await getCustomer(customerId).catch(() => null)
  if (customer?.email) {
    const { data: byEmail } = await admin.rpc('user_id_by_email', { p_email: customer.email })
    if (typeof byEmail === 'string' && byEmail) {
      await linkCustomer(admin, byEmail, customerId)
      return byEmail
    }
  }

  return null
}

async function applyCheckoutPaid(
  admin: Admin,
  decision: Extract<BillingDecision, { kind: 'checkout_paid' }>,
): Promise<string> {
  const now = new Date().toISOString()
  const { data: checkout } = await admin
    .from('billing_checkouts')
    .update({ status: 'pago', paid_at: now })
    .eq('provider', PROVIDER)
    .eq('provider_checkout_id', decision.checkoutId)
    .select('user_id')
    .maybeSingle()

  const userId =
    (checkout?.user_id as string | undefined) ??
    (decision.externalReference && UUID.test(decision.externalReference) ? decision.externalReference : null)
  if (!userId) return 'checkout pago sem pessoa conhecida'
  if (decision.customerId) await linkCustomer(admin, userId, decision.customerId)
  return 'ok'
}

async function applySubscriptionDecision(
  admin: Admin,
  decision: Exclude<BillingDecision, { kind: 'ignore' } | { kind: 'checkout_paid' }>,
): Promise<string> {
  const externalReference = decision.kind === 'payment_confirmed' ? decision.externalReference : null
  const userId = await resolveUser(admin, decision.customerId, decision.providerSubscriptionId, externalReference)
  if (!userId) return `pessoa não encontrada pro cliente ${decision.customerId}`

  const { data: existing } = await admin
    .from('subscriptions')
    .select('id, status, interval, current_period_end')
    .eq('provider', PROVIDER)
    .eq('provider_subscription_id', decision.providerSubscriptionId)
    .maybeSingle()

  const transition = transitionFor((existing?.status as SubscriptionStatus | undefined) ?? null, decision)
  if (!transition) return `sem efeito no estado ${existing?.status ?? 'inexistente'}`

  const now = new Date().toISOString()

  if (decision.kind === 'payment_confirmed') {
    // A assinatura do Asaas é a fonte do ciclo e do valor: o pagamento
    // sozinho não diz se é mensal ou anual.
    const remote = await getSubscription(decision.providerSubscriptionId)
    const interval = intervalOfProviderSubscription(remote.cycle)
    if (!interval) return `ciclo desconhecido: ${remote.cycle}`
    const periodEnd = periodEndAfter(decision.dueDate, interval).toISOString()

    let subscriptionId: string
    if (existing) {
      const { error } = await admin
        .from('subscriptions')
        .update({
          status: transition.status,
          interval,
          amount_cents: toCents(remote.value),
          current_period_end: periodEnd,
          canceled_at: null,
          ended_at: null,
          updated_at: now,
        })
        .eq('id', existing.id as string)
      if (error) throw new Error(`update subscriptions: ${error.message}`)
      subscriptionId = existing.id as string
    } else {
      const { data: inserted, error } = await admin
        .from('subscriptions')
        .insert({
          user_id: userId,
          provider: PROVIDER,
          provider_subscription_id: decision.providerSubscriptionId,
          plan: 'pro',
          interval,
          status: transition.status,
          amount_cents: toCents(remote.value),
          current_period_end: periodEnd,
        })
        .select('id')
        .single()
      if (error || !inserted) throw new Error(`insert subscriptions: ${error?.message ?? 'sem id'}`)
      subscriptionId = inserted.id as string
    }

    await admin.from('subscription_events').insert({
      subscription_id: subscriptionId,
      user_id: userId,
      type: transition.eventType,
      amount_cents: decision.amountCents,
      to_interval: interval,
      metadata: { due_date: decision.dueDate },
    })
    return 'ok'
  }

  if (!existing) return 'assinatura desconhecida'

  const patch: Record<string, unknown> = { status: transition.status, updated_at: now }
  if (decision.kind === 'refunded') {
    patch.ended_at = now
    patch.current_period_end = now
  }
  if (decision.kind === 'subscription_ended') patch.canceled_at = now

  if (transition.status !== existing.status || decision.kind === 'refunded') {
    const { error } = await admin.from('subscriptions').update(patch).eq('id', existing.id as string)
    if (error) throw new Error(`update subscriptions: ${error.message}`)
  }

  await admin.from('subscription_events').insert({
    subscription_id: existing.id,
    user_id: userId,
    type: transition.eventType,
    amount_cents: decision.kind === 'refunded' ? decision.amountCents : null,
    metadata: decision.kind === 'payment_failed' ? { code: decision.code } : {},
  })
  return 'ok'
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('método não suportado', { status: 405 })

  const expected = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? ''
  const received = request.headers.get('asaas-access-token') ?? ''
  if (!expected || !timingSafeEqual(expected, received)) {
    return new Response('não autorizado', { status: 401 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = asaasWebhookEventSchema.safeParse(raw)
  if (!parsed.success) return new Response('evento fora do formato', { status: 400 })
  const event = parsed.data

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  })

  // Registro pela chave do Asaas. Conflito = já recebido: 200 e nada mais.
  const { error: insertError } = await admin.from('billing_webhook_events').insert({
    provider: PROVIDER,
    event_id: event.id,
    event: event.event,
    payload: raw,
  })
  if (insertError) {
    if (insertError.code === '23505') return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
    console.error('billing_webhook_events insert', insertError.message)
    return new Response('falha ao registrar', { status: 500 })
  }

  const decision = decideBillingEvent(event)
  let outcome: string
  try {
    if (decision.kind === 'ignore') outcome = `ignorado: ${decision.reason}`
    else if (decision.kind === 'checkout_paid') outcome = await applyCheckoutPaid(admin, decision)
    else outcome = await applySubscriptionDecision(admin, decision)
  } catch (error) {
    outcome =
      error instanceof AsaasError
        ? `erro asaas ${error.status}`
        : `erro: ${error instanceof Error ? error.message : String(error)}`
    console.error('asaas-webhook', event.event, outcome)
  }

  await admin
    .from('billing_webhook_events')
    .update({ processed_at: new Date().toISOString(), outcome: outcome.slice(0, 300) })
    .eq('provider', PROVIDER)
    .eq('event_id', event.id)

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
