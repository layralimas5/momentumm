import { resolveHorizon } from './activation'
import { dayKeyToDate, dayRange, daysBetween, type DayKey } from './day'
import { horizonOf, minutesOf, type QuizAnswers } from './quiz'

/**
 * A conta do tempo que a pessoa reservou, até o prazo que ela escolheu.
 *
 * É a tela que a Cláudia usa pra prometer uma data ("em 12 de janeiro você
 * conversa solto"), feita do jeito que o Momentumm pode afirmar: não prevê
 * resultado nenhum, só soma o que a própria pessoa disse ter. 20 minutos, 3
 * dias por semana, até 10 de janeiro: são tantas sessões e tantas horas. A
 * conta anda pelo calendário de verdade (só os dias da semana marcados), não
 * por média, então o número bate com o que o plano vai pedir.
 */
export interface QuizTimeBank {
  readonly minutesPerSession: number
  readonly daysPerWeek: number
  readonly weeklyMinutes: number
  readonly deadline: DayKey
  /** A pessoa não escolheu prazo e a conta usou o que o plano assume. */
  readonly assumedDeadline: boolean
  readonly sessions: number
  readonly totalMinutes: number
  /** Minutos de cada semana, a partir de hoje. A última pode ser parcial. */
  readonly weeks: readonly number[]
}

export function quizTimeBank(answers: QuizAnswers, today: DayKey): QuizTimeBank | null {
  if (!answers.time || !answers.horizon || answers.weekdays.length === 0) return null

  const minutesPerSession = minutesOf(answers.time)
  const horizon = resolveHorizon(horizonOf(answers.horizon, today), today)
  const days = dayRange(today, horizon.deadline)
  // Semana sem sessão também aparece (com zero): o gráfico mostra o
  // calendário inteiro, não só as semanas cheias.
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, () => 0)
  let sessions = 0

  for (const day of days) {
    if (!answers.weekdays.includes(dayKeyToDate(day).getDay())) continue
    sessions += 1
    const week = Math.floor(daysBetween(today, day) / 7)
    weeks[week] = (weeks[week] ?? 0) + minutesPerSession
  }

  return {
    minutesPerSession,
    daysPerWeek: answers.weekdays.length,
    weeklyMinutes: minutesPerSession * answers.weekdays.length,
    deadline: horizon.deadline,
    assumedDeadline: horizon.assumed,
    sessions,
    totalMinutes: sessions * minutesPerSession,
    weeks,
  }
}

/** "40 minutos", "13 horas", "12h40". */
export function formatTotalTime(minutes: number): string {
  if (minutes < 60) return `${minutes} minutos`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return hours === 1 ? '1 hora' : `${hours} horas`
  return `${hours}h${String(rest).padStart(2, '0')}`
}

/**
 * A versão curta, pro contador grande: "40 min", "13h", "12h40". Nunca
 * quebra linha enquanto sobe, que é o que "0 minutos" fazia.
 */
export function formatCompactTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`
}
