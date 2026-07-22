import type { PostgrestError } from '@supabase/supabase-js'
import type { ZodType } from 'zod'
import { AppError } from '@/shared/errors'

/**
 * Fronteira de confiança com o banco. `database.types.ts` é gerado e descreve o
 * que o schema *deveria* devolver — não garante o que chegou em runtime (migration
 * não aplicada, coluna nula, resposta truncada). Tudo que entra passa por aqui.
 */

/** Traduz o erro do PostgREST para um erro da aplicação. */
export function fromPostgrestError(error: PostgrestError): AppError {
  // PGRST116: filtro de .single() não retornou linha — inexistente ou escondida pela RLS.
  if (error.code === 'PGRST116') return new AppError('not_found')
  if (error.code === '42501') return new AppError('unauthorized')
  return AppError.infrastructure(error, undefined)
}

/** Valida uma linha; lança `corrupt_data` se o formato não bater. */
export function parseRow<T>(schema: ZodType<T>, value: unknown, context: string): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw AppError.corruptData(result.error, `Registro inesperado em ${context}.`)
  }
  return result.data
}

/** Valida uma lista de linhas (trata `null` do Supabase como lista vazia). */
export function parseRows<T>(schema: ZodType<T>, value: unknown, context: string): T[] {
  const rows = value ?? []
  if (!Array.isArray(rows)) {
    throw AppError.corruptData(rows, `Esperávamos uma lista em ${context}.`)
  }
  return rows.map((row) => parseRow(schema, row, context))
}
