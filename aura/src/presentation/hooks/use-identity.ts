import { useCallback, useEffect, useState } from 'react'
import type { Identity, IdentityAnswers } from '@/domain/entities/identity'
import { identityUseCases } from '@/presentation/app/use-cases'
import { useAuth } from '@/presentation/auth/use-auth'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { toUserMessage } from '@/shared/errors'

interface UseIdentityResult {
  identity: Identity | null
  loading: boolean
  /** Falha do carregamento ou da última gravação — o que a tela deve mostrar. */
  error: string | null
  clearError: () => void
  /** Nunca lança: devolve `true` em caso de sucesso. */
  save: (answers: IdentityAnswers) => Promise<boolean>
}

/** Estado e ação da Identidade Futura para a UI. */
export function useIdentity(): UseIdentityResult {
  const { user } = useAuth()
  const userId = user?.id ?? 'demo'
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { error: actionError, clearError, run } = useAsyncAction()

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setIdentity(await identityUseCases.get(userId))
    } catch (err) {
      setLoadError(toUserMessage(err))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    (answers: IdentityAnswers) =>
      run(async () => {
        setIdentity(await identityUseCases.save(userId, answers))
      }),
    [userId, run],
  )

  return { identity, loading, error: loadError ?? actionError, clearError, save }
}
