import { useContext } from 'react'
import { AuthContext, type AuthState } from './auth-context'

export function useAuth(): AuthState {
  const state = useContext(AuthContext)
  if (!state) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  }
  return state
}
