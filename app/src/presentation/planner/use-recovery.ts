import { useCallback, useMemo, useState } from 'react'
import type { AdaptiveObjective } from '@/domain/entities/adaptive-day'
import type { DayKey } from '@/domain/entities/day'
import {
  detectRecovery,
  recoveryBudgetOf,
  type RecoveryState,
  type RecoveryStep,
} from '@/domain/entities/recovery'
import type { DashboardView } from './use-dashboard'
import { usePlanner } from './use-planner'

const DISMISSED_KEY = 'momentumm.recovery.dismissed.v1'

/**
 * O Modo Retomada na tela.
 *
 * A detecção inteira é do domínio. O que mora aqui é a única coisa que o
 * domínio não pode saber: se a pessoa já respondeu esse recado hoje. Ela
 * escolheu um passo, ou fechou o card — nos dois casos o assunto está
 * resolvido até amanhã, e insistir transformaria acolhimento em cobrança.
 *
 * Como o insight dispensado, isso fica no dispositivo: é preferência de
 * leitura, não dado de negócio, e não vale uma escrita de rede.
 */

export interface RecoveryController {
  readonly state: RecoveryState | null
  /** O tamanho do dia depois de escolher esse passo, em minutos. */
  budgetFor(step: RecoveryStep): number
  /** Encerra o recado por hoje. */
  dismiss(): void
}

export function useRecovery(view: DashboardView): RecoveryController {
  const planner = usePlanner()
  const [dismissedDay, setDismissedDay] = useState<string | null>(loadDismissed)

  const objectives = useMemo<AdaptiveObjective[]>(
    () => view.objectives.map((item) => ({ progress: item.progress, plan: item.plan })),
    [view.objectives],
  )

  const state = useMemo<RecoveryState | null>(() => {
    if (dismissedDay === planner.today) return null

    return detectRecovery({
      today: planner.today,
      series: view.week.series,
      tasks: planner.tasks,
      habits: planner.habits,
      habitLogs: planner.habitLogs,
      momentum: view.momentum,
      objectives,
      capacity: view.capacity,
    })
  }, [
    dismissedDay,
    planner.today,
    planner.tasks,
    planner.habits,
    planner.habitLogs,
    view.week.series,
    view.momentum,
    view.capacity,
    objectives,
  ])

  const budgetFor = useCallback(
    (step: RecoveryStep) => recoveryBudgetOf(step, view.capacity),
    [view.capacity],
  )

  const dismiss = useCallback(() => {
    setDismissedDay(planner.today)
    persistDismissed(planner.today)
  }, [planner.today])

  return { state, budgetFor, dismiss }
}

function loadDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

function persistDismissed(day: DayKey): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, day)
  } catch {
    // Sem armazenamento o card volta na próxima sessão. É o pior caso, e ele
    // é aceitável: nenhuma decisão da pessoa se perde por isso.
  }
}
