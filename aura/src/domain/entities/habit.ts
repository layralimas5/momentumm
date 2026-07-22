/**
 * Hábito — um compromisso diário da rotina. A usuária marca cada dia; o histórico
 * de dias concluídos alimenta a sequência (streak), a porcentagem e o calendário.
 * Camada de domínio: pura, sem dependência de framework, banco ou UI.
 */

export interface Habit {
  readonly id: string
  readonly userId: string
  /** Emoji que representa o hábito (ex.: 💧). */
  emoji: string
  /** Nome do hábito. */
  title: string
  /** Horário sugerido no formato HH:MM; null se sem horário. */
  time: string | null
  /** Dias concluídos (YYYY-MM-DD, local). Ordenados de forma crescente. */
  completedDates: string[]
  readonly createdAt: string
}

/** Dados necessários pra criar um hábito. */
export interface NewHabit {
  emoji?: string
  title: string
  time?: string | null
}

export const HabitRules = {
  minTitleLength: 2,
  maxTitleLength: 80,
  defaultEmoji: '✨',

  isValidTitle(title: string): boolean {
    const t = title.trim()
    return t.length >= this.minTitleLength && t.length <= this.maxTitleLength
  },

  /** Chave de dia local (YYYY-MM-DD) — a base do conceito de "hoje". */
  dayKey(date: Date = new Date()): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  },

  /** Desloca uma chave de dia por `delta` dias (aceita negativo). */
  shift(day: string, delta: number): string {
    const [y, m, d] = day.split('-').map(Number)
    const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
    dt.setDate(dt.getDate() + delta)
    return this.dayKey(dt)
  },

  isDoneOn(habit: Pick<Habit, 'completedDates'>, dayKey: string): boolean {
    return habit.completedDates.includes(dayKey)
  },

  /** Progresso da rotina (0–100) para um conjunto de hábitos num dado dia. */
  routineProgress(habits: Pick<Habit, 'completedDates'>[], dayKey: string): number {
    if (habits.length === 0) return 0
    const done = habits.filter((h) => h.completedDates.includes(dayKey)).length
    return Math.round((done / habits.length) * 100)
  },

  /**
   * Sequência (streak): dias consecutivos concluídos terminando hoje. É tolerante:
   * se hoje ainda não foi feito, conta a sequência que termina ontem.
   */
  streak(habit: Pick<Habit, 'completedDates'>, today: string): number {
    const done = new Set(habit.completedDates)
    let cursor = today
    if (!done.has(cursor)) {
      cursor = this.shift(today, -1)
      if (!done.has(cursor)) return 0
    }
    let count = 0
    while (done.has(cursor)) {
      count += 1
      cursor = this.shift(cursor, -1)
    }
    return count
  },

  /** Aderência (0–100) na janela de `windowDays` dias, a partir da criação. */
  completionRate(
    habit: Pick<Habit, 'completedDates' | 'createdAt'>,
    today: string,
    windowDays = 30,
  ): number {
    const done = new Set(habit.completedDates)
    const createdDay = habit.createdAt.slice(0, 10)
    let total = 0
    let hit = 0
    for (let i = 0; i < windowDays; i += 1) {
      const day = this.shift(today, -i)
      if (day < createdDay) break
      total += 1
      if (done.has(day)) hit += 1
    }
    return total === 0 ? 0 : Math.round((hit / total) * 100)
  },
} as const
