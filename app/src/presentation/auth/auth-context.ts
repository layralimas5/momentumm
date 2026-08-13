import { createContext } from 'react'
import type { AuthUser } from '@/domain/auth/auth-service'
import type { Profile } from '@/domain/entities/profile'

export interface AuthState {
  readonly user: AuthUser | null
  readonly profile: Profile | null
  readonly loading: boolean
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, name: string): Promise<void>
  signOut(): Promise<void>
  refreshProfile(): Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
