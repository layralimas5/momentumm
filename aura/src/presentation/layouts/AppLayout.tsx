import { NavLink, Link, useNavigate, type To } from 'react-router-dom'
import { Compass, Target, BookOpen, LogOut, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AuraMark } from '@/presentation/components/AuraMark'
import { ProfileRules } from '@/domain/entities/profile'
import { useAuth } from '@/presentation/auth/use-auth'
import { cn } from '@/shared/lib/cn'

interface NavItem {
  to: To
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { to: '/app', label: 'Jornada', icon: Compass },
  { to: '/app/metas', label: 'Metas', icon: Target },
  { to: '/app/leituras', label: 'Leituras', icon: BookOpen },
]

/** Shell do app autenticado: sidebar (desktop) + barra inferior (mobile). */
export function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, isDemo, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const canSignOut = !isDemo && user !== null
  const isAdmin = profile !== null && ProfileRules.isAdmin(profile)

  return (
    <div className="min-h-svh bg-zinc-50 dark:bg-zinc-950">
      {isDemo && <DemoBanner />}

      {/* Top bar — mobile */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-900/90">
        <Link to="/" aria-label="Aura — início">
          <AuraMark />
        </Link>
        {canSignOut && (
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sair"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <LogOut className="h-5 w-5" />
          </button>
        )}
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6 md:px-6">
        {/* Sidebar — desktop */}
        <aside className="sticky top-6 hidden h-fit w-56 shrink-0 md:block">
          <Link to="/" className="mb-6 inline-block px-2">
            <AuraMark />
          </Link>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <SidebarLink key={item.label} item={item} />
            ))}
            {isAdmin && <SidebarLink item={{ to: '/admin', label: 'Admin', icon: Shield }} />}
          </nav>

          {canSignOut && (
            <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p className="truncate px-3 text-xs text-zinc-500" title={user?.email ?? ''}>
                {user?.email}
              </p>
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                <LogOut className="h-4.5 w-4.5" />
                Sair
              </button>
            </div>
          )}
        </aside>

        {/* Conteúdo */}
        <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      {/* Navegação inferior — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-zinc-200 bg-white/90 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-900/90">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/app'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-zinc-500 dark:text-zinc-400',
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function SidebarLink({ item: { to, label, icon: Icon } }: { item: NavItem }) {
  return (
    <NavLink
      to={to}
      end={to === '/app'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
        )
      }
    >
      <Icon className="h-4.5 w-4.5" />
      {label}
    </NavLink>
  )
}

function DemoBanner() {
  return (
    <div className="border-b border-brand-200 bg-brand-50 px-4 py-2 text-center text-xs text-brand-700 dark:border-brand-900 dark:bg-brand-950/60 dark:text-brand-300">
      Modo demonstração — dados de exemplo, não salvos. Configure o Supabase para contas e dados
      reais.
    </div>
  )
}
