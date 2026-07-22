import type { PostgrestError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { AppError } from '@/shared/errors'
import { fromPostgrestError, parseRow, parseRows } from './parse'
import { habitRowSchema } from './schemas'

const VALID_HABIT = {
  id: 'h1',
  user_id: 'u1',
  emoji: '💧',
  title: 'Beber água',
  scheduled_time: null,
  created_at: '2026-07-22T10:00:00.000Z',
}

function postgrestError(code: string): PostgrestError {
  return { code, message: 'boom', details: '', hint: '' } as PostgrestError
}

describe('fromPostgrestError', () => {
  it('mapeia PGRST116 (nenhuma linha) para not_found', () => {
    expect(fromPostgrestError(postgrestError('PGRST116')).code).toBe('not_found')
  })

  it('mapeia 42501 (permissão negada pela RLS) para unauthorized', () => {
    expect(fromPostgrestError(postgrestError('42501')).code).toBe('unauthorized')
  })

  it('trata código desconhecido como falha de infraestrutura', () => {
    expect(fromPostgrestError(postgrestError('08006')).code).toBe('infrastructure')
  })

  it('não vaza a mensagem crua do banco para a usuária', () => {
    const error = fromPostgrestError(postgrestError('08006'))
    expect(error.message).not.toContain('boom')
    expect(error.cause).toBeDefined()
  })
})

describe('parseRow', () => {
  it('devolve a linha válida', () => {
    expect(parseRow(habitRowSchema, VALID_HABIT, 'habits')).toEqual(VALID_HABIT)
  })

  it('rejeita campo com o tipo errado', () => {
    expect(() => parseRow(habitRowSchema, { ...VALID_HABIT, emoji: 42 }, 'habits')).toThrow(AppError)
  })

  it('rejeita campo obrigatório ausente', () => {
    const { title: _omitted, ...incomplete } = VALID_HABIT
    expect(() => parseRow(habitRowSchema, incomplete, 'habits')).toThrow(AppError)
  })

  it('rejeita null onde a coluna é NOT NULL', () => {
    expect(() => parseRow(habitRowSchema, { ...VALID_HABIT, title: null }, 'habits')).toThrow(
      AppError,
    )
  })

  it('classifica a falha como corrupt_data e cita o contexto', () => {
    try {
      parseRow(habitRowSchema, {}, 'habits')
      expect.unreachable('deveria ter lançado')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).code).toBe('corrupt_data')
      expect((error as AppError).message).toContain('habits')
    }
  })
})

describe('parseRows', () => {
  it('valida cada item da lista', () => {
    expect(parseRows(habitRowSchema, [VALID_HABIT, VALID_HABIT], 'habits')).toHaveLength(2)
  })

  it('trata null do Supabase como lista vazia', () => {
    expect(parseRows(habitRowSchema, null, 'habits')).toEqual([])
  })

  it('rejeita a lista inteira se um item estiver corrompido', () => {
    const rows = [VALID_HABIT, { ...VALID_HABIT, created_at: null }]
    expect(() => parseRows(habitRowSchema, rows, 'habits')).toThrow(AppError)
  })

  it('rejeita quando o retorno não é uma lista', () => {
    expect(() => parseRows(habitRowSchema, VALID_HABIT, 'habits')).toThrow(AppError)
  })
})
