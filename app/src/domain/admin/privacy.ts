/**
 * As duas regras de privacidade que o painel aplica no cliente, além do
 * banco: e-mail mascarado e mensagem de erro sem segredo.
 *
 * As duas existem em SQL também (`mask_email`, `sanitize_error_message`) e
 * são iguais de propósito. O teste do cliente prova a regra; o banco prova
 * que ela vale mesmo pra quem chama a API na mão.
 */

/** `la***@gm***.com`. O mesmo formato de `public.mask_email`. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null
  const [local = '', domain = ''] = email.split('@')
  const dot = domain.indexOf('.')
  const host = dot >= 0 ? domain.slice(0, dot) : domain
  const ext = dot >= 0 ? domain.slice(dot) : ''
  return `${local.slice(0, 2)}***@${host.slice(0, 2)}***${ext}`
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const BEARER = /Bearer\s+[A-Za-z0-9._-]+/g
const JWT = /eyJ[A-Za-z0-9._-]{20,}/g
const API_KEY = /(sk-ant-|sb_secret_|sbp_)[A-Za-z0-9_-]+/g
/** Qualquer sequência longa sem espaço: chave, hash, token de sessão. */
const LONG_OPAQUE = /\b[A-Za-z0-9_-]{40,}\b/g
/*
  Segredo curto, que o tamanho não denuncia.

  O `refresh_token` do Supabase tem uma dúzia de caracteres e vale uma
  sessão inteira. Ele chegou no log de erros pela URL de recuperação de
  senha, por baixo de toda regra que olha só o formato. Aqui quem manda é o
  NOME do parâmetro: se ele diz que é segredo, o valor não passa.
*/
const SECRET_PARAM = /\b(access_token|refresh_token|id_token|token|code|secret|password|senha|api_?key)=[^&\s'"]+/gi

export const MAX_ERROR_MESSAGE = 200

/**
 * O que pode ir pro log de erros. Nunca o texto de um objeto do domínio:
 * quem chama passa `error.message`, não `JSON.stringify(state)`.
 */
export function sanitizeErrorMessage(message: string | null | undefined): string {
  return (message ?? '')
    .replace(EMAIL, '[email]')
    .replace(BEARER, 'Bearer [token]')
    .replace(JWT, '[jwt]')
    .replace(API_KEY, '[chave]')
    .replace(LONG_OPAQUE, '[opaco]')
    .replace(SECRET_PARAM, (_match, nome: string) => `${nome}=[oculto]`)
    .slice(0, MAX_ERROR_MESSAGE)
}

/** Os módulos que a central de erros conhece. Fora da lista, `app`. */
export const ERROR_MODULES = [
  'app',
  'auth',
  'database',
  'storage',
  'edge_function',
  'ai',
  'payment',
  'planner',
  'share',
  'admin',
] as const
export type ErrorModule = (typeof ERROR_MODULES)[number]

export function errorModuleFor(error: unknown): ErrorModule {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  if (/auth|session|jwt|token/i.test(name + message)) return 'auth'
  if (/storage|bucket|upload/i.test(name + message)) return 'storage'
  if (/postgrest|database|relation|column|rls|policy/i.test(name + message)) return 'database'
  if (/FunctionsFetchError|FunctionsHttpError|edge/i.test(name + message)) return 'edge_function'
  if (name === 'AiError') return 'ai'
  return 'app'
}
