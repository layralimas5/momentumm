import { DomainError } from '@/shared/errors'

/**
 * Dia no calendário LOCAL do usuário, no formato `YYYY-MM-DD`.
 *
 * Streak é a mecânica mais sensível do produto e ela quebra se o dia for
 * derivado de UTC: quem registra às 22h no Brasil já estaria no dia seguinte.
 * Por isso todo cálculo de dia passa por aqui e nunca por `toISOString()`.
 */
export type DayKey = string & { readonly __brand: 'DayKey' }

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 86_400_000

export function dayKeyOf(date: Date): DayKey {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}` as DayKey
}

export function parseDayKey(value: string): DayKey {
  if (!DAY_PATTERN.test(value)) {
    throw new DomainError(`Data inválida: ${value}`)
  }
  return value as DayKey
}

/** Meio-dia local, pra aritmética de dias imune a horário de verão. */
export function dayKeyToDate(key: DayKey): Date {
  const [year, month, day] = key.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function addDays(key: DayKey, amount: number): DayKey {
  const date = dayKeyToDate(key)
  date.setDate(date.getDate() + amount)
  return dayKeyOf(date)
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((dayKeyToDate(to).getTime() - dayKeyToDate(from).getTime()) / MS_PER_DAY)
}

export function isSameDay(a: DayKey, b: DayKey): boolean {
  return a === b
}

/** Sequência de dias do mais antigo ao mais recente, incluindo as pontas. */
export function dayRange(from: DayKey, to: DayKey): DayKey[] {
  const total = daysBetween(from, to)
  if (total < 0) return []
  return Array.from({ length: total + 1 }, (_, index) => addDays(from, index))
}

export function startOfWeek(key: DayKey): DayKey {
  const date = dayKeyToDate(key)
  // Semana começa na segunda: é como as pessoas pensam em meta semanal.
  const offset = (date.getDay() + 6) % 7
  return addDays(key, -offset)
}

export function startOfMonth(key: DayKey): DayKey {
  return parseDayKey(`${key.slice(0, 7)}-01`)
}

export function formatDayLabel(key: DayKey, today: DayKey): string {
  if (key === today) return 'Hoje'
  if (key === addDays(today, -1)) return 'Ontem'
  const date = dayKeyToDate(key)
  const sameYear = date.getFullYear() === dayKeyToDate(today).getFullYear()
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}
