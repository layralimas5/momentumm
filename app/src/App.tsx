import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/presentation/auth/AuthProvider'
import { ProtectedRoute } from '@/presentation/auth/ProtectedRoute'
import { AppLayout } from '@/presentation/layouts/AppLayout'
import { LandingPage } from '@/presentation/pages/LandingPage'

// As telas internas só carregam depois do login: mantém o primeiro load leve.
const AuthPage = lazy(() =>
  import('@/presentation/pages/AuthPage').then((m) => ({ default: m.AuthPage })),
)
const TodayPage = lazy(() =>
  import('@/presentation/pages/TodayPage').then((m) => ({ default: m.TodayPage })),
)
const ActivitiesPage = lazy(() =>
  import('@/presentation/pages/ActivitiesPage').then((m) => ({ default: m.ActivitiesPage })),
)
const GoalsPage = lazy(() =>
  import('@/presentation/pages/GoalsPage').then((m) => ({ default: m.GoalsPage })),
)
const ProfilePage = lazy(() =>
  import('@/presentation/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/entrar" element={<AuthPage />} />

            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<TodayPage />} />
              <Route path="atividades" element={<ActivitiesPage />} />
              <Route path="metas" element={<GoalsPage />} />
              <Route path="perfil" element={<ProfilePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

function RouteFallback() {
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
