import { createContext } from 'react'
import type {
  AchievementKey,
  EvolutionSnapshot,
  EvolutionSummary,
  LevelProgress,
  UnlockView,
} from '@/domain/entities/evolution'

/** O que apareceu desde a última leitura: é o que vira aviso na tela. */
export interface EvolutionNotice {
  readonly id: string
  readonly levelUp: LevelProgress | null
  /** Desbloqueios que o nível novo liberou. */
  readonly unlocks: readonly UnlockView[]
  readonly achievements: readonly AchievementKey[]
}

/** O XP que o servidor acabou de conceder. Medido, nunca estimado. */
export interface XpGain {
  readonly id: string
  readonly amount: number
}

export interface EvolutionState {
  readonly snapshot: EvolutionSnapshot
  readonly summary: EvolutionSummary
  readonly loading: boolean
  readonly error: string | null
  readonly notice: EvolutionNotice | null
  /**
   * A última variação positiva do XP total, pra tela de conclusão poder dizer
   * quanto entrou. Vem da diferença entre duas leituras do servidor: se o
   * banco não concedeu, nada aparece.
   */
  readonly lastGain: XpGain | null
  dismissNotice(): void
  refresh(): Promise<void>
}

export const EvolutionContext = createContext<EvolutionState | null>(null)
