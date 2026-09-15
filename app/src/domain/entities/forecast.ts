import { addDays, dayKeyOf, daysBetween, formatDayLong, type DayKey } from './day'
import { habitConsistency, type Habit, type HabitLog } from './habit'
import type { PlanProgress } from './plan-progress'
import { planRatioAt } from './plan-progress'

/**
 * Previsão de conclusão.
 *
 * A regra que manda aqui é a mais dura do arquivo: **sem dado, sem previsão**.
 * Um app que chuta uma data pra quem tem dois dias de uso não está ajudando,
 * está inventando — e quando a data erra, a pessoa para de acreditar em todos
 * os outros números da tela junto.
 *
 * A conta é velocidade: quanto do plano avançou na janela recente, extrapolado
 * pro que falta. Nada de curva, nada de peso escondido. A frase que sai daqui
 * sempre diz de onde veio o número e sempre é condicional — "mantendo esse
 * ritmo" —, porque é exatamente isso que ela é.
 */

/** Janela de observação da velocidade. Duas semanas absorvem um fim de semana ruim. */
export const FORECAST_WINDOW_DAYS = 14
/** Antes disso não há série: qualquer projeção seria ruído com casa decimal. */
export const MIN_HISTORY_DAYS = 7
/** Uma ação concluída não é ritmo, é evento. */
export const MIN_COMPLETED_TASKS = 2

export const FORECAST_KINDS = ['sem-dados', 'concluido', 'estimado'] as const
export type ForecastKind = (typeof FORECAST_KINDS)[number]

export const CONFIDENCES = ['baixa', 'media', 'alta'] as const
export type Confidence = (typeof CONFIDENCES)[number]

export interface Forecast {
  readonly kind: ForecastKind
  /** Dia estimado de conclusão. Null quando não há previsão possível. */
  readonly day: DayKey | null
  /** Dias além do prazo. Negativo significa adiantado. */
  readonly daysLate: number
  readonly confidence: Confidence
  /** Progresso ganho por dia na janela, de 0 a 1. */
  readonly dailyRate: number
  /** Consistência dos hábitos de apoio no período, de 0 a 1. Null sem hábito. */
  readonly consistency: number | null
  /** A frase pronta pra tela. Sempre condicional, nunca uma promessa. */
  readonly message: string
}

export interface ForecastInput {
  readonly plan: PlanProgress
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
  readonly today: DayKey
}

const NO_FORECAST_MESSAGE =
  'Ainda precisamos de mais alguns dias de atividade pra calcular uma previsão confiável.'

export function forecastOf(input: ForecastInput): Forecast {
  const { plan, today } = input
  const objective = plan.objective

  const consistency = consistencyOf(input)
  const empty = (kind: ForecastKind, message: string): Forecast => ({
    kind,
    day: null,
    daysLate: 0,
    confidence: 'baixa',
    dailyRate: 0,
    consistency,
    message,
  })

  if (plan.ratio >= 1 || objective.completedAt) {
    return { ...empty('concluido', 'Objetivo concluído.'), confidence: 'alta' }
  }

  if (!plan.hasPlan) {
    return empty(
      'sem-dados',
      'Esse objetivo ainda não tem etapas. A previsão nasce do plano: sem ele não há caminho pra medir.',
    )
  }

  const elapsed = daysBetween(objective.startedOn, today)
  if (elapsed < MIN_HISTORY_DAYS) {
    return empty('sem-dados', NO_FORECAST_MESSAGE)
  }

  const completed = plan.stages.reduce(
    (sum, stage) => sum + stage.tasks.filter((task) => task.completedAt !== null).length,
    0,
  )
  if (completed < MIN_COMPLETED_TASKS) {
    return empty('sem-dados', NO_FORECAST_MESSAGE)
  }

  // Janela recente, nunca a média desde o início: o ritmo de duas semanas atrás
  // é o que responde "se eu continuar assim", e a média histórica esconde tanto
  // a retomada quanto a parada.
  const windowDays = Math.min(FORECAST_WINDOW_DAYS, elapsed)
  const from = addDays(today, -windowDays)
  const gained = plan.ratio - planRatioAt(plan.stages, from, dayKeyOf)

  if (gained <= 0) {
    return empty(
      'sem-dados',
      `Nenhum avanço nas últimas ${windowDays === 1 ? '24 horas' : `${windowDays} ${windowDays === 1 ? 'dia' : 'dias'}`}: sem ritmo não dá pra projetar uma data. Concluir uma ação já devolve a previsão.`,
    )
  }

  const dailyRate = gained / windowDays
  const remaining = Math.max(0, 1 - plan.ratio)
  const daysNeeded = Math.ceil(remaining / dailyRate)
  const day = addDays(today, daysNeeded)
  const daysLate = daysBetween(objective.deadline, day)

  return {
    kind: 'estimado',
    day,
    daysLate,
    confidence: confidenceOf(windowDays, completed, consistency),
    dailyRate,
    consistency,
    message: messageOf({ day, daysLate, consistency, windowDays, gained }),
  }
}

function consistencyOf(input: ForecastInput): number | null {
  const supporting = input.habits.filter(
    (habit) => habit.objectiveId === input.plan.objective.id && habit.archivedAt === null,
  )
  if (supporting.length === 0) return null

  const from = addDays(input.today, -(FORECAST_WINDOW_DAYS - 1))
  const rates = supporting.map(
    (habit) => habitConsistency(habit, input.habitLogs, from, input.today).rate,
  )

  return rates.reduce((sum, rate) => sum + rate, 0) / rates.length
}

/**
 * Confiança da estimativa. Janela curta e poucas conclusões viram "baixa", e a
 * tela usa isso pra escolher o quanto destacar o número — previsão frágil não
 * pode aparecer do mesmo tamanho de uma com dois meses de série.
 */
function confidenceOf(
  windowDays: number,
  completed: number,
  consistency: number | null,
): Confidence {
  if (windowDays >= FORECAST_WINDOW_DAYS && completed >= 6 && (consistency ?? 1) >= 0.7) {
    return 'alta'
  }
  if (windowDays >= MIN_HISTORY_DAYS && completed >= 3) return 'media'
  return 'baixa'
}

function messageOf(input: {
  day: DayKey
  daysLate: number
  consistency: number | null
  windowDays: number
  gained: number
}): string {
  const date = formatDayLong(input.day)
  const base =
    input.consistency === null
      ? `Você avançou ${Math.round(input.gained * 100)}% do plano nos últimos ${input.windowDays} dias.`
      : `Você manteve ${Math.round(input.consistency * 100)}% de consistência nas últimas duas semanas.`

  if (input.daysLate <= 0) {
    const early = Math.abs(input.daysLate)
    return early === 0
      ? `${base} Mantendo esse ritmo, a previsão de conclusão é ${date}, em cima do prazo.`
      : `${base} Mantendo esse ritmo, a previsão de conclusão é ${date}, ${early} ${early === 1 ? 'dia' : 'dias'} antes do prazo.`
  }

  return `${base} Mantendo esse ritmo, a previsão de conclusão é ${date}: ${input.daysLate} ${input.daysLate === 1 ? 'dia' : 'dias'} depois do prazo.`
}

/** Rótulo curto pro card. A frase completa fica no `message`. */
export function forecastLabel(forecast: Forecast): string {
  switch (forecast.kind) {
    case 'concluido':
      return 'Concluído'
    case 'sem-dados':
      return 'Sem dados suficientes'
    case 'estimado':
      return forecast.day ? formatDayLong(forecast.day) : 'Sem dados suficientes'
  }
}
