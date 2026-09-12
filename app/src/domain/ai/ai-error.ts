import { DomainError } from '@/shared/errors'

/** Os códigos que o endpoint devolve. O código é o contrato, a mensagem é apoio. */
export const AI_ERROR_CODES = [
  'unauthorized',
  'invalid_request',
  'quota_exceeded',
  'rate_limited',
  'plan_required',
  'not_configured',
  'model_unavailable',
  'invalid_output',
] as const
export type AiErrorCode = (typeof AI_ERROR_CODES)[number]

/**
 * Erro da IA com código: a mensagem é de domínio (vai pra tela como está), e
 * o código deixa a tela decidir o que oferecer — "ver o PRO" na cota, nada
 * na configuração ausente.
 */
export class AiError extends DomainError {
  readonly code: AiErrorCode

  constructor(code: AiErrorCode, message: string) {
    super(message)
    this.name = 'AiError'
    this.code = code
  }
}

export function isAiErrorCode(value: unknown): value is AiErrorCode {
  return typeof value === 'string' && (AI_ERROR_CODES as readonly string[]).includes(value)
}
