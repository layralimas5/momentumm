/** Erro de regra de negócio: a mensagem pode ser mostrada ao usuário. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

/** Falha ao falar com um serviço externo (Supabase, rede). */
export class InfrastructureError extends Error {
  readonly reason: unknown

  constructor(message: string, reason?: unknown) {
    super(message)
    this.name = 'InfrastructureError'
    this.reason = reason
  }
}

/** Dado externo chegou fora do formato esperado. */
export class ParseError extends Error {
  readonly issues: unknown

  constructor(message: string, issues?: unknown) {
    super(message)
    this.name = 'ParseError'
    this.issues = issues
  }
}

const FALLBACK_MESSAGE = 'Algo deu errado. Tenta de novo em instantes.'

/** Mensagem segura pra tela: só erro de domínio expõe o texto original. */
export function toUserMessage(error: unknown): string {
  if (error instanceof DomainError) return error.message
  if (error instanceof InfrastructureError) return 'Não consegui salvar agora. Verifica a conexão.'
  return FALLBACK_MESSAGE
}
