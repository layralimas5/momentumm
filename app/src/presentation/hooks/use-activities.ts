import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Activity, NewActivityInput } from '@/domain/entities/activity'
import { sortByRecent } from '@/domain/entities/activity'
import { dayKeyOf, type DayKey } from '@/domain/entities/day'
import { calculateStreak, type Streak } from '@/domain/entities/streak'
import { container } from '@/infrastructure/container'
import { toUserMessage } from '@/shared/errors'
import { useAuth } from '@/presentation/auth/use-auth'

interface UseActivities {
  readonly activities: Activity[]
  readonly today: DayKey
  readonly todayActivities: Activity[]
  readonly streak: Streak
  readonly loading: boolean
  readonly error: string | null
  log(input: Omit<NewActivityInput, 'userId'>): Promise<void>
  remove(id: string): Promise<void>
  reload(): Promise<void>
}

export function useActivities(): UseActivities {
  const { user, profile } = useAuth()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Recalculado a cada render em vez de guardado em estado: se o app ficar
  // aberto virando o dia, a data de referência acompanha.
  const today = dayKeyOf(new Date())

  const reload = useCallback(async () => {
    if (!user) {
      setActivities([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const list = await container.activities.listByUser(user.id)
      setActivities(sortByRecent(list))
      setError(null)
    } catch (cause) {
      setError(toUserMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  const log = useCallback(
    async (input: Omit<NewActivityInput, 'userId'>) => {
      if (!user) return
      const created = await container.activities.create({
        userId: user.id,
        visibility: profile?.defaultVisibility ?? 'publica',
        ...input,
      })
      setActivities((current) => sortByRecent([created, ...current]))
      setError(null)
    },
    [user, profile],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!user) return
      const previous = activities
      setActivities((current) => current.filter((activity) => activity.id !== id))
      try {
        await container.activities.remove(id, user.id)
      } catch (cause) {
        setActivities(previous)
        setError(toUserMessage(cause))
      }
    },
    [user, activities],
  )

  const todayActivities = useMemo(
    () => activities.filter((activity) => activity.day === today),
    [activities, today],
  )

  const streak = useMemo(() => calculateStreak(activities, today), [activities, today])

  return { activities, today, todayActivities, streak, loading, error, log, remove, reload }
}
