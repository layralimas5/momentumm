import { useCallback, useEffect, useMemo, useState } from 'react'
import { HabitRules, type Habit, type NewHabit } from '@/domain/entities/habit'
import { habitUseCases } from '@/presentation/app/use-cases'
import { useAuth } from '@/presentation/auth/use-auth'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { toUserMessage } from '@/shared/errors'

interface UseHabitsResult {
  habits: Habit[]
  loading: boolean
  /** Falha do carregamento ou da última mutação — o que a tela deve mostrar. */
  error: string | null
  clearError: () => void
  /** Dia local de referência (YYYY-MM-DD). */
  today: string
  /** Quantos hábitos foram concluídos hoje. */
  doneToday: number
  /** Progresso da rotina de hoje (0–100). */
  progress: number
  /** As mutações nunca lançam: devolvem `true` em caso de sucesso. */
  toggle: (habit: Habit) => Promise<boolean>
  create: (data: NewHabit) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
}

/** Estado e ações dos Hábitos para a UI. Delega a lógica aos casos de uso. */
export function useHabits(): UseHabitsResult {
  const { user } = useAuth()
  const userId = user?.id ?? 'demo'
  const today = useMemo(() => HabitRules.dayKey(), [])
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { error: actionError, clearError, run } = useAsyncAction()

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setHabits(await habitUseCases.list(userId))
    } catch (err) {
      setLoadError(toUserMessage(err))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggle = useCallback(
    (habit: Habit) =>
      run(async () => {
        await habitUseCases.toggle(habit, today)
        await refresh()
      }),
    [today, refresh, run],
  )

  const create = useCallback(
    (data: NewHabit) =>
      run(async () => {
        await habitUseCases.create(userId, data)
        await refresh()
      }),
    [userId, refresh, run],
  )

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        await habitUseCases.remove(id)
        await refresh()
      }),
    [refresh, run],
  )

  const doneToday = habits.filter((h) => HabitRules.isDoneOn(h, today)).length
  const progress = HabitRules.routineProgress(habits, today)

  return {
    habits,
    loading,
    error: loadError ?? actionError,
    clearError,
    today,
    doneToday,
    progress,
    toggle,
    create,
    remove,
  }
}
