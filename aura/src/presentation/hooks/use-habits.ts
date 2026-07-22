import { useCallback, useEffect, useMemo, useState } from 'react'
import { HabitRules, type Habit, type NewHabit } from '@/domain/entities/habit'
import { habitUseCases } from '@/presentation/app/use-cases'
import { useAuth } from '@/presentation/auth/use-auth'

interface UseHabitsResult {
  habits: Habit[]
  loading: boolean
  error: string | null
  /** Dia local de referência (YYYY-MM-DD). */
  today: string
  /** Quantos hábitos foram concluídos hoje. */
  doneToday: number
  /** Progresso da rotina de hoje (0–100). */
  progress: number
  toggle: (habit: Habit) => Promise<void>
  create: (data: NewHabit) => Promise<void>
  remove: (id: string) => Promise<void>
}

/** Estado e ações dos Hábitos para a UI. Delega a lógica aos casos de uso. */
export function useHabits(): UseHabitsResult {
  const { user } = useAuth()
  const userId = user?.id ?? 'demo'
  const today = useMemo(() => HabitRules.dayKey(), [])
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setHabits(await habitUseCases.list(userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar hábitos.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggle = useCallback(
    async (habit: Habit) => {
      await habitUseCases.toggle(habit, today)
      await refresh()
    },
    [today, refresh],
  )

  const create = useCallback(
    async (data: NewHabit) => {
      await habitUseCases.create(userId, data)
      await refresh()
    },
    [userId, refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await habitUseCases.remove(id)
      await refresh()
    },
    [refresh],
  )

  const doneToday = habits.filter((h) => HabitRules.isDoneOn(h, today)).length
  const progress = HabitRules.routineProgress(habits, today)

  return { habits, loading, error, today, doneToday, progress, toggle, create, remove }
}
