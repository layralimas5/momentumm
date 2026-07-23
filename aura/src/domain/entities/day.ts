/**
 * Datas como "dias locais" (YYYY-MM-DD). O conceito de "hoje" no Aura é sempre o
 * dia do fuso da usuária, nunca UTC — senão 22h no Brasil já contaria como amanhã.
 * Funções puras, compartilhadas por hábitos, missões e o motor da jornada.
 */

export type DayKey = string

/** Chave de dia local (YYYY-MM-DD) a partir de uma data. */
export function dayKey(date: Date = new Date()): DayKey {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Desloca uma chave de dia por `delta` dias (aceita negativo). */
export function shiftDay(day: DayKey, delta: number): DayKey {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  dt.setDate(dt.getDate() + delta)
  return dayKey(dt)
}

/**
 * Sequência de dias consecutivos terminando em `today`, sobre um conjunto de dias
 * ativos. Tolerante: se hoje ainda não está no conjunto, conta a sequência que
 * termina ontem — o dia não "quebra" só porque ainda não aconteceu.
 */
export function streakEndingToday(activeDays: Iterable<DayKey>, today: DayKey): number {
  const active = activeDays instanceof Set ? activeDays : new Set(activeDays)
  let cursor = today
  if (!active.has(cursor)) {
    cursor = shiftDay(today, -1)
    if (!active.has(cursor)) return 0
  }
  let count = 0
  while (active.has(cursor)) {
    count += 1
    cursor = shiftDay(cursor, -1)
  }
  return count
}
