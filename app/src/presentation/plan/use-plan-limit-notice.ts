import { useCallback, useState } from 'react'
import { PlanLimitError } from '@/domain/entities/plan-usage'
import type { PlanLimitNotice } from './PlanLimitDialog'

/**
 * Transforma a recusa do provider no aviso da tela.
 *
 * `catchLimit` embrulha uma ação: se ela estourar por limite do plano, o
 * diálogo abre com o recurso e a frase; qualquer outro erro continua subindo
 * pra quem chamou, porque limite de plano é a única falha que tem resposta
 * pronta.
 */
export function usePlanLimitNotice() {
  const [notice, setNotice] = useState<PlanLimitNotice | null>(null)

  const catchLimit = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    try {
      return await action()
    } catch (cause) {
      if (cause instanceof PlanLimitError) {
        setNotice({ feature: cause.feature, message: cause.message })
        return null
      }
      throw cause
    }
  }, [])

  const clear = useCallback(() => setNotice(null), [])

  return { notice, setNotice, catchLimit, clear }
}
