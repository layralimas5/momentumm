import { useEffect } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { featureForRoute } from '@/domain/analytics/product-events'
import { track, trackFeatureView } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { TrialBanner } from '@/presentation/plan/TrialBanner'
import { SUBSCRIPTION_PATH } from '@/presentation/plan/subscription-path'
import { useInviteCapture } from '@/presentation/circle/use-invite-capture'
import { Icon } from '@/presentation/components/ui/Icon'
import { EvolutionNotice } from '@/presentation/evolution/EvolutionNotice'
import { EvolutionProvider } from '@/presentation/evolution/EvolutionProvider'
import { FocusProvider } from '@/presentation/focus/FocusProvider'
import { FocusSession } from '@/presentation/focus/FocusSession'
import { ComposerProvider } from '@/presentation/planner/ComposerProvider'
import { LegalGate } from '@/presentation/legal/LegalGate'
import { PlannerProvider } from '@/presentation/planner/PlannerProvider'
import { ShareStudioProvider } from '@/presentation/share/ShareStudioProvider'
import { PostComposerProvider } from '@/presentation/social/PostComposerProvider'
import { useDocumentTitle } from '@/presentation/hooks/use-document-title'
import { offerSource, storedOffer } from '@/presentation/components/landing/offers'
import { ACTIVATION_PATH, isActivationSkipped } from '@/presentation/planner/use-activation'
import { hasPendingQuizPlan, QUIZ_ACTIVATION_PATH } from '@/presentation/quiz/quiz-activation'
import { usePlanner } from '@/presentation/planner/use-planner'
import { useNotificationOpen } from '@/presentation/notifications/use-notification-open'
import { SystemNotice } from './SystemNotice'
import { AppTopBar } from './AppTopBar'
import { BottomNavigation } from './BottomNavigation'
import '@fontsource-variable/plus-jakarta-sans/wght.css'

/**
 * Casca do app: sidebar fixa à esquerda, header em cima e conteúdo em grade
 * ocupando a largura do monitor.
 *
 * A partir de `lg` a tela vira dashboard de verdade. Abaixo disso a coluna
 * única continua sendo o melhor uso do espaço, com a navegação na barra
 * inferior, o mesmo conteúdo, outra embalagem.
 */
export function AppLayout() {
  return (
    <PlannerProvider>
      <ComposerProvider>
        <FocusProvider>
          {/*
            O Share Studio fica por último de propósito: ele lê o planner e o
            perfil, e é aberto de dentro de qualquer tela. Um estúdio por página
            seria o começo da divergência entre os cards.
          */}
          <EvolutionProvider>
            {/*
              A evolução lê o planner (é dele que o XP nasce) e é lida pelo
              Share Studio (arranjos por nível) e pelo perfil: por isso fica
              dentro de um e em volta do outro.
            */}
            <ShareStudioProvider>
              {/*
                O criador de publicação fica aqui pelo mesmo motivo do Share
                Studio: ele é aberto pelo "+" da barra (que mora na casca), pelo
                Feed e pelo Perfil. Um criador por tela seria o começo de três
                publicações com regras diferentes.
              */}
              <PostComposerProvider>
                <LayoutShell />
                <FocusSession />
                <LegalGate />
                <EvolutionNotice />
              </PostComposerProvider>
            </ShareStudioProvider>
          </EvolutionProvider>
        </FocusProvider>
      </ComposerProvider>
    </PlannerProvider>
  )
}

function LayoutShell() {
  const { pathname } = useLocation()

  useInviteCapture()
  useUsageEvents()
  useNotificationOpen()
  useDocumentTitle()
  usePresence()

  const gate = useActivationGate(pathname)
  if (gate) return gate

  /*
    O primeiro acesso não tem casca: sem barra de abas, sem atalho pra outra
    tela. Quatro perguntas e um plano, e só depois o app.
  */
  if (pathname === ACTIVATION_PATH || pathname === QUIZ_ACTIVATION_PATH) return <ActivationShell />

  /*
    3S: uma casca só pra celular, tablet e monitor. No monitor o conteúdo não
    estica: fica numa coluna central com a largura de leitura do celular, e a
    barra de baixo vira uma pílula flutuante.
  */
  return (
    <div className="app-3s min-h-dvh bg-canvas">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <AppTopBar />
      <SystemNotice />
      <OfflineBanner />

      <main id="conteudo" className="mx-auto w-full max-w-2xl px-4 pt-2 pb-tabbar sm:px-6 sm:pb-32">
        <TrialBanner />
        <Outlet />
      </main>

      <AdminEntry />
      <BottomNavigation />
    </div>
  )
}

/** A entrada do painel só existe pra quem tem papel; o 2º fator é cobrado na porta do /admin. */
function AdminEntry() {
  const { session } = useAuth()
  if (!session?.adminRole) return null

  return (
    <NavLink
      to="/admin"
      className="chip fixed top-20 right-4 z-30 hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-brand-ink lg:flex"
    >
      <Icon name="cadeado" className="size-4" />
      Painel admin
    </NavLink>
  )
}

function useActivationGate(pathname: string) {
  const { user } = useAuth()
  const planner = usePlanner()

  if (planner.loading) return null
  if (pathname === ACTIVATION_PATH || pathname === QUIZ_ACTIVATION_PATH) return null

  /*
    A assinatura é a única saída que o gate deixa aberta: quem esbarrou no
    limite do gratuito ao ativar o plano do quiz vai justamente assinar pra
    destravá-lo. Ao sair de lá, o gate traz de volta pra ativação, que dessa
    vez passa.
  */
  if (pathname.startsWith(SUBSCRIPTION_PATH)) return null

  /*
    Plano do quiz esperando no navegador: ele vem antes de qualquer tela,
    inclusive do onboarding. É o que faz o login com Google (que volta em
    `/entrar` sem estado nenhum) cair na ativação do plano, e não em quatro
    perguntas que a pessoa acabou de responder.
  */
  if (hasPendingQuizPlan()) return <Navigate to={QUIZ_ACTIVATION_PATH} replace />

  if (!planner.isNewUser) return null
  if (isActivationSkipped(user?.id ?? null)) return null

  return <Navigate to={ACTIVATION_PATH} replace />
}

function ActivationShell() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-5 sm:px-6">
        <Wordmark className="w-32" />
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-faint transition-colors hover:bg-surface-hi hover:text-ink"
        >
          <Icon name="saida" className="size-4" />
          Sair
        </button>
      </header>

      <main id="conteudo" className="w-full px-4 pb-10 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function useUsageEvents() {
  const { pathname } = useLocation()

  useEffect(() => {
    // A oferta do link de origem (TikTok) vai junto, pra comparar os ângulos
    // já no primeiro acesso, antes mesmo do onboarding.
    const source = offerSource(storedOffer())
    track('session_start', null, source ? { source } : {})
  }, [])

  useEffect(() => {
    const feature = featureForRoute(pathname)
    if (feature) trackFeatureView(feature)
  }, [pathname])
}

/**
 * Marca "abriu o app hoje" no servidor: ao montar e ao voltar pra aba. É o
 * que o lembrete do celular lê pra NÃO avisar quem já esteve aqui. Uma vez
 * a cada meia hora basta; a data é o que importa, não o minuto.
 */
const PRESENCE_EVERY_MS = 30 * 60 * 1000

function usePresence() {
  useEffect(() => {
    let last = 0
    const touch = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - last < PRESENCE_EVERY_MS) return
      last = now
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      container.push.touchPresence(timezone).catch(() => undefined)
    }
    touch()
    document.addEventListener('visibilitychange', touch)
    return () => document.removeEventListener('visibilitychange', touch)
  }, [])
}

function OfflineBanner() {
  const { online, syncing } = usePlanner()

  if (online && syncing) {
    return (
      <div role="status" className="relative h-0.5 w-full overflow-hidden bg-transparent">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-brand/70 motion-safe:animate-[sync_1.2s_ease-in-out_infinite]"
        />
        <span className="sr-only">Sincronizando com o servidor</span>
      </div>
    )
  }

  if (online) return null

  return (
    <p
      role="status"
      className="border-b border-flame/30 bg-flame-dim/50 px-4 py-2 text-center text-sm text-ink sm:px-6"
    >
      Você está sem conexão. Dá pra continuar lendo o dia, mas o que você marcar agora não salva.
    </p>
  )
}

