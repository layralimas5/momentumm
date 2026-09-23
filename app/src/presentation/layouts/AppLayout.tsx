import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { featureForRoute } from '@/domain/analytics/product-events'
import { track, trackFeatureView } from '@/infrastructure/analytics/track'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { LogoMark, Wordmark } from '@/presentation/components/brand/Logo'
import { MobileTabBar } from '@/presentation/components/mobile/MobileTabBar'
import { TrialBanner } from '@/presentation/plan/TrialBanner'
import { SUBSCRIPTION_PATH } from '@/presentation/plan/subscription-path'
import { MobileTopBar } from '@/presentation/components/mobile/MobileTopBar'
import { Icon } from '@/presentation/components/ui/Icon'
import { EvolutionNotice } from '@/presentation/evolution/EvolutionNotice'
import { EvolutionProvider } from '@/presentation/evolution/EvolutionProvider'
import { FocusProvider } from '@/presentation/focus/FocusProvider'
import { FocusSession } from '@/presentation/focus/FocusSession'
import { ComposerProvider } from '@/presentation/planner/ComposerProvider'
import { LegalGate } from '@/presentation/legal/LegalGate'
import { PlannerProvider } from '@/presentation/planner/PlannerProvider'
import { ShareStudioProvider } from '@/presentation/share/ShareStudioProvider'
import { useDocumentTitle } from '@/presentation/hooks/use-document-title'
import { useIsDesktop } from '@/presentation/hooks/use-media-query'
import { offerSource, storedOffer } from '@/presentation/components/landing/offers'
import { ACTIVATION_PATH, isActivationSkipped } from '@/presentation/planner/use-activation'
import { hasPendingQuizPlan, QUIZ_ACTIVATION_PATH } from '@/presentation/quiz/quiz-activation'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { AppHeader } from './AppHeader'
import { PRIMARY_NAV, type AppNavItem } from './nav-items'
import { SystemNotice } from './SystemNotice'

const COLLAPSED_KEY = 'momentumm.sidebar.collapsed'

/**
 * Casca do app: sidebar fixa à esquerda, header em cima e conteúdo em grade
 * ocupando a largura do monitor.
 *
 * A partir de `lg` a tela vira dashboard de verdade. Abaixo disso a coluna
 * única continua sendo o melhor uso do espaço, com a navegação na barra
 * inferior — o mesmo conteúdo, outra embalagem.
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
              <LayoutShell />
              <FocusSession />
              <LegalGate />
              <EvolutionNotice />
            </ShareStudioProvider>
          </EvolutionProvider>
        </FocusProvider>
      </ComposerProvider>
    </PlannerProvider>
  )
}

function LayoutShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()
  useUsageEvents()
  useDocumentTitle()
  usePresence()

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(collapsed))
    } catch {
      // Preferência de layout não vale quebrar a tela por causa de storage.
    }
  }, [collapsed])

  const gate = useActivationGate(pathname)
  if (gate) return gate

  /*
    O primeiro acesso não tem casca: sem sidebar, sem barra de abas, sem
    atalho pra outra tela. Quatro perguntas e um plano, e só depois o app.
  */
  if (pathname === ACTIVATION_PATH || pathname === QUIZ_ACTIVATION_PATH) return <ActivationShell />

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {isDesktop ? <AppHeader /> : <MobileTopBar />}
        <SystemNotice />
        <OfflineBanner />

        {/*
          O conteúdo ocupa a largura inteira do monitor. Quem cuida da leitura é
          a grade de colunas e o teto de largura de cada bloco de texto — faixa
          central estreita em tela grande só produz margem morta dos dois lados.
        */}
        {/* pb-tabbar reserva a altura exata da barra inferior mais a área segura. */}
        <main
          id="conteudo"
          className="w-full flex-1 px-4 pt-4 pb-tabbar sm:px-6 lg:px-8 lg:pt-7 lg:pb-10 2xl:px-10"
        >
          {/*
            Abaixo de `lg` a tela é a árvore do celular ou a página em coluna
            única, e num tablet de 820px as duas esticavam até a borda: card de
            uma coluna com 800px de largura tem linha de texto longa demais pra
            ler. O teto centraliza o conteúdo até virar dashboard de verdade.
          */}
          <div className="mx-auto w-full max-w-2xl lg:max-w-none">
            <TrialBanner />
            <Outlet />
          </div>
        </main>
      </div>

      {isDesktop ? null : <MobileTabBar />}
    </div>
  )
}

/**
 * Conta vazia abre no onboarding, e só nele.
 *
 * Enquanto a pessoa não criou nada e não pediu pra deixar pra depois, toda
 * rota de `/app/*` vira o primeiro acesso: o quiz é o começo do produto, não
 * um card que a barra de abas deixa ignorar. "Deixar pra depois" libera o
 * app e o Hoje passa a mostrar a porta de volta.
 */
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

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface/40 lg:flex',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-[4.75rem]' : 'w-64 2xl:w-[17rem]',
      )}
    >
      <SidebarContent collapsed={collapsed} onToggle={onToggle} />
    </aside>
  )
}

function SidebarContent({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle?: () => void
}) {
  const { profile, user, session, signOut } = useAuth()

  return (
    <div className="flex h-full flex-col px-3 py-5">
      <div className={cn('flex items-center px-1', collapsed ? 'justify-center' : 'justify-between')}>
        {collapsed ? <LogoMark className="size-7" /> : <Wordmark className="w-32" />}
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'}
            className={cn(
              'grid size-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-hi hover:text-ink',
              collapsed && 'absolute left-1/2 top-16 -translate-x-1/2',
            )}
          >
            <Icon name={collapsed ? 'expandir' : 'recolher'} className="size-4" />
          </button>
        ) : null}
      </div>

      <nav aria-label="Navegação principal" className={cn('flex-1', collapsed ? 'mt-14' : 'mt-8')}>
        <ul className="flex flex-col gap-1">
          {PRIMARY_NAV.map((item) => (
            <li key={item.to}>
              <SidebarLink item={item} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      {/*
        A entrada do painel só existe pra quem tem papel. O segundo fator não
        é cobrado aqui: é a porta do /admin que verifica, e o banco atrás dela.
      */}
      {session?.adminRole ? (
        <NavLink
          to="/admin"
          title={collapsed ? 'Painel admin' : undefined}
          className={cn(
            'mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-dim/40',
            collapsed && 'justify-center px-0',
          )}
        >
          <Icon name="cadeado" />
          {collapsed ? null : <span className="truncate">Painel admin</span>}
        </NavLink>
      ) : null}

      {profile ? (
        <div className={cn('mt-4 border-t border-line pt-4', collapsed && 'flex justify-center')}>
          <div className={cn('flex items-center gap-3', collapsed && 'flex-col gap-2')}>
            {/*
              O bloco do perfil é a porta pro painel de evolução no desktop.
              "Perfil" não entra na navegação principal — ela é o ciclo do
              produto — mas a foto e o nome no rodapé são o lugar onde qualquer
              pessoa procura pelo próprio perfil.
            */}
            <NavLink
              to="/app/perfil"
              className={cn(
                'flex min-w-0 items-center gap-3 rounded-lg transition-colors hover:text-brand-ink',
                collapsed ? 'flex-col gap-2' : 'flex-1',
              )}
            >
              <Avatar
                name={profile.name}
                src={profile.avatarUrl}
                className="size-9"
                textClassName="text-sm"
              />
              {collapsed ? null : (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {profile.name}
                  </span>
                  <span className="block truncate text-xs text-ink-faint">
                    {user?.email ?? `@${profile.handle}`}
                  </span>
                </span>
              )}
              <span className="sr-only">Abrir teu perfil</span>
            </NavLink>
            <button
              type="button"
              onClick={() => void signOut()}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-hi hover:text-ink"
            >
              <Icon name="saida" className="size-4" />
              <span className="sr-only">Sair da conta</span>
            </button>
          </div>
        </div>
      ) : null}

      {container.demo && !collapsed ? (
        <span className="mt-3 self-start rounded-full border border-line px-2.5 py-1 text-xs text-ink-faint">
          modo demo
        </span>
      ) : null}
    </div>
  )
}

function SidebarLink({ item, collapsed }: { item: AppNavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'nav-active-bar bg-surface-hi text-ink'
            : 'text-ink-muted hover:bg-surface hover:text-ink',
        )
      }
    >
      <Icon name={item.icon} />
      {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
    </NavLink>
  )
}

/**
 * Sem rede o app continua legível: o aviso explica por que nada salva. E
 * quando a rede volta (ou a aba volta), o provider relê o servidor por baixo
 * dos dados atuais; a linha fina no topo é o único sinal disso, porque trocar
 * a tela por um esqueleto a cada retorno de aba seria pior que não avisar.
 */
/**
 * Os eventos de uso que a casca registra: a sessão começou, e qual recurso
 * a pessoa abriu. Só o nome do recurso sai — a rota com id de objetivo vira
 * "objetivos", nunca o id. É a matéria-prima de "usuários ativos" e de
 * "recursos mais usados" no painel.
 */
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

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}
