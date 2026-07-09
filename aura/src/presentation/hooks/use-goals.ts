import { useCallback, useEffect, useState } from 'react'
import type { Goal, NewGoal } from '@/domain/entities/goal'
import { goalUseCases } from '@/presentation/app/use-cases'
import { useAuth } from '@/presentation/auth/use-auth'

interface UseGoalsResult {
  goals: Goal[]
  loading: boolean
  error: string | null
  create: (data: NewGoal) => Promise<void>
  setProgress: (id: string, progress: number) => Promise<void>
  complete: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

/** Estado e ações das Metas para a UI. Delega toda a lógica aos casos de uso. */
export function useGoals(): UseGoalsResult {
  const { user } = useAuth()
  const userId = user?.id ?? 'demo'
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setGoals(await goalUseCases.list(userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar metas.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(
    async (data: NewGoal) => {
      await goalUseCases.create(userId, data)
      await refresh()
    },
    [userId, refresh],
  )

  const setProgress = useCallback(
    async (id: string, progress: number) => {
      await goalUseCases.setProgress(id, progress)
      await refresh()
    },
    [refresh],
  )

  const complete = useCallback(
    async (id: string) => {
      await goalUseCases.complete(id)
      await refresh()
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await goalUseCases.remove(id)
      await refresh()
    },
    [refresh],
  )

  return { goals, loading, error, create, setProgress, complete, remove }
}
