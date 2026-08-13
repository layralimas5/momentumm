import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './use-auth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="grid min-h-dvh place-items-center bg-canvas">
        <span className="sr-only">Carregando</span>
        <span
          aria-hidden="true"
          className="size-6 animate-spin rounded-full border-2 border-line-hi border-t-brand"
        />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
