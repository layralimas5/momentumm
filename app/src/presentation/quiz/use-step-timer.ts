import { useCallback, useEffect, useState } from 'react'

/**
 * O cronômetro do primeiro passo no quiz. Conta pra cima a partir de um
 * timestamp, não por tique, pelo mesmo motivo do cronômetro do app: aba em
 * segundo plano atrasa o `setInterval`, e o tempo mostrado não pode mentir.
 * Não sobrevive a recarregar a página: é um passo de minutos, não uma sessão.
 */
export interface StepTimer {
  readonly running: boolean
  readonly elapsedSeconds: number
  start(): void
  stop(): void
}

export function useStepTimer(): StepTimer {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (startedAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [startedAt])

  const start = useCallback(() => {
    const at = Date.now()
    setStartedAt(at)
    setNow(at)
  }, [])

  const stop = useCallback(() => setStartedAt(null), [])

  return {
    running: startedAt !== null,
    elapsedSeconds: startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000)),
    start,
    stop,
  }
}
