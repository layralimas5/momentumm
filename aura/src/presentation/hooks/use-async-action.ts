import { useCallback, useState } from 'react'
import { toUserMessage } from '@/shared/errors'

export interface AsyncActionState {
  /** Mensagem exibível da última falha, ou null. */
  error: string | null
  /** Limpa o erro — use ao reabrir um formulário. */
  clearError: () => void
  /**
   * Executa uma mutação sem nunca lançar: em caso de falha guarda a mensagem em
   * `error` e devolve `false`. Assim um `onClick={() => remove(id)}` não vira
   * unhandled rejection, e um formulário decide o que fazer pelo retorno.
   */
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

/**
 * Estado de erro compartilhado pelas mutações de um hook de dados. Centraliza a
 * tradução de exceção → mensagem, para nenhuma tela mostrar erro cru de banco.
 */
export function useAsyncAction(): AsyncActionState {
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      setError(toUserMessage(err))
      return false
    }
  }, [])

  return { error, clearError, run }
}
