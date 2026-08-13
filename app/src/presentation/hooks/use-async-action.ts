import { useCallback, useRef, useState } from 'react'
import { toUserMessage } from '@/shared/errors'

interface AsyncAction<TArgs extends unknown[]> {
  readonly running: boolean
  readonly error: string | null
  clearError(): void
  run(...args: TArgs): Promise<boolean>
}

/** Encapsula loading e erro de ação assíncrona, sem engolir a exceção em silêncio. */
export function useAsyncAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<void>,
): AsyncAction<TArgs> {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const run = useCallback(
    async (...args: TArgs) => {
      setRunning(true)
      setError(null)
      try {
        await action(...args)
        return true
      } catch (cause) {
        if (mounted.current) setError(toUserMessage(cause))
        return false
      } finally {
        if (mounted.current) setRunning(false)
      }
    },
    [action],
  )

  const clearError = useCallback(() => setError(null), [])

  return { running, error, clearError, run }
}
