import { NavLink, Outlet } from 'react-router-dom'
import { container } from '@/infrastructure/container'
import { initialsOf } from '@/domain/entities/profile'
import { useAuth } from '@/presentation/auth/use-auth'
import { LogoMark, Wordmark } from '@/presentation/components/brand/Logo'
import { cn } from '@/shared/lib/cn'

interface NavItem {
  readonly to: string
  readonly label: string
  readonly end: boolean
  /** Path de um ícone 24x24 com stroke, desenhado inline pra não pesar bundle. */
  readonly icon: string
}

const NAV: readonly NavItem[] = [
  { to: '/app', label: 'Hoje', end: true, icon: 'M4 13h5v7H4zM10 8h5v12h-5zM16 4h4v16h-4z' },
  { to: '/app/atividades', label: 'Atividades', end: false, icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/app/metas', label: 'Metas', end: false, icon: 'M12 21a9 9 0 1 0-9-9M12 3v9l6 3' },
  { to: '/app/perfil', label: 'Perfil', end: false, icon: 'M5 20a7 7 0 0 1 14 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8' },
]

/**
 * Três formatos da mesma navegação: barra inferior no celular, barra horizontal
 * no tablet e coluna lateral fixa no desktop. Só a partir de `lg` a tela vira
 * dashboard de verdade — abaixo disso a coluna única continua sendo o melhor uso
 * do espaço.
 */
export function AppLayout() {
  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <TabletNav />

        <main
          id="conteudo"
          className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-10 lg:px-8 lg:pt-10"
        >
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  )
}

function Sidebar() {
  const { profile, user } = useAuth()

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/40 px-4 py-6 lg:flex">
      <Wordmark className="w-40 px-2" />

      <nav aria-label="Navegação principal" className="mt-8 flex-1">
        <ul className="flex flex-col gap-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={sidebarLinkClass}>
                <NavIcon path={item.icon} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {profile ? (
        <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-3 py-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-dim text-sm font-semibold text-brand-hi"
          >
            {initialsOf(profile.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{profile.name}</p>
            <p className="truncate text-xs text-ink-faint">{user?.email ?? `@${profile.handle}`}</p>
          </div>
        </div>
      ) : null}

      {container.demo ? <DemoBadge className="mt-3 self-start" /> : null}
    </aside>
  )
}

function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur lg:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="flex items-center gap-2">
          <LogoMark className="size-6 sm:hidden" />
          <Wordmark className="hidden w-40 sm:block" />
        </span>
        {container.demo ? <DemoBadge /> : null}
      </div>
    </header>
  )
}

function TabletNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="sticky top-16 z-20 hidden border-b border-line bg-canvas/95 backdrop-blur sm:block lg:hidden"
    >
      <ul className="mx-auto flex max-w-6xl items-center gap-1 px-6 py-2">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} className={inlineLinkClass}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function MobileNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 backdrop-blur sm:hidden"
    >
      <ul className="flex items-center justify-around px-2 py-2">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} className={mobileLinkClass}>
              <NavIcon path={item.icon} />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
    >
      <path d={path} />
    </svg>
  )
}

function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'rounded-full border border-line px-2.5 py-1 text-xs text-ink-faint',
        className,
      )}
    >
      modo demo
    </span>
  )
}

type LinkState = { readonly isActive: boolean }

function sidebarLinkClass({ isActive }: LinkState): string {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
    isActive ? 'bg-surface-hi text-ink' : 'text-ink-muted hover:bg-surface hover:text-ink',
  )
}

function inlineLinkClass({ isActive }: LinkState): string {
  return cn(
    'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-surface text-ink' : 'text-ink-muted hover:text-ink',
  )
}

function mobileLinkClass({ isActive }: LinkState): string {
  return cn(
    'flex min-w-16 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors',
    isActive ? 'text-ink' : 'text-ink-faint hover:text-ink',
  )
}
