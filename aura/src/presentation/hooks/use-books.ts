import { useCallback, useEffect, useState } from 'react'
import type { Book, NewBook, ReadingStatus } from '@/domain/entities/book'
import { bookUseCases } from '@/presentation/app/use-cases'
import { useAuth } from '@/presentation/auth/use-auth'

interface UseBooksResult {
  books: Book[]
  loading: boolean
  error: string | null
  create: (data: NewBook) => Promise<void>
  setStatus: (id: string, status: ReadingStatus) => Promise<void>
  remove: (id: string) => Promise<void>
}

/** Estado e ações das Leituras para a UI. */
export function useBooks(): UseBooksResult {
  const { user } = useAuth()
  const userId = user?.id ?? 'demo'
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBooks(await bookUseCases.list(userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar leituras.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(
    async (data: NewBook) => {
      await bookUseCases.create(userId, data)
      await refresh()
    },
    [userId, refresh],
  )

  const setStatus = useCallback(
    async (id: string, status: ReadingStatus) => {
      await bookUseCases.setStatus(id, status)
      await refresh()
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await bookUseCases.remove(id)
      await refresh()
    },
    [refresh],
  )

  return { books, loading, error, create, setStatus, remove }
}
