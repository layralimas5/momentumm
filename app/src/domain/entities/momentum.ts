import type { Activity } from './activity'
import { totalMinutes } from './activity'
import type { CapacityProfile } from './checkin'
import { addDays, dayRange, type DayKey } from './day'
import { countsAsDone, isScheduledOn, type Habit, type HabitLog } from './habit'
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

const WEIGHTS = {
  consistency: 0.4,
  habits: 0.25,
  priorities: 0.2,
  volume: 0.15,
} as const

export interface MomentumInput {
  readonly activities: readonly Activity[]
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
  readonly tasks: readonly Task[]
  readonly today: DayKey
}

export interface MomentumParts {
  readonly consistency: number
  readonly habits: number
  readonly priorities: number
  readonly volume: number
}

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

export function calculateMomentum(input: MomentumInput): MomentumScore {
  const current = windowScore(input, input.today)
  const previousEnd = addDays(input.today, -MOMENTUM_WINDOW_DAYS)
  const previous = windowScore(input, previousEnd)

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

function windowScore(input: MomentumInput, end: DayKey): WindowScore {
  const start = addDays(end, -(MOMENTUM_WINDOW_DAYS - 1))
  const days = dayRange(start, end)

  const inWindow = <T extends { readonly day: DayKey }>(items: readonly T[]): T[] =>
    items.filter((item) => item.day >= start && item.day <= end)

  const activities = inWindow(input.activities)
  const logs = inWindow(input.habitLogs)
  const tasks = inWindow(input.tasks)

  const activeDays = new Set(activities.map((activity) => activity.day)).size
  const consistency = activeDays / MOMENTUM_WINDOW_DAYS

  const scheduled = days.reduce(
    (total, day) =>
      total + input.habits.filter((habit) => isScheduledOn(habit, day)).length,
    0,
  )
  const habitsDone = logs.filter((log) => countsAsDone(log.status)).length
  const habits = scheduled === 0 ? consistency : Math.min(1, habitsDone / scheduled)

  const plannedTasks = tasks.length
  const doneTasks = tasks.filter((task) => task.status === 'feita').length
  const priorities = plannedTasks === 0 ? consistency : Math.min(1, doneTasks / plannedTasks)

  const ceiling = VOLUME_CEILING_MIN * MOMENTUM_WINDOW_DAYS
  const volume = Math.min(1, totalMinutes(activities) / ceiling)

  const parts: MomentumParts = { consistency, habits, priorities, volume }

  const value =
    (consistency * WEIGHTS.consistency +
      habits * WEIGHTS.habits +
      priorities * WEIGHTS.priorities +
      volume * WEIGHTS.volume) *
    100

  return { value, activeDays, parts }
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
