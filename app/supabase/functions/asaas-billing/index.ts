// Momentumm — a porta da cobrança, pelo lado da pessoa.
//
// Três ações, sempre com o JWT de quem pede:
//
//   checkout  abre uma sessão de checkout do Asaas pro PRO (mensal ou anual)
//             e devolve o link. A pessoa paga LÁ, no cartão (o checkout só
//             aceita cartão em cobrança recorrente), com CPF e endereço
//             coletados por ele, e volta pro app por `returnTo`.
//             Nada é gravado em `subscriptions` aqui: quem grava é o
//             webhook, quando o Asaas confirma o pagamento.
//   pix       o Pix não tem cartão salvo, então o caminho é outro: cria o
//             cliente no Asaas (nome + CPF, exigidos por ele), abre uma
//             assinatura `billingType: PIX` e devolve o QR da primeira
//             cobrança pra pagar no app. As seguintes chegam por e-mail a
//             cada ciclo. O vínculo cliente/pessoa é gravado aqui
//             (`billing_customers`) pra o webhook achar a pessoa de cara.
//   cancel    cancela a assinatura ativa no Asaas e marca aqui. O PRO
//             continua até `current_period_end`, pelo trigger da 0026.
//
// A chave do Asaas mora no segredo desta função e nunca chega ao navegador.
// O preço vem do domínio empacotado (`_shared/billing.ts`): o mesmo número
// que a landing mostra.
//
// Deploy:
//   npm run billing:deploy
//   supabase secrets set ASAAS_API_KEY=... ASAAS_ENV=sandbox|production

import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import {
  AsaasError,
  asaasConfigured,
  createCheckout,
  createCustomer,
  createPixSubscription,
  deleteSubscription,
  getPixQrCode,
  listSubscriptionPayments,
  updateCustomer,
} from '../_shared/asaas.ts'
import {
  formatBRL,
  isBillingCycle,
  isValidCpf,
  normalizeCpf,
  PRO_PRICES,
  PRO_PRODUCT_NAME,
  type BillingErrorCode,
} from '../_shared/billing.ts'
import { PRODUCT_IMAGE_BASE64 } from '../_shared/product-image.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** O checkout do Asaas aceita de 10 a 1440 minutos. Uma hora cobre quem foi buscar o cartão. */
const CHECKOUT_MINUTES = 60

/** O app só pode mandar a pessoa de volta pra ele mesmo. */
const RETURN_PATH = /^\/[a-z0-9\-/]*$/i

const NAME_MIN = 3
const NAME_MAX = 120

interface PixCustomerInput {
  readonly name: string
  readonly cpf: string
}

/** Nome e CPF como o Asaas vai receber, ou `null` se não dá pra criar o cliente com isso. */
function readPixCustomer(value: unknown): PixCustomerInput | null {
  if (!value || typeof value !== 'object') return null
  const { name, cpf } = value as { name?: unknown; cpf?: unknown }
  if (typeof name !== 'string' || typeof cpf !== 'string') return null
  const trimmedName = name.trim().replace(/\s+/g, ' ')
  if (trimmedName.length < NAME_MIN || trimmedName.length > NAME_MAX) return null
  if (!isValidCpf(cpf)) return null
  return { name: trimmedName, cpf: normalizeCpf(cpf) }
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function fail(status: number, code: BillingErrorCode, message: string): Response {
  return reply(status, { error: { code, message } })
}

/**
 * Pra onde o Asaas devolve a pessoa. Em produção é o endereço do app
 * (`MOMENTUMM_APP_URL`); sem ele, só `localhost` do dev é aceito do header
 * `Origin` — qualquer outro valor seria um redirecionamento pra fora do
 * produto assinado por nós.
 */
function appOrigin(request: Request): string {
  const configured = Deno.env.get('MOMENTUMM_APP_URL')
  if (configured) return configured.replace(/\/$/, '')
  const origin = request.headers.get('origin') ?? ''
  if (/^http:\/\/localhost:\d+$/.test(origin)) return origin
  return 'https://www.momentumm.com.br'
}

function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (request.method !== 'POST') return fail(405, 'invalid_request', 'Método não suportado.')

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authorization = request.headers.get('Authorization') ?? ''

  const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const {
    data: { user },
    error: authError,
  } = await asUser.auth.getUser()
  if (authError || !user || !user.email) return fail(401, 'unauthorized', 'Sessão inválida.')

  if (!asaasConfigured()) {
    return fail(503, 'not_configured', 'A cobrança ainda não está configurada nesse ambiente.')
  }

  const body = (await readJson(request)) as
    | { action?: unknown; cycle?: unknown; returnTo?: unknown; customer?: unknown }
    | null
  if (!body || typeof body.action !== 'string') return fail(400, 'invalid_request', 'Pedido inválido.')

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // A assinatura que ainda entitula o PRO, se houver. Lida com service role:
  // a RLS deixaria a pessoa ler, mas a decisão de recusar um segundo
  // checkout não pode depender do que o cliente mandou.
  const { data: current } = await admin
    .from('subscriptions')
    .select('id, provider_subscription_id, status, current_period_end')
    .eq('user_id', user.id)
    .eq('provider', 'asaas')
    .in('status', ['trial', 'ativa', 'inadimplente'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  try {
    if (body.action === 'checkout') {
      if (!isBillingCycle(body.cycle)) return fail(400, 'invalid_request', 'Ciclo de cobrança inválido.')
      if (current) {
        return fail(409, 'already_subscribed', 'Essa conta já tem uma assinatura PRO. Recarrega a página.')
      }
      const returnTo = typeof body.returnTo === 'string' && RETURN_PATH.test(body.returnTo) ? body.returnTo : '/app/assinatura'
      const origin = appOrigin(request)
      const price = PRO_PRICES[body.cycle]

      const checkout = await createCheckout({
        externalReference: user.id,
        cycle: price.providerCycle,
        value: price.amountCents / 100,
        itemName: PRO_PRODUCT_NAME,
        itemDescription: `${PRO_PRODUCT_NAME} ${body.cycle}: ${formatBRL(price.amountCents)} por ${body.cycle === 'anual' ? 'ano' : 'mês'}.`,
        imageBase64: PRODUCT_IMAGE_BASE64,
        successUrl: `${origin}${returnTo}?assinatura=sucesso`,
        cancelUrl: `${origin}${returnTo}?assinatura=cancelado`,
        expiredUrl: `${origin}${returnTo}?assinatura=expirado`,
        minutesToExpire: CHECKOUT_MINUTES,
      })

      const { error: insertError } = await admin.from('billing_checkouts').insert({
        user_id: user.id,
        provider: 'asaas',
        provider_checkout_id: checkout.id,
        interval: body.cycle,
        amount_cents: price.amountCents,
      })
      if (insertError) {
        console.error('billing_checkouts insert', insertError.message)
        return fail(500, 'provider_unavailable', 'Não consegui registrar o checkout. Tenta de novo.')
      }

      return reply(200, { url: checkout.link })
    }

    if (body.action === 'pix') {
      if (!isBillingCycle(body.cycle)) return fail(400, 'invalid_request', 'Ciclo de cobrança inválido.')
      const customer = readPixCustomer(body.customer)
      if (!customer) return fail(400, 'invalid_request', 'Confere o nome e o CPF: o Asaas precisa dos dois.')
      if (current) {
        return fail(409, 'already_subscribed', 'Essa conta já tem uma assinatura PRO. Recarrega a página.')
      }
      const price = PRO_PRICES[body.cycle]
      const customerInput = { ...customer, email: user.email, externalReference: user.id }

      const { data: linked } = await admin
        .from('billing_customers')
        .select('provider_customer_id')
        .eq('user_id', user.id)
        .eq('provider', 'asaas')
        .maybeSingle()
      const asaasCustomer = linked?.provider_customer_id
        ? await updateCustomer(linked.provider_customer_id as string, customerInput)
        : await createCustomer(customerInput)
      if (!linked) {
        const { error: linkError } = await admin
          .from('billing_customers')
          .upsert({ user_id: user.id, provider: 'asaas', provider_customer_id: asaasCustomer.id }, { onConflict: 'user_id' })
        if (linkError) {
          console.error('billing_customers upsert', linkError.message)
          return fail(500, 'provider_unavailable', 'Não consegui registrar o cliente. Tenta de novo.')
        }
      }

      const subscription = await createPixSubscription({
        customerId: asaasCustomer.id,
        externalReference: user.id,
        cycle: price.providerCycle,
        value: price.amountCents / 100,
        description: `${PRO_PRODUCT_NAME} ${body.cycle}`,
      })
      const first = (await listSubscriptionPayments(subscription.id)).find((payment) => payment.status === 'PENDING')
      if (!first) {
        console.error('asaas pix', 'assinatura sem cobrança pendente', subscription.id)
        return fail(502, 'provider_unavailable', 'A assinatura foi aberta, mas o Pix não veio. Tenta de novo em instantes.')
      }
      const qr = await getPixQrCode(first.id)

      return reply(200, {
        paymentId: first.id,
        qrCodeImage: qr.encodedImage,
        qrCodePayload: qr.payload,
        expiresAt: qr.expirationDate,
        invoiceUrl: first.invoiceUrl,
      })
    }

    if (body.action === 'cancel') {
      if (!current) return fail(404, 'no_subscription', 'Não há assinatura ativa pra cancelar.')

      await deleteSubscription(current.provider_subscription_id as string)

      const now = new Date().toISOString()
      const { error: updateError } = await admin
        .from('subscriptions')
        .update({ status: 'cancelada', canceled_at: now, updated_at: now })
        .eq('id', current.id as string)
      if (updateError) {
        console.error('subscriptions cancel', updateError.message)
        return fail(500, 'provider_unavailable', 'Cancelei no provedor, mas não consegui registrar aqui. Fala com o suporte.')
      }
      await admin.from('subscription_events').insert({
        subscription_id: current.id,
        user_id: user.id,
        type: 'cancelada',
        metadata: { origem: 'pessoa' },
      })
      await admin.rpc('mark_cancellation_processed', {
        p_user_id: user.id,
        p_access_until: current.current_period_end,
      })

      return reply(200, { accessUntil: current.current_period_end })
    }

    return fail(400, 'invalid_request', 'Ação desconhecida.')
  } catch (error) {
    if (error instanceof AsaasError) {
      console.error('asaas', error.status, JSON.stringify(error.body).slice(0, 500))
      return fail(502, 'provider_unavailable', 'O provedor de pagamento não respondeu. Tenta de novo em instantes.')
    }
    console.error('asaas-billing', error instanceof Error ? error.message : String(error))
    return fail(500, 'provider_unavailable', 'Algo deu errado na cobrança. Tenta de novo.')
  }
})
