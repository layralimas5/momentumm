import { addDays, dayKeyOf, dayKeyToDate, type DayKey } from './day'

/**
 * O mês como a tela desenha.
 *
 * O resto do app conta a semana a partir de domingo (`startOfWeek`), porque é
 * assim que o calendário brasileiro imprime e é assim que a faixa dos sete dias
 * do Hoje é lida. Aqui a semana começa na SEGUNDA, e não é inconsistência: a
 * grade do mês existe pra olhar pra trás, "que semanas eu sustentei", e numa
 * grade de retrospecto o fim de semana fazer bloco no fim da linha é o que
 * deixa o padrão visível de relance.
 */

export const MONTH_LABELS: readonly string[] = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/** Segunda a domingo, como a grade é lida. */
export const MONTH_WEEKDAY_LABELS: readonly string[] = [
  'SEG',
  'TER',
  'QUA',
  'QUI',
  'SEX',
  'SÁB',
  'DOM',
]

export function startOfMonthKey(day: DayKey): DayKey {
  const date = dayKeyToDate(day)
  return dayKeyOf(new Date(date.getFullYear(), date.getMonth(), 1))
}

/**
 * Anda de mês em mês sem cair no dia 31.
 *
 * `new Date(2026, 0, 31)` mais um mês vira 3 de março, porque fevereiro não tem
 * 31. Como a navegação só precisa do mês, ela anda a partir do DIA 1 e o
 * problema não existe.
 */
export function addMonths(day: DayKey, amount: number): DayKey {
  const date = dayKeyToDate(startOfMonthKey(day))
  return dayKeyOf(new Date(date.getFullYear(), date.getMonth() + amount, 1))
}

export function isSameMonth(a: DayKey, b: DayKey): boolean {
  return startOfMonthKey(a) === startOfMonthKey(b)
}

export function formatMonthLabel(day: DayKey): string {
  const date = dayKeyToDate(day)
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`
}

/**
 * As células da grade, em semanas inteiras de segunda a domingo.
 *
 * O mês começa numa quinta? A linha de cima é completada com os dias do mês
 * anterior, que a tela desenha apagados. Sem isso o dia 1 apareceria na
 * primeira coluna e a grade mentiria sobre em que dia da semana as coisas
 * aconteceram, que é exatamente o que ela existe pra mostrar.
 */
export function monthGridDays(day: DayKey): DayKey[] {
  const first = startOfMonthKey(day)
  const firstDate = dayKeyToDate(first)
  const last = addDays(addMonths(first, 1), -1)

  // getDay(): 0 = domingo. Com a semana começando na segunda, domingo é o
  // sexto passo depois dela, não o primeiro.
  const offset = (firstDate.getDay() + 6) % 7
  const start = addDays(first, -offset)

  const days: DayKey[] = []
  let cursor = start
  while (cursor <= last || days.length % 7 !== 0) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }

  return days
}
