import { DomainError } from '@/shared/errors'

/** Os códigos que a Edge Function `asaas-billing` devolve. O código é o contrato. */
export const BILLING_ERROR_CODES = [
  'unauthorized',
  'invalid_request',
  'not_configured',
  'already_subscribed',
  'no_subscription',
  'provider_unavailable',
] as const
export type BillingErrorCode = (typeof BILLING_ERROR_CODES)[number]

/**
 * Erro de cobrança com código: a mensagem vai pra tela como está, e o
 * código deixa a tela decidir o que oferecer — recarregar o plano em
 * `already_subscribed`, nada em `not_configured`.
 */
export class BillingError extends DomainError {
  readonly code: BillingErrorCode

  constructor(code: BillingErrorCode, message: string) {
    super(message)
    this.name = 'BillingError'
    this.code = code
  }
}

export function isBillingErrorCode(value: unknown): value is BillingErrorCode {
  return typeof value === 'string' && (BILLING_ERROR_CODES as readonly string[]).includes(value)
}
