import { createContext } from 'react'
import type { AuthUser } from '@/application/auth/auth-service'
import type { Profile } from '@/domain/entities/profile'

export interface AuthContextValue {
  user: AuthUser | null
  /** Perfil (papel + status de assinatura) da usuária logada. */
  profile: Profile | null
  loading: boolean
  /** true quando roda em modo demo (sem Supabase configurado). */
  isDemo: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
