import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { initialsOf } from '@/domain/entities/profile'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { LogoMark, Wordmark } from '@/presentation/components/brand/Logo'
import { Icon } from '@/presentation/components/ui/Icon'
import { FocusProvider } from '@/presentation/focus/FocusProvider'
import { FocusSession } from '@/presentation/focus/FocusSession'
import { ComposerProvider } from '@/presentation/planner/ComposerProvider'
import { PlannerProvider } from '@/presentation/planner/PlannerProvider'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { AppHeader } from './AppHeader'
import { APP_NAV, MOBILE_NAV, type AppNavItem } from './nav-items'

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
          <LayoutShell />
          <FocusSession />
        </FocusProvider>
      </ComposerProvider>
    </PlannerProvider>
  )
}

function LayoutShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(collapsed))
    } catch {
      // Preferência de layout não vale quebrar a tela por causa de storage.
    }
  }, [collapsed])

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fechar navegação"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-canvas/80 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface">
            <SidebarContent collapsed={false} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onOpenMenu={() => setDrawerOpen(true)} />
        <OfflineBanner />

        {/*
          O conteúdo ocupa a largura inteira do monitor. Quem cuida da leitura é
          a grade de colunas e o teto de largura de cada bloco de texto — faixa
          central estreita em tela grande só produz margem morta dos dois lados.
        */}
        <main
          id="conteudo"
          className="w-full flex-1 px-4 pb-28 pt-5 sm:px-6 sm:pb-10 lg:px-8 lg:pt-7 2xl:px-10"
        >
          <Outlet />
        </main>
      </div>

      <MobileNav />
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
  const { profile, user, signOut } = useAuth()

  return (
    <div className="flex h-full flex-col px-3 py-5">
      <div className={cn('flex items-center px-1', collapsed ? 'justify-center' : 'justify-between')}>
        {collapsed ? <LogoMark className="size-7" /> : <Wordmark className="w-36" />}
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
          {APP_NAV.map((item) => (
            <li key={item.to}>
              <SidebarLink item={item} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      {profile ? (
        <div className={cn('mt-4 border-t border-line pt-4', collapsed && 'flex justify-center')}>
          <div className={cn('flex items-center gap-3', collapsed && 'flex-col gap-2')}>
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-dim text-sm font-semibold text-brand-hi"
            >
              {initialsOf(profile.name)}
            </span>
            {collapsed ? null : (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{profile.name}</p>
                <p className="truncate text-xs text-ink-faint">
                  {user?.email ?? `@${profile.handle}`}
                </p>
              </div>
            )}
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

function MobileNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 backdrop-blur lg:hidden"
    >
      <ul className="flex items-center justify-around px-2 py-2">
        {MOBILE_NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex min-w-16 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-ink' : 'text-ink-faint hover:text-ink',
                )
              }
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Sem rede o app continua legível: o aviso explica por que nada salva. */
function OfflineBanner() {
  const { online } = usePlanner()
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
