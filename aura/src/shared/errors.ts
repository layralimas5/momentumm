/**
 * Erros da aplicação. A UI nunca deve mostrar mensagem crua de banco ou stack:
 * tudo que chega até ela passa por aqui e vira uma frase que a usuária entende.
 */

export type AppErrorCode =
  /** Input inválido — culpa do preenchimento, dá pra corrigir na tela. */
  | 'validation'
  /** Sessão ausente ou expirada. */
  | 'unauthorized'
  /** O recurso não existe (ou a RLS escondeu). */
  | 'not_found'
  /** Falha de rede/servidor — não é culpa da usuária. */
  | 'infrastructure'
  /** Dado persistido fora do formato esperado — bug nosso, não dela. */
  | 'corrupt_data'

const FALLBACK_MESSAGE: Record<AppErrorCode, string> = {
  validation: 'Confira os campos e tente de novo.',
  unauthorized: 'Sua sessão expirou. Entre de novo pra continuar.',
  not_found: 'Não encontramos o que você procurava.',
  infrastructure: 'Não conseguimos falar com o servidor. Tente de novo em instantes.',
  corrupt_data: 'Algo saiu do lugar aqui do nosso lado. Já estamos sabendo.',
}

/**
 * Erro com código e mensagem pronta pra tela. `cause` guarda o erro original
 * pra depuração sem vazar detalhe técnico pra usuária.
 */
export class AppError extends Error {
  readonly code: AppErrorCode

  constructor(code: AppErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? FALLBACK_MESSAGE[code], options)
    this.name = 'AppError'
    this.code = code
  }

  static validation(message: string): AppError {
    return new AppError('validation', message)
  }

  static infrastructure(cause: unknown, message?: string): AppError {
    return new AppError('infrastructure', message, { cause })
  }

  static corruptData(cause: unknown, message?: string): AppError {
    return new AppError('corrupt_data', message, { cause })
  }
}

/**
 * Converte qualquer coisa lançada numa mensagem exibível. Erros desconhecidos
 * viram a frase genérica de infraestrutura — nunca `[object Object]` na tela.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message
  if (error instanceof Error && error.message.trim().length > 0) return error.message
  return FALLBACK_MESSAGE.infrastructure
}
