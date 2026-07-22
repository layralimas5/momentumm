import { useCallback, useEffect, useState } from 'react'
import type { Goal, NewGoal } from '@/domain/entities/goal'
import { goalUseCases } from '@/presentation/app/use-cases'
import { useAuth } from '@/presentation/auth/use-auth'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { toUserMessage } from '@/shared/errors'

interface UseGoalsResult {
  goals: Goal[]
  loading: boolean
  /** Falha do carregamento ou da última mutação — o que a tela deve mostrar. */
  error: string | null
  clearError: () => void
  /** As mutações nunca lançam: devolvem `true` em caso de sucesso. */
  create: (data: NewGoal) => Promise<boolean>
  setProgress: (id: string, progress: number) => Promise<boolean>
  complete: (id: string) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
}

/** Estado e ações das Metas para a UI. Delega toda a lógica aos casos de uso. */
export function useGoals(): UseGoalsResult {
  const { user } = useAuth()
  const userId = user?.id ?? 'demo'
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { error: actionError, clearError, run } = useAsyncAction()

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setGoals(await goalUseCases.list(userId))
    } catch (err) {
      setLoadError(toUserMessage(err))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(
    (data: NewGoal) =>
      run(async () => {
        await goalUseCases.create(userId, data)
        await refresh()
      }),
    [userId, refresh, run],
  )

  const setProgress = useCallback(
    (id: string, progress: number) =>
      run(async () => {
        await goalUseCases.setProgress(id, progress)
        await refresh()
      }),
    [refresh, run],
  )

  const complete = useCallback(
    (id: string) =>
      run(async () => {
        await goalUseCases.complete(id)
        await refresh()
      }),
    [refresh, run],
  )

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        await goalUseCases.remove(id)
        await refresh()
      }),
    [refresh, run],
  )

  return {
    goals,
    loading,
    error: loadError ?? actionError,
    clearError,
    create,
    setProgress,
    complete,
    remove,
  }
}
