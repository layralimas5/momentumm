import { useEffect, useMemo, useState } from 'react'
import { isDone, type Task } from '@/domain/entities/task'
import { trackFunnelIfLinked } from '@/infrastructure/analytics/funnel'
import { useAuth } from '@/presentation/auth/use-auth'
import { usePlanner } from '@/presentation/planner/use-planner'
import { clearFirstWin, loadFirstWin } from './quiz-storage'

/**
 * A primeira vitória de quem chegou pelo quiz.
 *
 * O plano foi ativado com uma ação pra hoje; enquanto ela está aberta, o
 * Hoje a destaca. Quando ela fecha, o funil recebe `first_action_completed`
 * uma vez e o destaque some. XP, Momentum Score e a conquista "Primeiro
 * Passo" já acontecem pelo caminho normal de concluir ação: nada aqui
 * duplica progresso.
 *
 * O destaque também some sozinho se a ação sumir (apagada, reagendada) ou
 * se o dia virar: a primeira vitória é a de hoje, não uma dívida.
 */
export interface FirstWinState {
  /** A ação em destaque, enquanto está aberta. */
  readonly task: Task | null
  /** Acabou de concluir: a tela mostra a comemoração uma vez. */
  readonly justCompleted: boolean
  dismiss(): void
}

export function useFirstWin(): FirstWinState {
  const { user } = useAuth()
  const planner = usePlanner()
  const userId = user?.id ?? null

  const [win, setWin] = useState(() => (userId ? loadFirstWin(userId) : null))
  const [justCompleted, setJustCompleted] = useState(false)

  useEffect(() => {
    setWin(userId ? loadFirstWin(userId) : null)
  }, [userId])

  const task = useMemo<Task | null>(() => {
    if (!win || planner.loading) return null
    return (
      planner.tasks.find((item) => item.day === win.day && item.title === win.taskTitle) ?? null
    )
  }, [win, planner.loading, planner.tasks])

  useEffect(() => {
    if (!win || !userId || planner.loading) return

    const stale = win.day !== planner.today || task === null
    if (stale) {
      clearFirstWin(userId)
      setWin(null)
      return
    }

    if (isDone(task)) {
      trackFunnelIfLinked('first_action_completed')
      clearFirstWin(userId)
      setWin(null)
      setJustCompleted(true)
    }
  }, [win, userId, planner.loading, planner.today, task])

  return {
    task: task && !isDone(task) ? task : null,
    justCompleted,
    dismiss: () => setJustCompleted(false),
  }
}
