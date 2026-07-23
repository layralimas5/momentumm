/**
 * Motor da jornada — a camada que costura os módulos soltos (metas, hábitos,
 * leituras, diário, missões) numa progressão só: XP, nível e sequência global.
 * É o que transforma "vários apps" numa transformação com direção.
 *
 * Domínio puro e determinístico: recebe um retrato do que a usuária já fez e
 * devolve os números. Sem framework, banco, relógio ou aleatoriedade.
 */

import { streakEndingToday, type DayKey } from './day'
import { GoalRules, type Goal } from './goal'
import type { Book } from './book'
import type { Habit } from './habit'

/** Quanto cada conquista vale. Único lugar que define o "peso" de cada ação. */
export const XP = {
  /** Por hábito concluído num dia (soma todos os dias de todos os hábitos). */
  habitCompletion: 10,
  /** Por missão diária concluída. */
  missionCompletion: 15,
  /** Por entrada de diário. */
  diaryEntry: 8,
  /** Por meta concluída. */
  goalCompleted: 100,
  /** Por livro lido até o fim. */
  bookRead: 60,
} as const

/** Nomes dos níveis — a jornada da mulher em construção. */
export const LEVEL_NAMES = [
  'Semente',
  'Desperta',
  'Em movimento',
  'Constante',
  'Florescendo',
  'Radiante',
  'Imparável',
  'Lendária',
] as const

/**
 * XP acumulado necessário para *alcançar* um nível. Curva suave e previsível:
 * nível 1 = 0, 2 = 100, 3 = 300, 4 = 600, 5 = 1000... (50·(n−1)·n).
 */
export function xpThresholdForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level))
  return 50 * (n - 1) * n
}

/** Retrato do que a usuária já fez — a entrada do motor. */
export interface JourneySnapshot {
  habits: Pick<Habit, 'completedDates'>[]
  /** Dias com missão concluída (YYYY-MM-DD). */
  missionDates: DayKey[]
  /** Dias com entrada de diário (YYYY-MM-DD). */
  diaryDates: DayKey[]
  goals: Pick<Goal, 'progress' | 'status'>[]
  books: Pick<Book, 'status'>[]
  today: DayKey
}

/** De onde veio cada pedaço de XP — para mostrar à usuária o que a fez crescer. */
export interface XpBreakdown {
  habits: number
  missions: number
  diary: number
  goals: number
  books: number
}

export interface JourneyProgress {
  totalXp: number
  breakdown: XpBreakdown
  level: number
  levelName: string
  /** É o último nível nomeado? (não há "próximo" a exibir). */
  isMaxLevel: boolean
  /** XP acumulado dentro do nível atual. */
  xpIntoLevel: number
  /** XP que o nível atual exige para o próximo (0 no nível máximo). */
  xpForNextLevel: number
  /** Progresso 0–100 rumo ao próximo nível (100 no nível máximo). */
  progressPercent: number
  /** Sequência de dias ativos consecutivos terminando hoje. */
  streak: number
}

/** Maior nível cujo limiar de XP já foi alcançado (≥ 1). */
function levelForXp(totalXp: number): number {
  let level = 1
  while (level < LEVEL_NAMES.length && xpThresholdForLevel(level + 1) <= totalXp) {
    level += 1
  }
  return level
}

/**
 * Dia é "ativo" se a usuária cumpriu algo do compromisso diário nele: um hábito,
 * a missão ou o diário. Metas e livros contam XP, mas não têm data por dia, então
 * não entram na sequência (senão bastaria uma meta antiga pra fingir constância).
 */
function activeDays(snapshot: JourneySnapshot): Set<DayKey> {
  const days = new Set<DayKey>(snapshot.missionDates)
  for (const day of snapshot.diaryDates) days.add(day)
  for (const habit of snapshot.habits) {
    for (const day of habit.completedDates) days.add(day)
  }
  return days
}

function computeBreakdown(snapshot: JourneySnapshot): XpBreakdown {
  const habitCompletions = snapshot.habits.reduce((sum, h) => sum + h.completedDates.length, 0)
  const goalsCompleted = snapshot.goals.filter((g) => GoalRules.isComplete(g)).length
  const booksRead = snapshot.books.filter((b) => b.status === 'read').length
  return {
    habits: habitCompletions * XP.habitCompletion,
    missions: snapshot.missionDates.length * XP.missionCompletion,
    diary: snapshot.diaryDates.length * XP.diaryEntry,
    goals: goalsCompleted * XP.goalCompleted,
    books: booksRead * XP.bookRead,
  }
}

/** Deriva toda a progressão da jornada a partir do retrato. */
export function computeJourney(snapshot: JourneySnapshot): JourneyProgress {
  const breakdown = computeBreakdown(snapshot)
  const totalXp =
    breakdown.habits + breakdown.missions + breakdown.diary + breakdown.goals + breakdown.books

  const level = levelForXp(totalXp)
  const isMaxLevel = level >= LEVEL_NAMES.length
  const currentThreshold = xpThresholdForLevel(level)
  const nextThreshold = xpThresholdForLevel(level + 1)

  const xpIntoLevel = totalXp - currentThreshold
  const xpForNextLevel = isMaxLevel ? 0 : nextThreshold - currentThreshold
  const progressPercent = isMaxLevel
    ? 100
    : Math.round((xpIntoLevel / xpForNextLevel) * 100)

  return {
    totalXp,
    breakdown,
    level,
    levelName: LEVEL_NAMES[level - 1] ?? LEVEL_NAMES[LEVEL_NAMES.length - 1]!,
    isMaxLevel,
    xpIntoLevel,
    xpForNextLevel,
    progressPercent,
    streak: streakEndingToday(activeDays(snapshot), snapshot.today),
  }
}
