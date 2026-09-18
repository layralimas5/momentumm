import { totalMinutes } from './activity'
import { activityType, type ActivityTypeSlug } from './activity-type'
import { averageEnergy, type CheckIn } from './checkin'
import { addDays, dayKeyOf, dayKeyToDate, dayRange, type DayKey } from './day'
import { countsAsDone, isScheduledOn, type Habit } from './habit'
import {
  calculateMomentum,
  dailySeries,
  MOMENTUM_WINDOW_DAYS,
  type DayDot,
  type MomentumInput,
  type MomentumScore,
} from './momentum'
import type { ObjectiveProgress } from './objective'

/**
 * Review da semana.
 *
 * O dashboard responde "o que eu faço agora". A review responde outra coisa:
 * "o que a semana inteira me ensinou". São perguntas diferentes e por isso a
 * tela é outra — misturar as duas transforma o dia em relatório.
 *
 * A ordem das respostas é fixa: como foi, quanto do planejado saiu, onde o
 * ritmo caiu, onde ele subiu, e o que mudar na semana que vem. Cada bloco sai
 * de contagem real. Sem padrão detectado, o bloco não escreve nada — o produto
 * inteiro é uma aposta contra a frase motivacional genérica.
 */

export interface ReviewInput extends MomentumInput {
  readonly checkIns: readonly CheckIn[]
  readonly objectives: readonly ObjectiveProgress[]
  /** Semanas pra trás: 0 é a semana que termina hoje. */
  readonly weeksAgo?: number
}

export interface ExecutionRate {
  readonly planned: number
  readonly done: number
  /** 0 a 1. */
  readonly rate: number
  readonly habitsPlanned: number
  readonly habitsDone: number
  readonly tasksPlanned: number
  readonly tasksDone: number
}

export interface ReviewPoint {
  readonly id: string
  readonly title: string
  readonly detail: string
}

export const REVIEW_ACTIONS = [
  'reduzir-carga',
  'manter-plano',
  'aumentar-carga',
  'trocar-horario',
  'retomar-do-zero',
  'ajustar-prazo',
] as const
export type ReviewAction = (typeof REVIEW_ACTIONS)[number]

export interface ReviewRecommendation {
  readonly action: ReviewAction
  readonly title: string
  readonly detail: string
}

export interface WeekReview {
  readonly start: DayKey
  readonly end: DayKey
  readonly series: readonly DayDot[]
  readonly execution: ExecutionRate
  readonly previousExecution: ExecutionRate
  readonly activeDays: number
  readonly previousActiveDays: number
  readonly focusMinutes: number
  readonly previousFocusMinutes: number
  /**
   * O Momentumm no fim da semana revisada, pela MESMA fórmula do dashboard.
   * A review não tem conta própria de ritmo: ela lê o score que a pessoa viu
   * no domingo, com a variação contra o domingo anterior.
   */
  readonly momentum: MomentumScore
  /** Onde o ritmo caiu. Vazio quando nada caiu. */
  readonly lost: readonly ReviewPoint[]
  /** Onde a semana evoluiu. Vazio quando nada subiu. */
  readonly gained: readonly ReviewPoint[]
  readonly recommendation: ReviewRecommendation
  /** A semana em uma frase. */
  readonly headline: string
  /** Falso quando a semana não tem registro suficiente pra concluir nada. */
  readonly ready: boolean
}

const WEEKDAY_NAMES = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
] as const

/** Abaixo disso a semana não sustenta conclusão nenhuma. */
const MIN_ACTIVE_DAYS_FOR_READING = 2
/** Diferença a partir da qual uma variação vira notícia, e não ruído. */
const MEANINGFUL_DELTA = 0.1

export function reviewWeek(input: ReviewInput): WeekReview {
  const weeksAgo = Math.max(0, input.weeksAgo ?? 0)
  const end = addDays(input.today, -weeksAgo * MOMENTUM_WINDOW_DAYS)
  const start = addDays(end, -(MOMENTUM_WINDOW_DAYS - 1))
  const previousEnd = addDays(start, -1)

  const series = dailySeries({ ...input, today: end }, end)
  const execution = executionBetween(input, start, end)
  const previousExecution = executionBetween(
    input,
    addDays(previousEnd, -(MOMENTUM_WINDOW_DAYS - 1)),
    previousEnd,
  )

  const activeDays = activeDaysBetween(input, start, end)
  const previousActiveDays = activeDaysBetween(
    input,
    addDays(previousEnd, -(MOMENTUM_WINDOW_DAYS - 1)),
    previousEnd,
  )

  const focusMinutes = minutesBetween(input, start, end)
  const previousFocusMinutes = minutesBetween(
    input,
    addDays(previousEnd, -(MOMENTUM_WINDOW_DAYS - 1)),
    previousEnd,
  )

  const ready = activeDays >= MIN_ACTIVE_DAYS_FOR_READING || execution.planned > 0

  const momentum = calculateMomentum({ ...input, today: end })

  const lost = ready ? findLosses(input, { start, end, execution, previousExecution, series }) : []
  const gained = ready
    ? findGains(input, {
        start,
        end,
        execution,
        previousExecution,
        activeDays,
        previousActiveDays,
        focusMinutes,
        previousFocusMinutes,
      })
    : []

  return {
    start,
    end,
    series,
    execution,
    previousExecution,
    activeDays,
    previousActiveDays,
    focusMinutes,
    previousFocusMinutes,
    momentum,
    lost,
    gained,
    recommendation: recommend(input, { execution, previousExecution, activeDays, lost, ready }),
    headline: headlineOf({ ready, execution, activeDays, previousActiveDays }),
    ready,
  }
}

// ---------------------------------------------------------------------------
// contagens
// ---------------------------------------------------------------------------

/**
 * Hábito programado no dia, respeitando a data em que ele passou a existir.
 *
 * A review NÃO pode cobrar dias anteriores à criação do hábito: quem monta o
 * plano numa quinta abriria a primeira review já devendo quatro dias, e a
 * primeira leitura que a pessoa recebe do produto seria uma acusação falsa.
 */
function wasScheduledOn(habit: Habit, day: DayKey): boolean {
  return isScheduledOn(habit, day) && day >= dayKeyOf(habit.createdAt)
}

function executionBetween(input: ReviewInput, start: DayKey, end: DayKey): ExecutionRate {
  const days = dayRange(start, end)

  const habitsPlanned = days.reduce(
    (total, day) => total + input.habits.filter((habit) => wasScheduledOn(habit, day)).length,
    0,
  )
  const habitsDone = input.habitLogs.filter(
    (log) => within(log.day, start, end) && countsAsDone(log.status),
  ).length

  const weekTasks = input.tasks.filter((task) => within(task.day, start, end))
  const tasksPlanned = weekTasks.length
  const tasksDone = weekTasks.filter((task) => task.status === 'feita').length

  const planned = habitsPlanned + tasksPlanned
  const done = Math.min(planned, habitsDone + tasksDone)

  return {
    planned,
    done,
    rate: planned === 0 ? 0 : done / planned,
    habitsPlanned,
    habitsDone,
    tasksPlanned,
    tasksDone,
  }
}

function activeDaysBetween(input: ReviewInput, start: DayKey, end: DayKey): number {
  const days = new Set<DayKey>()
  for (const activity of input.activities) {
    if (within(activity.day, start, end)) days.add(activity.day)
  }
  for (const log of input.habitLogs) {
    if (within(log.day, start, end) && countsAsDone(log.status)) days.add(log.day)
  }
  return days.size
}

function minutesBetween(input: ReviewInput, start: DayKey, end: DayKey): number {
  return totalMinutes(input.activities.filter((activity) => within(activity.day, start, end)))
}

function within(day: DayKey, start: DayKey, end: DayKey): boolean {
  return day >= start && day <= end
}

// ---------------------------------------------------------------------------
// onde perdeu ritmo
// ---------------------------------------------------------------------------

interface LossContext {
  readonly start: DayKey
  readonly end: DayKey
  readonly execution: ExecutionRate
  readonly previousExecution: ExecutionRate
  readonly series: readonly DayDot[]
}

function findLosses(input: ReviewInput, context: LossContext): ReviewPoint[] {
  const points: ReviewPoint[] = []

  const emptyDays = context.series.filter((dot) => dot.intensity === 0)
  if (emptyDays.length > 0 && emptyDays.length < MOMENTUM_WINDOW_DAYS) {
    const names = emptyDays.map((dot) => WEEKDAY_NAMES[dayKeyToDate(dot.day).getDay()] ?? '')
    points.push({
      id: 'dias-vazios',
      title: emptyDays.length === 1 ? 'Um dia sem registro' : `${emptyDays.length} dias sem registro`,
      detail: `Nada foi registrado ${listOf(names)}. Um dia em branco não quebra nada; o padrão é que muda o resultado.`,
    })
  }

  const worstHabit = weakestHabit(input, context.start, context.end)
  if (worstHabit) {
    points.push({
      id: `habito-${worstHabit.habit.id}`,
      title: `“${worstHabit.habit.name}” ficou pra trás`,
      detail: `Estava programado ${worstHabit.planned} ${worstHabit.planned === 1 ? 'vez' : 'vezes'} e saiu ${worstHabit.done}. É o hábito que mais custou a acontecer nessa semana.`,
    })
  }

  const postponed = input.tasks.filter(
    (task) => within(task.day, context.start, context.end) && task.status === 'adiada',
  ).length
  if (postponed >= 2) {
    points.push({
      id: 'acoes-adiadas',
      title: `${postponed} ações adiadas`,
      detail:
        'Ação adiada mais de uma vez costuma estar grande demais, não urgente demais. Cortar pela metade resolve mais que reagendar.',
    })
  }

  if (
    context.previousExecution.planned > 0 &&
    context.execution.rate < context.previousExecution.rate - MEANINGFUL_DELTA
  ) {
    points.push({
      id: 'execucao-caiu',
      title: 'A execução caiu',
      detail: `Você cumpriu ${percent(context.execution.rate)} do planejado contra ${percent(context.previousExecution.rate)} na semana anterior.`,
    })
  }

  return points
}

interface WeakHabit {
  readonly habit: Habit
  readonly planned: number
  readonly done: number
}

function weakestHabit(input: ReviewInput, start: DayKey, end: DayKey): WeakHabit | null {
  const days = dayRange(start, end)

  const scored = input.habits
    .map((habit) => {
      const planned = days.filter((day) => wasScheduledOn(habit, day)).length
      const done = input.habitLogs.filter(
        (log) => log.habitId === habit.id && within(log.day, start, end) && countsAsDone(log.status),
      ).length
      return { habit, planned, done }
    })
    // Hábito com uma ocorrência só não sustenta conclusão sobre constância.
    .filter((item) => item.planned >= 2 && item.done < item.planned)
    .sort((a, b) => a.done / a.planned - b.done / b.planned)

  return scored[0] ?? null
}

// ---------------------------------------------------------------------------
// onde evoluiu
// ---------------------------------------------------------------------------

interface GainContext {
  readonly start: DayKey
  readonly end: DayKey
  readonly execution: ExecutionRate
  readonly previousExecution: ExecutionRate
  readonly activeDays: number
  readonly previousActiveDays: number
  readonly focusMinutes: number
  readonly previousFocusMinutes: number
}

function findGains(input: ReviewInput, context: GainContext): ReviewPoint[] {
  const points: ReviewPoint[] = []

  if (context.activeDays > context.previousActiveDays) {
    points.push({
      id: 'presenca',
      title: 'Você apareceu mais vezes',
      detail: `${context.activeDays} dias com movimento contra ${context.previousActiveDays} na semana anterior. Presença é o que mais pesa no Momentumm.`,
    })
  }

  if (
    context.previousExecution.planned > 0 &&
    context.execution.rate > context.previousExecution.rate + MEANINGFUL_DELTA
  ) {
    points.push({
      id: 'execucao-subiu',
      title: 'A execução subiu',
      detail: `${percent(context.execution.rate)} do planejado cumprido, contra ${percent(context.previousExecution.rate)} na semana passada.`,
    })
  }

  const axis = strongestAxis(input, context.start, context.end)
  if (axis) {
    const type = activityType(axis.slug)
    points.push({
      id: `eixo-${axis.slug}`,
      title: `${type.label} foi o eixo que mais andou`,
      detail: `${axis.value} ${axis.value === 1 ? type.unitLabel.one : type.unitLabel.many} nessa semana, distribuídos em ${axis.days} ${axis.days === 1 ? 'dia' : 'dias'}.`,
    })
  }

  const closing = input.objectives.filter(
    (progress) => progress.status === 'no-prazo' || progress.status === 'concluido',
  )
  if (closing.length > 0) {
    const first = closing[0]
    if (first) {
      points.push({
        id: `objetivo-${first.objective.id}`,
        title:
          first.status === 'concluido'
            ? `“${first.objective.title}” está fechado`
            : `“${first.objective.title}” segue no prazo`,
        detail: first.summary,
      })
    }
  }

  return points
}

interface AxisSummary {
  readonly slug: ActivityTypeSlug
  readonly value: number
  readonly days: number
}

function strongestAxis(input: ReviewInput, start: DayKey, end: DayKey): AxisSummary | null {
  const totals = new Map<ActivityTypeSlug, { value: number; days: Set<DayKey> }>()

  for (const activity of input.activities) {
    if (!within(activity.day, start, end)) continue
    const current = totals.get(activity.type) ?? { value: 0, days: new Set<DayKey>() }
    current.value += activity.value
    current.days.add(activity.day)
    totals.set(activity.type, current)
  }

  let best: AxisSummary | null = null
  for (const [slug, item] of totals) {
    // Empate resolve pela constância, não pelo volume: é a regra do produto.
    if (!best || item.days.size > best.days || (item.days.size === best.days && item.value > best.value)) {
      best = { slug, value: item.value, days: item.days.size }
    }
  }

  return best
}

// ---------------------------------------------------------------------------
// recomendação da próxima semana
// ---------------------------------------------------------------------------

interface RecommendationContext {
  readonly execution: ExecutionRate
  readonly previousExecution: ExecutionRate
  readonly activeDays: number
  readonly lost: readonly ReviewPoint[]
  readonly ready: boolean
}

/** Acima disso a semana pede mais; abaixo, pede menos. */
const HIGH_EXECUTION = 0.85
const LOW_EXECUTION = 0.5

function recommend(input: ReviewInput, context: RecommendationContext): ReviewRecommendation {
  if (!context.ready) {
    return {
      action: 'retomar-do-zero',
      title: 'Recomeça pequeno',
      detail:
        'A semana ficou sem registro suficiente pra concluir qualquer coisa. Escolhe uma ação só pra segunda e deixa o resto pra depois: voltar vale mais que acertar o tamanho.',
    }
  }

  const behind = input.objectives.filter(
    (progress) => progress.status === 'atrasado' || progress.status === 'vencido',
  )

  if (context.execution.rate < LOW_EXECUTION && context.execution.planned >= MOMENTUM_WINDOW_DAYS) {
    return {
      action: 'reduzir-carga',
      title: 'Planeja menos na próxima semana',
      detail: `Você cumpriu ${percent(context.execution.rate)} do que planejou. O problema não foi disciplina, foi volume: reduz o plano ao que cabe em ${Math.max(3, context.activeDays)} dias e deixa o resto de fora.`,
    }
  }

  if (behind.length > 0) {
    const first = behind[0]
    return {
      action: 'ajustar-prazo',
      title: 'Ajusta o prazo antes de forçar o ritmo',
      detail: first
        ? `“${first.objective.title}” pede ${Math.ceil(first.dailyPace)} por dia pra fechar na data. Se esse número não cabe na tua semana real, muda a data em vez de abandonar o objetivo.`
        : 'Um objetivo está fora do ritmo. Ajusta a data em vez de tentar compensar tudo numa semana.',
    }
  }

  if (context.execution.rate >= HIGH_EXECUTION && context.activeDays >= 5) {
    return {
      action: 'aumentar-carga',
      title: 'Dá pra subir um degrau',
      detail: `${percent(context.execution.rate)} de execução em ${context.activeDays} dias ativos. Aumenta o alvo do hábito principal ou adiciona uma ação por semana, nunca as duas coisas juntas.`,
    }
  }

  const energy = averageEnergy(input.checkIns)
  if (energy !== null && energy <= 2.5) {
    return {
      action: 'trocar-horario',
      title: 'Testa outro horário',
      detail:
        'A energia registrada nos check-ins ficou baixa a semana inteira. Antes de mexer no plano, tenta mover a prioridade principal pra primeira hora do dia por uma semana.',
    }
  }

  if (context.lost.length > 0) {
    return {
      action: 'manter-plano',
      title: 'Mantém o plano e protege o ponto fraco',
      detail: `${context.lost[0]?.title ?? 'Um ponto ficou pra trás'}. Mantém o resto igual e trata só isso: mudar tudo de uma vez apaga a informação de qual mudança funcionou.`,
    }
  }

  return {
    action: 'manter-plano',
    title: 'Repete a semana',
    detail: `${percent(context.execution.rate)} de execução com o plano atual. Não mexe: constância repetida é o que faz o número subir.`,
  }
}

function headlineOf(input: {
  ready: boolean
  execution: ExecutionRate
  activeDays: number
  previousActiveDays: number
}): string {
  if (!input.ready) {
    return 'A semana passou quase sem registro. Sem dado não há leitura, e leitura inventada não ajuda ninguém.'
  }

  const presence = `Você se moveu em ${input.activeDays} dos ${MOMENTUM_WINDOW_DAYS} dias`
  const comparison =
    input.activeDays === input.previousActiveDays
      ? 'o mesmo tanto da semana anterior'
      : input.activeDays > input.previousActiveDays
        ? `${input.activeDays - input.previousActiveDays} a mais que na semana anterior`
        : `${input.previousActiveDays - input.activeDays} a menos que na semana anterior`

  if (input.execution.planned === 0) {
    return `${presence}, ${comparison}. Ainda não havia plano pra comparar.`
  }

  return `${presence}, ${comparison}, e cumpriu ${percent(input.execution.rate)} do que estava planejado.`
}

export function percent(ratio: number): string {
  return `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`
}

function listOf(items: readonly string[]): string {
  if (items.length === 1) return `na ${items[0]}`
  const head = items.slice(0, -1).join(', ')
  return `na ${head} e na ${items[items.length - 1]}`
}

/** Rótulo do intervalo da semana, pro cabeçalho da tela. */
export function weekRangeLabel(start: DayKey, end: DayKey): string {
  const format = (day: DayKey) =>
    dayKeyToDate(day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  return `${format(start)} a ${format(end)}`
}
