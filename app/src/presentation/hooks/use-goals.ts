import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Activity } from '@/domain/entities/activity'
import type { DayKey } from '@/domain/entities/day'
import { isActive, progressOf, type Goal, type GoalProgress, type NewGoalInput } from '@/domain/entities/goal'
import { container } from '@/infrastructure/container'
import { toUserMessage } from '@/shared/errors'
import { useAuth } from '@/presentation/auth/use-auth'

interface UseGoals {
  readonly goals: Goal[]
  readonly progress: GoalProgress[]
  readonly loading: boolean
  readonly error: string | null
  create(input: Omit<NewGoalInput, 'userId'>): Promise<void>
  archive(id: string): Promise<void>
}

export function useGoals(activities: readonly Activity[], today: DayKey): UseGoals {
  const { user } = useAuth()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user) {
      setGoals([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const list = await container.goals.listByUser(user.id)
      setGoals(list.filter(isActive))
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

  const create = useCallback(
    async (input: Omit<NewGoalInput, 'userId'>) => {
      if (!user) return
      const goal = await container.goals.create({ userId: user.id, ...input })
      setGoals((current) => [...current, goal])
      setError(null)
    },
    [user],
  )

  const archive = useCallback(
    async (id: string) => {
      if (!user) return
      const previous = goals
      setGoals((current) => current.filter((goal) => goal.id !== id))
      try {
        await container.goals.archive(id, user.id)
      } catch (cause) {
        setGoals(previous)
        setError(toUserMessage(cause))
      }
    },
    [user, goals],
  )

  const progress = useMemo(
    () => goals.map((goal) => progressOf(goal, activities, today)),
    [goals, activities, today],
  )

  return { goals, progress, loading, error, create, archive }
}
