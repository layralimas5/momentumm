import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyMission, MissionRules } from '@/domain/entities/mission'
import { dayKey, type DayKey } from '@/domain/entities/day'
import { missionUseCases } from '@/presentation/app/use-cases'
import { useAuth } from '@/presentation/auth/use-auth'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { toUserMessage } from '@/shared/errors'

interface UseMissionsResult {
  /** Texto da missão de hoje (determinístico). */
  mission: string
  /** Dias em que a missão foi concluída (YYYY-MM-DD). */
  completedDates: DayKey[]
  /** A missão de hoje já foi concluída? */
  doneToday: boolean
  /** Sequência de missões concluídas terminando hoje. */
  streak: number
  loading: boolean
  error: string | null
  clearError: () => void
  /** Alterna a missão de hoje. Nunca lança: devolve `true` em caso de sucesso. */
  toggleToday: () => Promise<boolean>
}

/** Estado e ação das Missões diárias para a UI. */
export function useMissions(): UseMissionsResult {
  const { user } = useAuth()
  const userId = user?.id ?? 'demo'
  const today = useMemo(() => dayKey(), [])
  const mission = useMemo(() => dailyMission(), [])
  const [completedDates, setCompletedDates] = useState<DayKey[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { error: actionError, clearError, run } = useAsyncAction()

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setCompletedDates(await missionUseCases.listCompletedDates(userId))
    } catch (err) {
      setLoadError(toUserMessage(err))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggleToday = useCallback(
    () =>
      run(async () => {
        await missionUseCases.setDone(userId, today, completedDates)
        await refresh()
      }),
    [userId, today, completedDates, refresh, run],
  )

  const doneToday = MissionRules.isDoneOn(completedDates, today)
  const streak = MissionRules.streak(completedDates, today)

  return {
    mission,
    completedDates,
    doneToday,
    streak,
    loading,
    error: loadError ?? actionError,
    clearError,
    toggleToday,
  }
}
