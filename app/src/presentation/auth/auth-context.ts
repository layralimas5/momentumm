import { createContext } from 'react'
import type { AuthUser } from '@/domain/auth/auth-service'
import type { Profile } from '@/domain/entities/profile'

export interface AuthState {
  readonly user: AuthUser | null
  readonly profile: Profile | null
  readonly loading: boolean
  signIn(email: string, password: string): Promise<void>
  /**
   * Devolve `true` quando a conta foi criada mas ainda falta confirmar o
   * e-mail. Nesse caso não há sessão, e a tela precisa dizer isso em vez de
   * tentar navegar pro app.
   */
  signUp(email: string, password: string, name: string): Promise<boolean>
  signOut(): Promise<void>
  refreshProfile(): Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
