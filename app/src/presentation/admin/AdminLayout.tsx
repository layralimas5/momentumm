import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ADMIN_ROLE_LABELS } from '@/domain/admin/admin-role'
import { minutesLeft } from '@/domain/admin/admin-session'
import { useAuth } from '@/presentation/auth/use-auth'
import { LogoMark, Wordmark } from '@/presentation/components/brand/Logo'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { ADMIN_NAV, adminNavItemFor, type AdminNavItem } from './admin-nav'
import { useAdmin } from './admin-context'

/**
 * A casca do painel: sidebar no desktop, faixa de abas rolável abaixo.
 *
 * É um layout próprio, não o `AppLayout` com outra navegação: o painel não
 * carrega planner, foco, estúdio de compartilhamento nem aceite legal, e
 * misturar as duas cascas faria um `useContext` do app comum ser chamado
 * sem provider no meio de uma tela administrativa.
 */
export function AdminLayout({ children }: { children: ReactNode }) {
  const admin = useAdmin()
  const { pathname } = useLocation()
  const items = ADMIN_NAV.filter((item) => admin.can(item.requires))
  const current = adminNavItemFor(pathname)

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      {/* A coluna cresce com a tela, e a marca dentro dela cresce junto. */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface/40 lg:flex xl:w-64 2xl:w-72">
        <div className="flex h-full flex-col px-3 py-5">
          <div className="flex flex-col items-start gap-3 px-1">
            <Wordmark className="w-28 xl:w-32 2xl:w-36" />
            <span className="rounded-full border border-brand/40 bg-brand-dim/40 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-ink uppercase">
              painel admin
            </span>
          </div>
          <nav aria-label="Navegação do painel" className="mt-8 flex-1">
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} />
                </li>
              ))}
            </ul>
          </nav>
          <SessionBadge />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 pt-safe py-3">
            <div className="flex items-center gap-2">
              <LogoMark className="size-6 sm:size-7" />
              <span className="truncate text-sm font-semibold text-ink sm:text-base">{current?.label ?? 'Painel'}</span>
            </div>
            <div className="flex items-center gap-2">
              <NavLink to="/app" className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-ink-muted hover:text-ink">
                Ir pro app
              </NavLink>
              <SessionBadge compact />
            </div>
          </div>
          <nav aria-label="Navegação do painel" className="overflow-x-auto px-2 pb-2">
            <ul className="flex gap-1">
              {items.map((item) => (
                <li key={item.to} className="shrink-0">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        isActive
                          ? 'border-brand/40 bg-brand-dim/50 text-brand-ink'
                          : 'border-line text-ink-muted hover:bg-surface-hi',
                      )
                    }
                  >
                    <Icon name={item.icon} className="size-3.5" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        {admin.session && !admin.session.mfaRequired ? (
          <p role="alert" className="border-b border-danger/40 bg-danger/10 px-4 py-2 text-center text-sm text-ink">
            <strong>Verificação em duas etapas desligada no painel.</strong> Qualquer pessoa com a senha
            de uma conta com papel entra e age aqui. Ligue de volta na aba Painel →
            Segurança do painel.
          </p>
        ) : null}

        <main id="conteudo" className="w-full flex-1 px-4 pt-4 pb-10 sm:px-6 lg:px-8 lg:pt-7 2xl:px-10">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

function SidebarLink({ item }: { item: AdminNavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'nav-active-bar bg-surface-hi text-ink' : 'text-ink-muted hover:bg-surface hover:text-ink',
        )
      }
    >
      <Icon name={item.icon} />
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
}

/**
 * Quanto tempo falta pra sessão administrativa vencer. Recalculado a cada
 * meio minuto — é informação, não relógio: quem decide é o servidor.
 */
function SessionBadge({ compact = false }: { compact?: boolean }) {
  const admin = useAdmin()
  const { profile, signOut } = useAuth()
  const [, tick] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const left = minutesLeft(admin.session?.sessionExpiresAt ?? null)
  const warn = left <= 10

  if (compact) {
    return (
      <span
        className={cn(
          'rounded-full border px-2 py-1 text-[11px] font-medium tabular',
          warn ? 'border-flame/40 text-flame' : 'border-line text-ink-faint',
        )}
        title="Sessão administrativa"
      >
        {left} min
      </span>
    )
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{profile?.name ?? 'Conta'}</p>
          <p className="text-xs text-ink-faint">{admin.role ? ADMIN_ROLE_LABELS[admin.role] : ''}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-hi hover:text-ink"
        >
          <Icon name="saida" className="size-4" />
          <span className="sr-only">Sair da conta</span>
        </button>
      </div>
      <p className={cn('mt-3 text-xs tabular', warn ? 'text-flame' : 'text-ink-faint')}>
        Sessão administrativa: {left} min
      </p>
      <NavLink to="/app" className="mt-2 inline-block text-xs text-ink-muted underline-offset-2 hover:underline">
        Voltar pro app
      </NavLink>
    </div>
  )
}
