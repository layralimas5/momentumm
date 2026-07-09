import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ProfileRules } from '@/domain/entities/profile'
import { useAuth } from '@/presentation/auth/use-auth'
import { AuthLoading } from '@/presentation/auth/AuthLoading'

/** Portão do admin: exige sessão E papel admin. Caso contrário, some (→ home). */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <AuthLoading />
  if (!user) return <Navigate to="/entrar" replace />
  if (!profile || !ProfileRules.isAdmin(profile)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
