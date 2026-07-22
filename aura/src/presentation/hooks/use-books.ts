import { useCallback, useEffect, useState } from 'react'
import type { Book, NewBook, ReadingStatus } from '@/domain/entities/book'
import { bookUseCases } from '@/presentation/app/use-cases'
import { useAuth } from '@/presentation/auth/use-auth'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { toUserMessage } from '@/shared/errors'

interface UseBooksResult {
  books: Book[]
  loading: boolean
  /** Falha do carregamento ou da última mutação — o que a tela deve mostrar. */
  error: string | null
  clearError: () => void
  /** As mutações nunca lançam: devolvem `true` em caso de sucesso. */
  create: (data: NewBook) => Promise<boolean>
  setStatus: (id: string, status: ReadingStatus) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
}

/** Estado e ações das Leituras para a UI. */
export function useBooks(): UseBooksResult {
  const { user } = useAuth()
  const userId = user?.id ?? 'demo'
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { error: actionError, clearError, run } = useAsyncAction()

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setBooks(await bookUseCases.list(userId))
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
    (data: NewBook) =>
      run(async () => {
        await bookUseCases.create(userId, data)
        await refresh()
      }),
    [userId, refresh, run],
  )

  const setStatus = useCallback(
    (id: string, status: ReadingStatus) =>
      run(async () => {
        await bookUseCases.setStatus(id, status)
        await refresh()
      }),
    [refresh, run],
  )

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        await bookUseCases.remove(id)
        await refresh()
      }),
    [refresh, run],
  )

  return { books, loading, error: loadError ?? actionError, clearError, create, setStatus, remove }
}
