// Momentumm — o cliente do Asaas que as duas funções de cobrança usam.
//
// Chave e ambiente vêm dos segredos da função:
//   ASAAS_API_KEY   a chave da conta (sandbox ou produção, a chave decide)
//   ASAAS_ENV       'sandbox' (padrão) ou 'production'
//
// O que sai daqui é o mínimo que o produto precisa: abrir um checkout
// (cartão), abrir uma assinatura Pix com o QR da primeira cobrança, ler
// uma assinatura, ler e criar um cliente e cancelar uma assinatura.
// Nenhuma chamada de cartão: o checkout do Asaas coleta e guarda lá.

const BASE_URLS = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
} as const

export class AsaasError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`Asaas respondeu ${status}`)
    this.name = 'AsaasError'
    this.status = status
    this.body = body
  }
}

export interface AsaasCheckoutInput {
  readonly externalReference: string
  readonly cycle: 'MONTHLY' | 'YEARLY'
  readonly value: number
  readonly itemName: string
  readonly itemDescription: string
  readonly imageBase64: string
  readonly successUrl: string
  readonly cancelUrl: string
  readonly expiredUrl: string
  readonly minutesToExpire: number
}

export interface AsaasCheckout {
  readonly id: string
  readonly link: string
  readonly status: string
}

export interface AsaasSubscription {
  readonly id: string
  readonly customer: string
  readonly value: number
  readonly cycle: string
  readonly status: string
  readonly nextDueDate: string | null
  readonly externalReference: string | null
}

export interface AsaasCustomer {
  readonly id: string
  readonly email: string | null
  readonly externalReference: string | null
}

export interface AsaasCustomerInput {
  readonly externalReference: string
  readonly name: string
  readonly cpf: string
  readonly email: string
}

export interface AsaasPixSubscriptionInput {
  readonly customerId: string
  readonly externalReference: string
  readonly cycle: 'MONTHLY' | 'YEARLY'
  readonly value: number
  readonly description: string
}

export interface AsaasPayment {
  readonly id: string
  readonly status: string
  readonly dueDate: string
  readonly invoiceUrl: string
}

export interface AsaasPixQrCode {
  readonly encodedImage: string
  readonly payload: string
  readonly expirationDate: string
}

export function asaasConfigured(): boolean {
  return Boolean(Deno.env.get('ASAAS_API_KEY'))
}

function baseUrl(): string {
  return Deno.env.get('ASAAS_ENV') === 'production' ? BASE_URLS.production : BASE_URLS.sandbox
}

async function call<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: Deno.env.get('ASAAS_API_KEY') ?? '',
      'User-Agent': 'Momentumm',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  if (!response.ok) throw new AsaasError(response.status, parsed)
  return parsed as T
}

/** Hoje, no fuso de Brasília, como o Asaas espera (`YYYY-MM-DD`). */
export function todayInBrazil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export function createCheckout(input: AsaasCheckoutInput): Promise<AsaasCheckout> {
  return call<AsaasCheckout>('POST', '/checkouts', {
    billingTypes: ['CREDIT_CARD'],
    chargeTypes: ['RECURRENT'],
    minutesToExpire: input.minutesToExpire,
    externalReference: input.externalReference,
    callback: {
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      expiredUrl: input.expiredUrl,
    },
    items: [
      {
        name: input.itemName,
        description: input.itemDescription,
        quantity: 1,
        value: input.value,
        imageBase64: input.imageBase64,
      },
    ],
    subscription: { cycle: input.cycle, nextDueDate: todayInBrazil() },
  })
}

export function getSubscription(id: string): Promise<AsaasSubscription> {
  return call<AsaasSubscription>('GET', `/subscriptions/${encodeURIComponent(id)}`)
}

export function getCustomer(id: string): Promise<AsaasCustomer> {
  return call<AsaasCustomer>('GET', `/customers/${encodeURIComponent(id)}`)
}

export function createCustomer(input: AsaasCustomerInput): Promise<AsaasCustomer> {
  return call<AsaasCustomer>('POST', '/customers', customerBody(input))
}

/** O mesmo cliente pode ter vindo do checkout de cartão sem CPF de verdade; a assinatura Pix completa. */
export function updateCustomer(id: string, input: AsaasCustomerInput): Promise<AsaasCustomer> {
  return call<AsaasCustomer>('PUT', `/customers/${encodeURIComponent(id)}`, customerBody(input))
}

function customerBody(input: AsaasCustomerInput) {
  return {
    name: input.name,
    cpfCnpj: input.cpf,
    email: input.email,
    externalReference: input.externalReference,
    notificationDisabled: false,
  }
}

/**
 * Assinatura sem cartão: a cada ciclo o Asaas gera uma cobrança Pix e avisa
 * a pessoa por e-mail. `nextDueDate` de hoje faz a primeira nascer agora.
 */
export function createPixSubscription(input: AsaasPixSubscriptionInput): Promise<AsaasSubscription> {
  return call<AsaasSubscription>('POST', '/subscriptions', {
    customer: input.customerId,
    billingType: 'PIX',
    value: input.value,
    cycle: input.cycle,
    nextDueDate: todayInBrazil(),
    description: input.description,
    externalReference: input.externalReference,
  })
}

export async function listSubscriptionPayments(subscriptionId: string): Promise<readonly AsaasPayment[]> {
  const page = await call<{ data: readonly AsaasPayment[] }>(
    'GET',
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`,
  )
  return page.data
}

export function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return call<AsaasPixQrCode>('GET', `/payments/${encodeURIComponent(paymentId)}/pixQrCode`)
}

export async function deleteSubscription(id: string): Promise<void> {
  await call<{ deleted: boolean }>('DELETE', `/subscriptions/${encodeURIComponent(id)}`)
}
