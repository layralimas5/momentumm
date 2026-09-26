import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { activityType } from '@/domain/entities/activity-type'
import {
  canFinish as canFinishSession,
  elapsedMs,
  finishTimer,
  isRunning,
  needsValue as sessionNeedsValue,
  pauseTimer,
  plannedProgress,
  resumeTimer,
  startTimer,
  type TimerSession,
} from '@/domain/entities/timer'
import {
  clearTimerSession,
  loadTimerSession,
  saveTimerSession,
} from '@/infrastructure/timer/timer-storage'
import { usePlanner } from '@/presentation/planner/use-planner'
import { toUserMessage } from '@/shared/errors'
import { FocusContext, type FocusState, type StartFocusInput } from './focus-context'

/**
 * A sessão de foco do app inteiro. Só existe uma: o "Começar agora" da
 * prioridade e o card de foco são duas portas pro mesmo cronômetro, e ele
 * sobrevive a recarregar a página.
 *
 * O tempo vem sempre dos timestamps da sessão, nunca de um contador por tique:
 * aba em segundo plano tem o `setInterval` estrangulado pelo navegador e a
 * sessão sairia menor que a real.
 */
export function FocusProvider({ children }: { children: ReactNode }) {
  const { logActivity, updateTask, today } = usePlanner()
  const [session, setSession] = useState<TimerSession | null>(() => loadTimerSession())
  const [now, setNow] = useState(() => Date.now())
  const [immersive, setImmersive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
    (input: StartFocusInput) => {
      setError(null)
      commit(
        startTimer(input.axis, new Date(), {
          label: input.label,
          taskId: input.taskId ?? null,
          plannedMin: input.plannedMin,
        }),
      )
    },
    [commit],
  )

  const pause = useCallback(() => {
    setSession((current) => {
      if (!current) return current
      const next = pauseTimer(current, new Date())
      saveTimerSession(next)
      return next
    })
  }, [])

  const resume = useCallback(() => {
    setSession((current) => {
      if (!current) return current
      const next = resumeTimer(current, new Date())
      saveTimerSession(next)
      return next
    })
    setNow(Date.now())
  }, [])

  const discard = useCallback(() => {
    setError(null)
    setImmersive(false)
    commit(null)
  }, [commit])

  /*
    Concluir e encerrar gravam a MESMA sessão; o que muda é o destino da ação de
    origem. Quem para no meio do caminho continua tendo o tempo registrado — o
    contrário ensina a pessoa que sair da sessão custa o trabalho já feito.
  */
  const save = useCallback(
    async ({ value, completeTask }: { value?: number | undefined; completeTask: boolean }) => {
      if (!session) return
      setSaving(true)
      setError(null)
      try {
        // Só limpa depois que o registro foi aceito: falha de rede não pode
        // apagar uma sessão de uma hora.
        await logActivity(finishTimer(session, new Date(), value === undefined ? {} : { value }))
        if (completeTask && session.taskId) {
          await updateTask(session.taskId, {
            status: 'feita',
            completedAt: new Date(),
            day: today,
          })
        }
        setImmersive(false)
        commit(null)
      } catch (cause) {
        setError(toUserMessage(cause))
      } finally {
        setSaving(false)
      }
    },
    [session, logActivity, updateTask, today, commit],
  )

  const finish = useCallback(
    (value?: number) => save({ value, completeTask: true }),
    [save],
  )

  const stop = useCallback(
    (value?: number) => save({ value, completeTask: false }),
    [save],
  )

  const value = useMemo<FocusState>(() => {
    const reference = new Date(now)
    return {
      session,
      running,
      elapsed: session ? elapsedMs(session, reference) : 0,
      plannedRatio: session ? plannedProgress(session, reference) : 0,
      canFinish: session !== null && canFinishSession(session, reference),
      needsValue: session !== null && sessionNeedsValue(session),
      immersive: immersive && session !== null,
      error,
      saving,
      start,
      pause,
      resume,
      finish,
      stop,
      discard,
      setImmersive,
    }
  }, [session, running, now, immersive, error, saving, start, pause, resume, finish, stop, discard])

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
}

/** Rótulo do eixo da sessão, pra tela não precisar conhecer o domínio. */
export function axisLabelOf(session: TimerSession): string {
  return activityType(session.type).label
}
