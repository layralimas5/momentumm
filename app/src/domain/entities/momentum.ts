import type { Activity } from './activity'
import { totalMinutes } from './activity'
import type { CapacityProfile } from './checkin'
import { addDays, dayRange, type DayKey } from './day'
import {
  countsAsDone,
  isScheduledOn,
  scheduledCountBetween,
  type Habit,
  type HabitLog,
} from './habit'
import type { Task } from './task'

/**
 * Momentum: o ritmo da pessoa, não a nota dela.
 *
 * A regra que manda aqui é a do produto: número sem leitura é inútil. Por isso
 * o cálculo devolve, junto com a pontuação, a classificação, a comparação com a
 * semana anterior, uma explicação em português e UMA recomendação prática. Se
 * um número não muda a decisão de hoje, ele não deveria estar na tela.
 *
 * O score olha os últimos 7 dias e mede quatro coisas, em ordem de peso:
 *   1. Constância  — em quantos dias a pessoa moveu alguma coisa
 *   2. Hábitos     — o que estava programado e foi cumprido
 *   3. Prioridades — ações concluídas
 *   4. Volume      — minutos investidos, com teto pra não premiar exagero
 *
 * Constância pesa mais que volume de propósito: sete dias de dez minutos valem
 * mais que um dia de duas horas.
 */

export const MOMENTUM_WINDOW_DAYS = 7

export const MOMENTUM_LEVELS = ['desacelerando', 'retomando', 'constante', 'avancando'] as const
export type MomentumLevel = (typeof MOMENTUM_LEVELS)[number]

export const MOMENTUM_LEVEL_LABELS: Readonly<Record<MomentumLevel, string>> = {
  desacelerando: 'Desacelerando',
  retomando: 'Retomando',
  constante: 'Constante',
  avancando: 'Avançando',
}

/** Minutos diários a partir dos quais o volume deixa de somar pontos. */
const VOLUME_CEILING_MIN = 90

/**
 * Os pesos do score, em um lugar só e somando 1.
 *
 * Ficam exportados de propósito: a calibragem certa desses números só aparece
 * com uso real, e mexer neles não pode exigir caçar constantes espalhadas pelo
 * arquivo. Qualquer ajuste futuro acontece aqui e o resto continua valendo.
 *
 * `recovery` é o fator que o produto não pode não ter: quem volta depois de
 * uma semana parada precisa ver o número subir na primeira ação, senão o score
 * vira mais um motivo pra não voltar.
 */
export interface MomentumWeights {
  readonly consistency: number
  readonly habits: number
  readonly priorities: number
  readonly volume: number
  readonly recovery: number
}

export const DEFAULT_MOMENTUM_WEIGHTS: MomentumWeights = {
  consistency: 0.35,
  habits: 0.22,
  priorities: 0.18,
  volume: 0.1,
  recovery: 0.15,
}

export const MOMENTUM_PART_LABELS: Readonly<Record<keyof MomentumWeights, string>> = {
  consistency: 'Constância',
  habits: 'Hábitos',
  priorities: 'Ações',
  volume: 'Volume',
  recovery: 'Retomada',
}

export interface MomentumInput {
  readonly activities: readonly Activity[]
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
  readonly tasks: readonly Task[]
  readonly today: DayKey
}

export type MomentumParts = Readonly<Record<keyof MomentumWeights, number>>

export interface MomentumScore {
  /** 0 a 100. */
  readonly value: number
  readonly level: MomentumLevel
  /** Diferença em pontos contra os 7 dias anteriores. */
  readonly delta: number
  readonly activeDays: number
  readonly parts: MomentumParts
  /** Uma frase que explica o número em linguagem de gente. */
  readonly explanation: string
}

export function calculateMomentum(
  input: MomentumInput,
  weights: MomentumWeights = DEFAULT_MOMENTUM_WEIGHTS,
): MomentumScore {
  const current = windowScore(input, input.today, weights)
  const previousEnd = addDays(input.today, -MOMENTUM_WINDOW_DAYS)
  const previous = windowScore(input, previousEnd, weights)

  const value = Math.round(current.value)
  const delta = value - Math.round(previous.value)
  const level = levelOf(value, delta, current.activeDays)

  return {
    value,
    level,
    delta,
    activeDays: current.activeDays,
    parts: current.parts,
    explanation: explain(level, value, delta, current.activeDays),
  }
}

interface WindowScore {
  readonly value: number
  readonly activeDays: number
  readonly parts: MomentumParts
}

function windowScore(
  input: MomentumInput,
  end: DayKey,
  weights: MomentumWeights,
): WindowScore {
  const start = addDays(end, -(MOMENTUM_WINDOW_DAYS - 1))

  const inWindow = <T extends { readonly day: DayKey }>(items: readonly T[]): T[] =>
    items.filter((item) => item.day >= start && item.day <= end)

  const activities = inWindow(input.activities)
  const logs = inWindow(input.habitLogs)
  const tasks = inWindow(input.tasks)

  const activeDays = new Set(activities.map((activity) => activity.day)).size
  const consistency = activeDays / MOMENTUM_WINDOW_DAYS

  const scheduled = input.habits.reduce(
    (total, habit) => total + scheduledCountBetween(habit, start, end),
    0,
  )
  const habitsDone = logs.filter((log) => countsAsDone(log.status)).length
  const habits = scheduled === 0 ? consistency : Math.min(1, habitsDone / scheduled)

  // Cancelada sai da conta: largar uma ação conscientemente não é o mesmo que
  // deixá-la pendente, e punir a decisão empurra a pessoa a mentir pro app.
  const counted = tasks.filter((task) => task.status !== 'cancelada')
  const doneTasks = counted.filter((task) => task.status === 'feita').length
  const priorities = counted.length === 0 ? consistency : Math.min(1, doneTasks / counted.length)

  const ceiling = VOLUME_CEILING_MIN * MOMENTUM_WINDOW_DAYS
  const volume = Math.min(1, totalMinutes(activities) / ceiling)

  const recovery = recoveryScore(input, start, end, consistency)

  const parts: MomentumParts = { consistency, habits, priorities, volume, recovery }

  const value =
    (consistency * weights.consistency +
      habits * weights.habits +
      priorities * weights.priorities +
      volume * weights.volume +
      recovery * weights.recovery) *
    100

  return { value, activeDays, parts }
}

/** Dias parados a partir dos quais voltar conta como retomada de verdade. */
const GAP_FOR_RECOVERY = 2

/**
 * Retomada: o quanto a pessoa consegue voltar depois de parar.
 *
 * A conta olha cada intervalo sem registro dentro da janela e mede se ele foi
 * fechado. Quem nunca parou recebe a nota da própria constância — não faz
 * sentido penalizar quem não precisou se recuperar de nada. Quem parou e voltou
 * recebe nota cheia, e é essa a regra que impede um único dia perdido de
 * derrubar o score: o dia seguinte devolve o ponto.
 */
function recoveryScore(
  input: MomentumInput,
  start: DayKey,
  end: DayKey,
  consistency: number,
): number {
  const moved = new Set<DayKey>()
  for (const activity of input.activities) moved.add(activity.day)
  for (const log of input.habitLogs) if (countsAsDone(log.status)) moved.add(log.day)
  for (const task of input.tasks) if (task.status === 'feita') moved.add(task.day)

  const days = dayRange(start, end)

  let gaps = 0
  let closed = 0
  let running = 0

  for (const day of days) {
    if (moved.has(day)) {
      if (running >= GAP_FOR_RECOVERY) {
        gaps += 1
        closed += 1
      }
      running = 0
      continue
    }
    running += 1
  }

  // Buraco ainda aberto no fim da janela: conta como pausa não retomada.
  if (running >= GAP_FOR_RECOVERY) gaps += 1

  if (gaps === 0) return consistency
  return closed / gaps
}

function levelOf(value: number, delta: number, activeDays: number): MomentumLevel {
  // Subir depois de um período parado é "retomando", mesmo com pontuação baixa:
  // é a informação que faz a pessoa continuar.
  if (delta >= 8 && value < 55) return 'retomando'
  if (value >= 70) return 'avancando'
  if (delta <= -8 || activeDays <= 2) return 'desacelerando'
  if (value >= 45) return 'constante'
  return delta > 0 ? 'retomando' : 'desacelerando'
}

function explain(
  level: MomentumLevel,
  value: number,
  delta: number,
  activeDays: number,
): string {
  const comparison =
    delta === 0
      ? 'no mesmo ponto da semana passada'
      : delta > 0
        ? `${delta} pontos acima da semana passada`
        : `${Math.abs(delta)} pontos abaixo da semana passada`

  const presence = `Você se moveu em ${activeDays} dos últimos ${MOMENTUM_WINDOW_DAYS} dias`

  switch (level) {
    case 'avancando':
      return `${presence} e está ${comparison}. O ritmo está alto e sustentável.`
    case 'constante':
      return `${presence} e está ${comparison}. Constância é exatamente o que faz o número subir.`
    case 'retomando':
      return `${presence} e está ${comparison}. O movimento voltou, ainda é cedo pra cobrar volume.`
    case 'desacelerando':
      return value === 0
        ? 'Ainda não há registro suficiente pra medir teu ritmo. O primeiro movimento resolve isso.'
        : `${presence} e está ${comparison}. Nada quebrado: um dia registrado já muda essa curva.`
  }
}

/**
 * A recomendação prática. Depende do ritmo E da capacidade de hoje: em dia de
 * baixa energia o app sugere a versão mínima em vez de empurrar o plano cheio.
 */
export function recommendationFor(score: MomentumScore, capacity: CapacityProfile): string {
  if (capacity.preferMinimal) {
    return score.level === 'desacelerando'
      ? 'Hoje não é dia de compensar. Faz a versão mínima da tua prioridade e encerra o dia em paz.'
      : 'Energia baixa com ritmo bom: mantém a versão mínima e preserva a sequência.'
  }

  switch (score.level) {
    case 'avancando':
      return 'Ritmo alto: usa o dia pra avançar na meta mais parada, não pra adicionar mais coisa.'
    case 'constante':
      return 'Conclui a prioridade principal antes de abrir qualquer outra frente.'
    case 'retomando':
      return 'Você está retomando o ritmo. Não tenta compensar tudo hoje: conclui a prioridade principal e preserva a sequência.'
    case 'desacelerando':
      return 'Escolhe uma ação só e faz ela pequena. Voltar é mais importante que acertar o tamanho.'
  }
}

export interface MomentumFactor {
  readonly key: keyof MomentumWeights
  readonly label: string
  /** 0 a 1: quanto desse fator a pessoa cumpriu. */
  readonly value: number
  /** Pontos que esse fator entregou dos 100. */
  readonly points: number
  /** Máximo que ele poderia entregar. */
  readonly maxPoints: number
}

/**
 * O score aberto em fatores. Existe pro número não ser um oráculo: a pessoa
 * precisa ver de onde vieram os pontos pra saber o que mexer amanhã.
 */
export function momentumFactors(
  score: MomentumScore,
  weights: MomentumWeights = DEFAULT_MOMENTUM_WEIGHTS,
): MomentumFactor[] {
  return (Object.keys(weights) as (keyof MomentumWeights)[]).map((key) => ({
    key,
    label: MOMENTUM_PART_LABELS[key],
    value: score.parts[key],
    points: Math.round(score.parts[key] * weights[key] * 100),
    maxPoints: Math.round(weights[key] * 100),
  }))
}

/** O fator que mais deixou pontos na mesa. É o que vira sugestão de ajuste. */
export function weakestFactor(
  score: MomentumScore,
  weights: MomentumWeights = DEFAULT_MOMENTUM_WEIGHTS,
): MomentumFactor | null {
  const gaps = momentumFactors(score, weights)
    .map((factor) => ({ factor, gap: factor.maxPoints - factor.points }))
    .sort((a, b) => b.gap - a.gap)

  const worst = gaps[0]
  return worst && worst.gap > 0 ? worst.factor : null
}

export interface DayDot {
  readonly day: DayKey
  /** 0 a 1: o quanto do dia foi cumprido. */
  readonly intensity: number
  readonly minutes: number
  readonly habitsDone: number
  readonly tasksDone: number
}

/** Os últimos sete dias em forma de série, pro gráfico do progresso semanal. */
export function dailySeries(input: MomentumInput, end: DayKey = input.today): DayDot[] {
  const start = addDays(end, -(MOMENTUM_WINDOW_DAYS - 1))

  return dayRange(start, end).map((day) => {
    const minutes = totalMinutes(input.activities.filter((activity) => activity.day === day))
    const scheduled = input.habits.filter((habit) => isScheduledOn(habit, day)).length
    const habitsDone = input.habitLogs.filter(
      (log) => log.day === day && countsAsDone(log.status),
    ).length
    const tasksDone = input.tasks.filter(
      (task) => task.day === day && task.status === 'feita',
    ).length

    const habitRatio = scheduled === 0 ? 0 : Math.min(1, habitsDone / scheduled)
    const volumeRatio = Math.min(1, minutes / VOLUME_CEILING_MIN)
    const taskRatio = Math.min(1, tasksDone / 2)

    const intensity =
      scheduled === 0
        ? Math.max(volumeRatio, taskRatio)
        : habitRatio * 0.5 + volumeRatio * 0.3 + taskRatio * 0.2

    return { day, intensity: Number(intensity.toFixed(2)), minutes, habitsDone, tasksDone }
  })
}
