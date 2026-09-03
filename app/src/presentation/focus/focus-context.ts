import { createContext } from 'react'
import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { TimerSession } from '@/domain/entities/timer'

export interface StartFocusInput {
  readonly axis: ActivityTypeSlug
  readonly label: string
  readonly plannedMin: number
  /** Ação de origem. Concluir o foco conclui a ação junto. */
  readonly taskId?: string | null
}

export interface FocusState {
  readonly session: TimerSession | null
  readonly running: boolean
  readonly elapsed: number
  /** Progresso da duração escolhida, de 0 a 1. */
  readonly plannedRatio: number
  readonly canFinish: boolean
  readonly needsValue: boolean
  /** Modo sem distrações: a sessão ocupa a tela inteira. */
  readonly immersive: boolean
  readonly error: string | null
  readonly saving: boolean

  start(input: StartFocusInput): void
  pause(): void
  resume(): void
  finish(value?: number): Promise<void>
  discard(): void
  setImmersive(immersive: boolean): void
}

export const FocusContext = createContext<FocusState | null>(null)
