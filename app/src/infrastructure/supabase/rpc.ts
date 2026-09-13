import type { PostgrestError } from '@supabase/supabase-js'
import type { z } from 'zod'
import { DomainError, InfrastructureError, ParseError } from '@/shared/errors'
import { supabase } from './client'

/**
 * Os códigos de erro que as funções do banco levantam DE PROPÓSITO, com
 * mensagem escrita pra pessoa ler: sem permissão (42501), argumento inválido
 * (22023) e não encontrado (P0002). Só esses sobem com o texto original;
 * qualquer outro é falha de infraestrutura e vira a mensagem genérica.
 */
const USER_FACING_CODES = new Set(['42501', '22023', 'P0002'])

export function translateRpcError(error: PostgrestError): Error {
  if (USER_FACING_CODES.has(error.code)) return new DomainError(error.message)
  return new InfrastructureError('Falha ao consultar o servidor.', error)
}

/** Chama uma função do banco e valida a resposta com o schema dado. */
export async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<T> {
  const { data, error } = await supabase().rpc(name, args)
  if (error) throw translateRpcError(error)
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new ParseError(`Resposta de ${name} fora do formato esperado.`, parsed.error.issues)
  }
  return parsed.data
}

/** Chama uma função do banco que não devolve nada relevante. */
export async function rpcVoid(name: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await supabase().rpc(name, args)
  if (error) throw translateRpcError(error)
}
