import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LandingPage } from '@/presentation/pages/LandingPage'
import { VagasPage } from '@/presentation/pages/VagasPage'
import { ProtectedRoute } from '@/presentation/auth/ProtectedRoute'
import { AdminRoute } from '@/presentation/auth/AdminRoute'
import { AppLayout } from '@/presentation/layouts/AppLayout'
import { RouteFallback } from '@/presentation/components/RouteFallback'

// Área autenticada isolada num chunk lazy — mantém o Supabase fora da landing.
const AuthLayout = lazy(() => import('@/presentation/app/AuthLayout'))
const AuthPage = lazy(() =>
  import('@/presentation/pages/AuthPage').then((m) => ({ default: m.AuthPage })),
)
const SubscriptionPage = lazy(() =>
  import('@/presentation/pages/SubscriptionPage').then((m) => ({ default: m.SubscriptionPage })),
)
const AdminPage = lazy(() =>
  import('@/presentation/pages/AdminPage').then((m) => ({ default: m.AdminPage })),
)
const DashboardPage = lazy(() =>
  import('@/presentation/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const GoalsPage = lazy(() =>
  import('@/presentation/pages/GoalsPage').then((m) => ({ default: m.GoalsPage })),
)
const BooksPage = lazy(() =>
  import('@/presentation/pages/BooksPage').then((m) => ({ default: m.BooksPage })),
)

/** App autenticado: exige sessão + assinatura ativa, envolve no layout. */
function ProtectedApp({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Suspense fallback={<RouteFallback />}>{children}</Suspense>
      </AppLayout>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/vagas" element={<VagasPage />} />

        {/* Tudo que precisa de sessão vive sob o AuthLayout (chunk lazy). */}
        <Route
          element={
            <Suspense fallback={<RouteFallback />}>
              <AuthLayout />
            </Suspense>
          }
        >
          <Route path="/entrar" element={<AuthPage mode="login" />} />
          <Route path="/criar-conta" element={<AuthPage mode="signup" />} />
          <Route path="/assinatura" element={<SubscriptionPage />} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="/app" element={<ProtectedApp><DashboardPage /></ProtectedApp>} />
          <Route path="/app/metas" element={<ProtectedApp><GoalsPage /></ProtectedApp>} />
          <Route path="/app/leituras" element={<ProtectedApp><BooksPage /></ProtectedApp>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
