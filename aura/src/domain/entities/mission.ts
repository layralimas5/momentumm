/**
 * Missão diária — um desafio curto e acionável, escolhido de forma determinística
 * por dia (todo mundo vê a mesma missão no mesmo dia). O conteúdo é sem estado; a
 * conclusão é persistida por dia (uma data marcada) e alimenta XP e sequência.
 * Camada de domínio: pura, sem dependência de framework, banco ou UI.
 */

import { dayKey, type DayKey, streakEndingToday } from './day'

const MISSIONS = [
  'Beba 2L de água ao longo do dia.',
  'Escreva 3 coisas pelas quais você é grata.',
  'Faça 15 minutos de movimento — do seu jeito.',
  'Passe 10 minutos sem o celular, só respirando.',
  'Mande uma mensagem carinhosa pra alguém que importa.',
  'Organize um cantinho da casa que te incomoda.',
  'Leia uma página do livro que você começou.',
] as const

/** Índice do dia no ano (1–366) — base determinística da escolha. */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000)
}

export function dailyMission(date: Date = new Date()): string {
  return MISSIONS[dayOfYear(date) % MISSIONS.length] ?? MISSIONS[0]
}

export const MissionRules = {
  /** A missão do dia informado já foi concluída? */
  isDoneOn(completedDates: readonly DayKey[], day: DayKey): boolean {
    return completedDates.includes(day)
  },

  /** Sequência de missões concluídas em dias consecutivos terminando hoje. */
  streak(completedDates: readonly DayKey[], today: DayKey = dayKey()): number {
    return streakEndingToday(completedDates, today)
  },
} as const
