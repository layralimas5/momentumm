import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { isAuthBypass } from '@/infrastructure/config/env'
import { AuthProvider } from '@/presentation/auth/AuthProvider'
import { ProtectedRoute } from '@/presentation/auth/ProtectedRoute'
import { AppLayout } from '@/presentation/layouts/AppLayout'
import { LandingPage } from '@/presentation/pages/LandingPage'

// As telas internas só carregam depois do login: mantém o primeiro load leve.
const AuthPage = lazy(() =>
  import('@/presentation/pages/AuthPage').then((m) => ({ default: m.AuthPage })),
)

const NewPasswordPage = lazy(() =>
  import('@/presentation/pages/NewPasswordPage').then((m) => ({ default: m.NewPasswordPage })),
)
const ToolsPage = lazy(() =>
  import('@/presentation/pages/ToolsPage').then((m) => ({ default: m.ToolsPage })),
)
const DashboardPage = lazy(() =>
  import('@/presentation/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const HabitsPage = lazy(() =>
  import('@/presentation/pages/HabitsPage').then((m) => ({ default: m.HabitsPage })),
)
const FocusPage = lazy(() =>
  import('@/presentation/pages/FocusPage').then((m) => ({ default: m.FocusPage })),
)
const ReviewPage = lazy(() =>
  import('@/presentation/pages/ReviewPage').then((m) => ({ default: m.ReviewPage })),
)
const InsightsPage = lazy(() =>
  import('@/presentation/pages/InsightsPage').then((m) => ({ default: m.InsightsPage })),
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
const CirclePage = lazy(() =>
  import('@/presentation/pages/CirclePage').then((m) => ({ default: m.CirclePage })),
)
const ChallengesPage = lazy(() =>
  import('@/presentation/pages/ChallengesPage').then((m) => ({ default: m.ChallengesPage })),
)
const ChallengeDetailPage = lazy(() =>
  import('@/presentation/pages/ChallengeDetailPage').then((m) => ({
    default: m.ChallengeDetailPage,
  })),
)
const FriendProfilePage = lazy(() =>
  import('@/presentation/pages/FriendProfilePage').then((m) => ({
    default: m.FriendProfilePage,
  })),
)
const PersonalProfilePage = lazy(() =>
  import('@/presentation/pages/PersonalProfilePage').then((m) => ({
    default: m.PersonalProfilePage,
  })),
)
const ObjectivesPage = lazy(() =>
  import('@/presentation/pages/ObjectivesPage').then((m) => ({ default: m.ObjectivesPage })),
)
const ObjectiveDetailPage = lazy(() =>
  import('@/presentation/pages/ObjectiveDetailPage').then((m) => ({
    default: m.ObjectiveDetailPage,
  })),
)
const PlanPage = lazy(() =>
  import('@/presentation/pages/PlanPage').then((m) => ({ default: m.PlanPage })),
)
const ProgressPage = lazy(() =>
  import('@/presentation/pages/ProgressPage').then((m) => ({ default: m.ProgressPage })),
)
const AiPage = lazy(() =>
  import('@/presentation/pages/AiPage').then((m) => ({ default: m.AiPage })),
)

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToHash />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/entrar"
              element={isAuthBypass ? <Navigate to="/app" replace /> : <AuthPage />}
            />
            {/*
              Destino do link de recuperação. Fica FORA da rota protegida: a
              sessão que o link abre existe pra trocar a senha, e mandar essa
              pessoa pro app antes de ela escolher a senha nova é justamente o
              que a recuperação deveria impedir.
            */}
            <Route path="/nova-senha" element={<NewPasswordPage />} />
            <Route path="/ferramentas" element={<ToolsPage />} />

            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="objetivos" element={<ObjectivesPage />} />
              <Route path="objetivos/:id" element={<ObjectiveDetailPage />} />
              <Route path="habitos" element={<HabitsPage />} />
              <Route path="plano" element={<PlanPage />} />
              <Route path="progresso" element={<ProgressPage />} />
              <Route path="review" element={<ReviewPage />} />
              <Route path="ia" element={<AiPage />} />

              <Route path="jornada" element={<ActivitiesPage />} />
              <Route path="metas" element={<GoalsPage />} />
              <Route path="foco" element={<FocusPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="perfil" element={<PersonalProfilePage />} />
              <Route path="circulo" element={<CirclePage />} />
              <Route path="desafios" element={<ChallengesPage />} />
              <Route path="desafios/:id" element={<ChallengeDetailPage />} />
              <Route path="circulo/:id" element={<FriendProfilePage />} />
              <Route path="configuracoes" element={<ProfilePage />} />

              {/* Rotas antigas continuam válidas: link salvo não pode virar 404. */}
              <Route path="atividades" element={<Navigate to="/app/jornada" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

/**
 * O React Router não mexe na rolagem sozinho: trocar de tela mantém a posição
 * da anterior. No celular isso aparece como "Ver todos" no fim de Hoje abrindo
 * Hábitos já rolado até o terceiro card, então toda troca de rota sem âncora
 * volta pro topo.
 *
 * Com âncora ele rola até ela. Isso importa quando o link vem de outra rota
 * (ex: /ferramentas → /#pro), porque a seção só existe depois que a página
 * nova monta. Os passos (#passo-...) são tratados pelo próprio bloco.
 */
function ScrollToHash() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    if (hash.startsWith('#passo-')) return

    const target = document.querySelector(hash)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    // Rota recém-trocada: espera o próximo quadro pra seção existir no DOM.
    const frame = requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])

  return null
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
