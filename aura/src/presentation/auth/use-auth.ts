import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from '@/presentation/auth/auth-context'

/** Acessa a sessão e as ações de autenticação. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  }
  return ctx
}
