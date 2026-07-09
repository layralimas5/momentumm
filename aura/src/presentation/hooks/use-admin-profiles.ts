import { useCallback, useEffect, useState } from 'react'
import type { Profile, SubscriptionStatus } from '@/domain/entities/profile'
import type { AdminMetrics } from '@/application/profiles/profile-use-cases'
import { profileUseCases } from '@/presentation/app/use-cases'

interface UseAdminProfilesResult {
  profiles: Profile[]
  metrics: AdminMetrics | null
  loading: boolean
  error: string | null
  setStatus: (id: string, status: SubscriptionStatus) => Promise<void>
}

/** Carrega contas + métricas e permite liberar/bloquear (uso administrativo). */
export function useAdminProfiles(): UseAdminProfilesResult {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, m] = await Promise.all([
        profileUseCases.adminList(),
        profileUseCases.adminMetrics(),
      ])
      setProfiles(list)
      setMetrics(m)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar as contas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setStatus = useCallback(
    async (id: string, status: SubscriptionStatus) => {
      await profileUseCases.adminSetStatus(id, status)
      await refresh()
    },
    [refresh],
  )

  return { profiles, metrics, loading, error, setStatus }
}
