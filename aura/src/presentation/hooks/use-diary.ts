import { useCallback, useEffect, useState } from 'react'
import type { DiaryEntry } from '@/domain/entities/diary'
import { diaryUseCases } from '@/presentation/app/use-cases'
import { useAuth } from '@/presentation/auth/use-auth'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { toUserMessage } from '@/shared/errors'

interface UseDiaryResult {
  entries: DiaryEntry[]
  loading: boolean
  /** Falha do carregamento ou da última mutação — o que a tela deve mostrar. */
  error: string | null
  clearError: () => void
  /** As mutações nunca lançam: devolvem `true` em caso de sucesso. */
  create: (content: string) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
}

/** Estado e ações do Diário para a UI. */
export function useDiary(): UseDiaryResult {
  const { user } = useAuth()
  const userId = user?.id ?? 'demo'
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { error: actionError, clearError, run } = useAsyncAction()

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setEntries(await diaryUseCases.list(userId))
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
    (content: string) =>
      run(async () => {
        await diaryUseCases.create(userId, content)
        await refresh()
      }),
    [userId, refresh, run],
  )

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        await diaryUseCases.remove(id)
        await refresh()
      }),
    [refresh, run],
  )

  return { entries, loading, error: loadError ?? actionError, clearError, create, remove }
}
