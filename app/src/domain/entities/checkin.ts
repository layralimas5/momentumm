import { DomainError } from '@/shared/errors'
import type { DayKey } from './day'

/**
 * Check-in do momento. É a primeira pergunta do dashboard e a que muda todo o
 * resto: o Momentumm não trata todos os dias como iguais. Dia de pouca energia
 * não recebe o mesmo plano de um dia em alta — recebe a versão mínima dele.
 */

export const MOOD_STATES = ['sem-energia', 'automatico', 'estavel', 'motivado', 'em-alta'] as const
export type MoodState = (typeof MOOD_STATES)[number]

export const FOCUS_CAPACITIES = ['disperso', 'oscilando', 'afiado'] as const
export type FocusCapacity = (typeof FOCUS_CAPACITIES)[number]

export type EnergyLevel = 1 | 2 | 3 | 4 | 5

export const ENERGY_LEVELS: readonly EnergyLevel[] = [1, 2, 3, 4, 5]

export const MAX_CHECKIN_NOTE = 140

export interface CheckIn {
  readonly id: string
  readonly userId: string
  readonly day: DayKey
  readonly mood: MoodState
  readonly energy: EnergyLevel
  readonly focus: FocusCapacity
  readonly note: string | null
  readonly createdAt: Date
}

export interface MoodOption {
  readonly slug: MoodState
  readonly label: string
  /** Frase curta que confirma a escolha sem julgar. */
  readonly echo: string
  /** Peso do estado no cálculo de capacidade do dia (0 a 4). */
  readonly weight: number
}

export const MOOD_OPTIONS: readonly MoodOption[] = [
  { slug: 'sem-energia', label: 'Sem energia', echo: 'Hoje o suficiente é aparecer.', weight: 0 },
  { slug: 'automatico', label: 'No automático', echo: 'Dá pra andar sem pensar demais.', weight: 1 },
  { slug: 'estavel', label: 'Estável', echo: 'Ritmo normal, sem forçar.', weight: 2 },
  { slug: 'motivado', label: 'Motivado', echo: 'Bom dia pra avançar no que trava.', weight: 3 },
  { slug: 'em-alta', label: 'Em alta', echo: 'Aproveita: dia assim rende dobrado.', weight: 4 },
]

export const FOCUS_LABELS: Readonly<Record<FocusCapacity, string>> = {
  disperso: 'Disperso',
  oscilando: 'Oscilando',
  afiado: 'Afiado',
}

const FOCUS_WEIGHT: Readonly<Record<FocusCapacity, number>> = {
  disperso: 0,
  oscilando: 1,
  afiado: 2,
}

export function moodOption(mood: MoodState): MoodOption {
  const found = MOOD_OPTIONS.find((option) => option.slug === mood)
  if (!found) throw new DomainError(`Estado desconhecido: ${mood}`)
  return found
}

/**
 * Capacidade do dia. É o número que o dashboard consulta pra decidir se sugere
 * o plano cheio ou a versão mínima dele.
 */
export type DayCapacity = 'minima' | 'moderada' | 'plena'

export interface CapacityProfile {
  readonly capacity: DayCapacity
  readonly label: string
  /** Quantas ações vale a pena manter no dia. */
  readonly suggestedActions: number
  /** Duração de foco que combina com o dia. */
  readonly suggestedFocusMin: number
  /** Se o dashboard deve destacar a versão mínima em vez da ação cheia. */
  readonly preferMinimal: boolean
  readonly guidance: string
}

export const CAPACITY_PROFILES: Readonly<Record<DayCapacity, CapacityProfile>> = {
  minima: {
    capacity: 'minima',
    label: 'Dia de baixa energia',
    suggestedActions: 1,
    suggestedFocusMin: 15,
    preferMinimal: true,
    guidance: 'Hoje o plano é a versão mínima. Manter a sequência já é vitória.',
  },
  moderada: {
    capacity: 'moderada',
    label: 'Dia de ritmo médio',
    suggestedActions: 3,
    suggestedFocusMin: 25,
    preferMinimal: false,
    guidance: 'Escolhe a prioridade principal e deixa o resto como bônus.',
  },
  plena: {
    capacity: 'plena',
    label: 'Dia de capacidade cheia',
    suggestedActions: 5,
    suggestedFocusMin: 45,
    preferMinimal: false,
    guidance: 'Dia bom pra atacar o que costuma ficar pra depois.',
  },
}

/**
 * Sem check-in o dia é tratado como moderado: nunca presumir que a pessoa está
 * mal, e nunca cobrar como se estivesse ótima.
 */
export function capacityOf(checkIn: CheckIn | null): CapacityProfile {
  if (!checkIn) return CAPACITY_PROFILES.moderada

  const score = moodOption(checkIn.mood).weight + (checkIn.energy - 1) + FOCUS_WEIGHT[checkIn.focus]

  if (score <= 3) return CAPACITY_PROFILES.minima
  if (score <= 7) return CAPACITY_PROFILES.moderada
  return CAPACITY_PROFILES.plena
}

export interface NewCheckInInput {
  readonly userId: string
  readonly day: DayKey
  readonly mood: MoodState
  readonly energy: EnergyLevel
  readonly focus: FocusCapacity
  readonly note?: string | null
}

export function createCheckIn(input: NewCheckInInput, id: string, now = new Date()): CheckIn {
  if (!MOOD_STATES.includes(input.mood)) {
    throw new DomainError('Escolhe como você está chegando hoje.')
  }
  if (!ENERGY_LEVELS.includes(input.energy)) {
    throw new DomainError('O nível de energia vai de 1 a 5.')
  }

  const note = input.note?.trim() ?? ''
  if (note.length > MAX_CHECKIN_NOTE) {
    throw new DomainError(`A observação pode ter no máximo ${MAX_CHECKIN_NOTE} caracteres.`)
  }

  return {
    id,
    userId: input.userId,
    day: input.day,
    mood: input.mood,
    energy: input.energy,
    focus: input.focus,
    note: note || null,
    createdAt: now,
  }
}

export function checkInOfDay(checkIns: readonly CheckIn[], day: DayKey): CheckIn | null {
  return checkIns.find((item) => item.day === day) ?? null
}

/** Média de energia do período, usada pelos insights. Null quando não há dado. */
export function averageEnergy(checkIns: readonly CheckIn[]): number | null {
  if (checkIns.length === 0) return null
  const total = checkIns.reduce((sum, item) => sum + item.energy, 0)
  return Number((total / checkIns.length).toFixed(1))
}

export interface MoodDefaults {
  readonly energy: EnergyLevel
  readonly focus: FocusCapacity
  /**
   * Se vale perguntar a energia depois de escolher o estado.
   *
   * No celular o check-in precisa caber em um toque. Perguntar energia num dia
   * bom não muda nada do que o app vai sugerir; num dia ruim muda tudo, porque
   * é o que separa "versão mínima" de "plano cheio". Então só perguntamos onde
   * a resposta tem consequência.
   */
  readonly asksEnergy: boolean
}

const MOOD_DEFAULTS: Readonly<Record<MoodState, MoodDefaults>> = {
  'sem-energia': { energy: 1, focus: 'disperso', asksEnergy: true },
  automatico: { energy: 2, focus: 'oscilando', asksEnergy: true },
  estavel: { energy: 3, focus: 'oscilando', asksEnergy: false },
  motivado: { energy: 4, focus: 'afiado', asksEnergy: false },
  'em-alta': { energy: 5, focus: 'afiado', asksEnergy: false },
}

export function defaultsForMood(mood: MoodState): MoodDefaults {
  return MOOD_DEFAULTS[mood]
}
