/**
 * Conquistas — marcos da jornada que a usuária desbloqueia ao viver o Aura.
 * Cada uma é uma regra pura sobre o retrato da jornada; o motor não guarda estado
 * de conquista, ele deriva na hora. Assim nunca há desbloqueio "fantasma".
 * Domínio puro: o ícone é semântico (a UI escolhe o glifo), não acoplado a lib.
 */

import type { JourneySnapshot, JourneyProgress } from './journey'
import { GoalRules } from './goal'

export type AchievementIcon =
  | 'start'
  | 'streak'
  | 'goal'
  | 'book'
  | 'diary'
  | 'mission'
  | 'level'

/** Tudo que uma regra de conquista precisa para se avaliar. */
export interface AchievementContext {
  snapshot: JourneySnapshot
  journey: JourneyProgress
}

interface AchievementDef {
  id: string
  title: string
  description: string
  icon: AchievementIcon
  /** Valor atual e alvo — permite mostrar "7 de 30" mesmo antes de desbloquear. */
  measure: (ctx: AchievementContext) => { current: number; target: number }
}

/** Conquista já resolvida contra o retrato atual da jornada. */
export interface Achievement {
  id: string
  title: string
  description: string
  icon: AchievementIcon
  unlocked: boolean
  current: number
  target: number
  /** Progresso 0–100 rumo ao desbloqueio. */
  progressPercent: number
}

const DEFINITIONS: AchievementDef[] = [
  {
    id: 'first-step',
    title: 'Primeiro passo',
    description: 'Você começou — criou seu primeiro hábito ou meta.',
    icon: 'start',
    measure: ({ snapshot }) => ({
      current: Math.min(1, snapshot.habits.length + snapshot.goals.length),
      target: 1,
    }),
  },
  {
    id: 'week-streak',
    title: 'Semana de fogo',
    description: '7 dias seguidos em movimento.',
    icon: 'streak',
    measure: ({ journey }) => ({ current: journey.streak, target: 7 }),
  },
  {
    id: 'month-streak',
    title: 'Um mês inteiro',
    description: '30 dias de constância. Isso é identidade, não sorte.',
    icon: 'streak',
    measure: ({ journey }) => ({ current: journey.streak, target: 30 }),
  },
  {
    id: 'first-goal',
    title: 'Realizadora',
    description: 'Concluiu a primeira meta.',
    icon: 'goal',
    measure: ({ snapshot }) => ({
      current: snapshot.goals.filter((g) => GoalRules.isComplete(g)).length,
      target: 1,
    }),
  },
  {
    id: 'five-goals',
    title: 'Colecionadora de vitórias',
    description: '5 metas concluídas.',
    icon: 'goal',
    measure: ({ snapshot }) => ({
      current: snapshot.goals.filter((g) => GoalRules.isComplete(g)).length,
      target: 5,
    }),
  },
  {
    id: 'first-book',
    title: 'Leitora',
    description: 'Terminou o primeiro livro.',
    icon: 'book',
    measure: ({ snapshot }) => ({
      current: snapshot.books.filter((b) => b.status === 'read').length,
      target: 1,
    }),
  },
  {
    id: 'five-books',
    title: 'Rato de biblioteca',
    description: '5 livros lidos até o fim.',
    icon: 'book',
    measure: ({ snapshot }) => ({
      current: snapshot.books.filter((b) => b.status === 'read').length,
      target: 5,
    }),
  },
  {
    id: 'diarist',
    title: 'Diarista',
    description: '10 registros no diário.',
    icon: 'diary',
    measure: ({ snapshot }) => ({ current: snapshot.diaryDates.length, target: 10 }),
  },
  {
    id: 'mission-veteran',
    title: 'Missão cumprida',
    description: '10 missões diárias concluídas.',
    icon: 'mission',
    measure: ({ snapshot }) => ({ current: snapshot.missionDates.length, target: 10 }),
  },
  {
    id: 'flourishing',
    title: 'Florescendo',
    description: 'Chegou ao nível Florescendo. A mulher que você decidiu ser está aqui.',
    icon: 'level',
    measure: ({ journey }) => ({ current: journey.level, target: 5 }),
  },
]

function resolve(def: AchievementDef, ctx: AchievementContext): Achievement {
  const { current, target } = def.measure(ctx)
  const capped = Math.min(current, target)
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    icon: def.icon,
    unlocked: current >= target,
    current: capped,
    target,
    progressPercent: target === 0 ? 100 : Math.round((capped / target) * 100),
  }
}

/** Resolve todas as conquistas: desbloqueadas primeiro, depois as mais próximas. */
export function computeAchievements(ctx: AchievementContext): Achievement[] {
  return DEFINITIONS.map((def) => resolve(def, ctx)).sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
    return b.progressPercent - a.progressPercent
  })
}

/** Quantas conquistas já foram desbloqueadas. */
export function countUnlocked(achievements: Achievement[]): number {
  return achievements.filter((a) => a.unlocked).length
}
