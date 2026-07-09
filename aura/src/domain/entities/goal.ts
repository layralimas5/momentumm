/**
 * Meta — o coração da jornada. Uma intenção concreta que a usuária decidiu
 * perseguir, com progresso acompanhável ao longo do tempo.
 * Camada de domínio: sem dependência de framework, banco ou UI.
 */

export type GoalStatus = 'active' | 'completed' | 'archived'

export interface Goal {
  readonly id: string
  readonly userId: string
  title: string
  description: string | null
  /** Progresso de 0 a 100. */
  progress: number
  status: GoalStatus
  /** Data-alvo (ISO 8601) ou null se sem prazo. */
  dueDate: string | null
  readonly createdAt: string
}

/** Dados necessários pra criar uma meta (o resto o domínio deriva). */
export interface NewGoal {
  title: string
  description?: string | null
  dueDate?: string | null
}

/** Regras de domínio da Meta. */
export const GoalRules = {
  minTitleLength: 2,
  maxTitleLength: 120,

  isValidTitle(title: string): boolean {
    const t = title.trim()
    return t.length >= this.minTitleLength && t.length <= this.maxTitleLength
  },

  clampProgress(value: number): number {
    if (Number.isNaN(value)) return 0
    return Math.min(100, Math.max(0, Math.round(value)))
  },

  isComplete(goal: Pick<Goal, 'progress' | 'status'>): boolean {
    return goal.status === 'completed' || goal.progress >= 100
  },
} as const
