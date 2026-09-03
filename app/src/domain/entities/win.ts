import { DomainError } from '@/shared/errors'
import { formatDayLabel, type DayKey } from './day'

/**
 * Pequena vitória. Existe por um motivo comportamental: o que não é registrado
 * some da memória, e a sensação de "não saí do lugar" quase sempre é falha de
 * registro, não falta de progresso.
 *
 * Curto de propósito. Isso é uma linha, não um diário.
 */

export const MAX_WIN_LENGTH = 140

/**
 * Sugestões prontas de vitória.
 *
 * Existem porque digitar no celular é a maior fricção do registro, e porque
 * elas ensinam o que conta como vitória aqui: aparecer, manter, fazer o mínimo.
 */
export const WIN_SUGGESTIONS = [
  'Comecei mesmo sem vontade',
  'Mantive o hábito',
  'Fiz a versão mínima',
] as const

export interface Win {
  readonly id: string
  readonly userId: string
  readonly day: DayKey
  readonly text: string
  readonly createdAt: Date
}

export interface NewWinInput {
  readonly userId: string
  readonly day: DayKey
  readonly text: string
}

export function createWin(input: NewWinInput, id: string, now = new Date()): Win {
  const text = input.text.trim()
  if (text.length < 2) {
    throw new DomainError('Escreve o que avançou, mesmo que em três palavras.')
  }
  if (text.length > MAX_WIN_LENGTH) {
    throw new DomainError(`A vitória pode ter no máximo ${MAX_WIN_LENGTH} caracteres.`)
  }

  return { id, userId: input.userId, day: input.day, text, createdAt: now }
}

export function winOfDay(wins: readonly Win[], day: DayKey): Win | null {
  return wins.find((win) => win.day === day) ?? null
}

export function recentWins(wins: readonly Win[], today: DayKey, limit = 3): Win[] {
  return [...wins]
    .filter((win) => win.day !== today)
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
    .slice(0, limit)
}

export function winDayLabel(win: Win, today: DayKey): string {
  return formatDayLabel(win.day, today)
}
