import { useCallback, useEffect, useRef, useState } from 'react'
import { toUserMessage } from '@/shared/errors'

interface AdminQuery<T> {
  readonly data: T | null
  readonly loading: boolean
  readonly error: string | null
  reload(): Promise<void>
}

/**
 * Uma leitura do painel: carrega, mostra erro legível, recarrega quando a
 * chave muda. Sem cache entre telas de propósito — número administrativo
 * velho é pior que esperar meio segundo.
 */
export function useAdminQuery<T>(load: () => Promise<T>, key: string): AdminQuery<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(0)
  const loader = useRef(load)
  loader.current = load

  const reload = useCallback(async () => {
    const ticket = ++latest.current
    setLoading(true)
    setError(null)
    try {
      const next = await loader.current()
      if (ticket === latest.current) setData(next)
    } catch (cause) {
      if (ticket === latest.current) setError(toUserMessage(cause))
    } finally {
      if (ticket === latest.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    // `key` é a dependência real: a função muda a cada render, a chave não.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reload])

  return { data, loading, error, reload }
}
