import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ProfileRules } from '@/domain/entities/profile'
import { useAuth } from '@/presentation/auth/use-auth'
import { AuthLoading } from '@/presentation/auth/AuthLoading'

/**
 * Portão do app: exige sessão E assinatura ativa. Sem login → /entrar.
 * Logada mas sem assinatura ativa → /assinatura (aviso + link pro checkout).
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <AuthLoading />
  if (!user) return <Navigate to="/entrar" replace />
  if (!profile || !ProfileRules.hasAppAccess(profile)) {
    return <Navigate to="/assinatura" replace />
  }

  return <>{children}</>
}
