import { useCallback, useEffect, useState } from 'react'
import type { Identity, IdentityAnswers } from '@/domain/entities/identity'
import { identityUseCases } from '@/presentation/app/use-cases'
import { useAuth } from '@/presentation/auth/use-auth'

interface UseIdentityResult {
  identity: Identity | null
  loading: boolean
  error: string | null
  save: (answers: IdentityAnswers) => Promise<void>
}

/** Estado e ação da Identidade Futura para a UI. */
export function useIdentity(): UseIdentityResult {
  const { user } = useAuth()
  const userId = user?.id ?? 'demo'
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setIdentity(await identityUseCases.get(userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar sua identidade.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (answers: IdentityAnswers) => {
      const saved = await identityUseCases.save(userId, answers)
      setIdentity(saved)
    },
    [userId],
  )

  return { identity, loading, error, save }
}
