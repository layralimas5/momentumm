import { useCallback, useEffect, useState } from 'react'
import type { DiaryEntry } from '@/domain/entities/diary'
import { diaryUseCases } from '@/presentation/app/use-cases'
import { useAuth } from '@/presentation/auth/use-auth'

interface UseDiaryResult {
  entries: DiaryEntry[]
  loading: boolean
  error: string | null
  create: (content: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

/** Estado e ações do Diário para a UI. */
export function useDiary(): UseDiaryResult {
  const { user } = useAuth()
  const userId = user?.id ?? 'demo'
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEntries(await diaryUseCases.list(userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar o diário.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(
    async (content: string) => {
      await diaryUseCases.create(userId, content)
      await refresh()
    },
    [userId, refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await diaryUseCases.remove(id)
      await refresh()
    },
    [refresh],
  )

  return { entries, loading, error, create, remove }
}
