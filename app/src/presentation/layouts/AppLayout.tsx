import { NavLink, Outlet } from 'react-router-dom'
import { container } from '@/infrastructure/container'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { cn } from '@/shared/lib/cn'

const NAV = [
  { to: '/app', label: 'Hoje', end: true },
  { to: '/app/atividades', label: 'Atividades', end: false },
  { to: '/app/metas', label: 'Metas', end: false },
  { to: '/app/perfil', label: 'Perfil', end: false },
] as const

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Wordmark className="w-36 sm:w-40" />
          {container.demo ? (
            <span className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-faint">
              modo demo
            </span>
          ) : null}
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:pb-10">
        <Outlet />
      </main>

      <Nav />
    </div>
  )
}

function Nav() {
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 backdrop-blur',
        'sm:sticky sm:bottom-auto sm:top-16 sm:border-t-0 sm:border-b sm:bg-transparent',
      )}
    >
      <ul className="mx-auto flex max-w-3xl items-center justify-around px-2 py-2 sm:justify-start sm:gap-1 sm:px-4">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-surface text-ink' : 'text-ink-muted hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
