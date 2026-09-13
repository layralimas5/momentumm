import { Navigate, Outlet } from 'react-router-dom'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { AdminProvider } from './AdminProvider'
import { AdminLayout } from './AdminLayout'
import { MfaGate } from './MfaGate'
import { useAdmin } from './admin-context'

/**
 * A porta do `/admin`.
 *
 * Sem sessão: login. Sem papel: volta pro app, sem dizer que a rota existe.
 * Com papel e sem fator: cadastra o fator antes de ver qualquer coisa. Com
 * fator e sessão vencida (ou em aal1): verifica. Só então o layout monta.
 *
 * Tudo isso é leitura do servidor (`admin_me`); nada aqui é decidido por
 * flag de cliente. E mesmo que fosse contornado, cada função do banco
 * repete a checagem — a porta é cortesia, não barreira.
 */
export function AdminRoute() {
  const { user, loading } = useAuth()

  if (loading) return <FullscreenSpinner />
  if (!user) return <Navigate to="/entrar" replace state={{ from: '/admin' }} />

  if (container.demo) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
        <div className="max-w-md">
          <p className="text-lg font-semibold text-ink">O painel administrativo precisa do Supabase.</p>
          <p className="mt-2 text-sm text-ink-muted">
            No modo demo não existe conta, papel nem dado de verdade, e o painel não inventa
            número pra preencher gráfico. Configura o `.env.local` e entra com uma conta que
            tenha papel administrativo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <AdminProvider>
      <AdminGate />
    </AdminProvider>
  )
}

function AdminGate() {
  const admin = useAdmin()

  if (admin.loading) return <FullscreenSpinner />
  if (admin.gate === 'forbidden') return <Navigate to="/app" replace />
  if (admin.gate !== 'open') return <MfaGate />

  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}

function FullscreenSpinner() {
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
