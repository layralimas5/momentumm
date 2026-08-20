import { useCallback, useEffect, useState } from 'react'
import type { NewActivityInput } from '@/domain/entities/activity'
import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import {
  canFinish,
  elapsedMs,
  finishTimer,
  isRunning,
  needsValue,
  pauseTimer,
  resumeTimer,
  startTimer,
  type FinishTimerInput,
  type TimerSession,
} from '@/domain/entities/timer'
import {
  clearTimerSession,
  loadTimerSession,
  saveTimerSession,
} from '@/infrastructure/timer/timer-storage'

interface UseTimer {
  readonly session: TimerSession | null
  readonly running: boolean
  readonly elapsed: number
  readonly ready: boolean
  readonly needsValue: boolean
  start(type: ActivityTypeSlug): void
  pause(): void
  resume(): void
  discard(): void
  finish(input?: FinishTimerInput): Promise<void>
}

interface UseTimerOptions {
  onLog(input: Omit<NewActivityInput, 'userId'>): Promise<void>
}

/**
 * Cronômetro da tela. O tempo real vem sempre dos timestamps da sessão, nunca
 * de um contador incrementado a cada tique: aba em segundo plano tem o
 * `setInterval` estrangulado pelo navegador e o número sairia menor que a
 * sessão de verdade.
 */
export function useTimer({ onLog }: UseTimerOptions): UseTimer {
  const [session, setSession] = useState<TimerSession | null>(() => loadTimerSession())
  const [now, setNow] = useState(() => Date.now())

  const running = session !== null && isRunning(session)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [running])

  // Voltar pra aba precisa corrigir o mostrador na hora, sem esperar o tique.
  useEffect(() => {
    if (!running) return
    const sync = () => setNow(Date.now())
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [running])

  const commit = useCallback((next: TimerSession | null) => {
    setSession(next)
    setNow(Date.now())
    if (next) saveTimerSession(next)
    else clearTimerSession()
  }, [])

  const start = useCallback(
    (type: ActivityTypeSlug) => commit(startTimer(type, new Date())),
    [commit],
  )

  const pause = useCallback(
    () => setSession((current) => persist(current && pauseTimer(current, new Date()))),
    [],
  )

  const resume = useCallback(() => {
    setSession((current) => persist(current && resumeTimer(current, new Date())))
    setNow(Date.now())
  }, [])

  const discard = useCallback(() => commit(null), [commit])

  const finish = useCallback(
    async (input: FinishTimerInput = {}) => {
      if (!session) return
      // Só limpa depois que o registro foi aceito: falha de rede não pode
      // apagar uma sessão de leitura de uma hora.
      await onLog(finishTimer(session, new Date(), input))
      commit(null)
    },
    [session, onLog, commit],
  )

  return {
    session,
    running,
    elapsed: session ? elapsedMs(session, new Date(now)) : 0,
    ready: session !== null && canFinish(session, new Date(now)),
    needsValue: session !== null && needsValue(session),
    start,
    pause,
    resume,
    discard,
    finish,
  }
}

function persist(session: TimerSession | null): TimerSession | null {
  if (session) saveTimerSession(session)
  else clearTimerSession()
  return session
}
