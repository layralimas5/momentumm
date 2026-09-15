import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoMark, Wordmark } from '@/presentation/components/brand/Logo'
import { cn } from '@/shared/lib/cn'
import { NAV_DIRECT, NAV_GROUPS } from './nav-items'

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  // A pílula flutua desde o topo; ao rolar ela só ganha fundo mais sólido
  // e sombra, pra continuar legível em cima de qualquer seção.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Esc fecha o menu do celular; o hash mudando (clique numa âncora) também.
  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen])

  // Fecha o submenu ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!openGroup) return

    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpenGroup(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenGroup(null)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openGroup])

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
      <div
        className={cn(
          'mx-auto max-w-5xl border backdrop-blur-xl transition-[background-color,box-shadow,border-radius] duration-300',
          mobileOpen ? 'rounded-3xl' : 'rounded-full',
          scrolled || mobileOpen || openGroup
            ? 'border-line-hi bg-surface/95 shadow-2xl shadow-black/40'
            : 'border-line bg-surface/70 shadow-lg shadow-black/20',
        )}
      >
        <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center gap-2 pl-3 pr-1.5 sm:h-16 sm:gap-3 sm:pl-5 sm:pr-2.5 lg:grid-cols-[1fr_auto_1fr]">
          {/* No celular só o símbolo cabe ao lado do menu e do CTA. */}
          <Link
            to="/"
            aria-label="Momentumm, ir para o início"
            className="shrink-0 justify-self-start"
          >
            <LogoMark className="size-7 sm:hidden" />
            <Wordmark decorative className="hidden w-32 sm:block md:w-36 lg:w-40" />
          </Link>

          <div ref={navRef} className="hidden justify-self-center lg:block">
            <nav aria-label="Navegação principal">
              <ul className="flex items-center gap-0.5">
                {NAV_GROUPS.map((group) => {
                  const open = openGroup === group.label
                  return (
                    <li key={group.label} className="relative">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenGroup(open ? null : group.label)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                          open ? 'bg-surface-hi text-ink' : 'text-ink-muted hover:text-ink',
                        )}
                      >
                        {group.label}
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          className={cn(
                            'size-3.5 transition-transform duration-200',
                            open && 'rotate-180',
                          )}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>

                      {open ? (
                        <ul className="absolute left-0 top-full mt-2 w-72 overflow-hidden rounded-card border border-line bg-surface p-1.5 shadow-2xl shadow-black/50">
                          {group.links.map((link) => (
                            <li key={link.href}>
                              <Link
                                to={link.href}
                                onClick={() => setOpenGroup(null)}
                                className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hi"
                              >
                                <span className="block text-sm font-medium text-ink">
                                  {link.label}
                                </span>
                                <span className="mt-0.5 block text-xs text-ink-faint">
                                  {link.description}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}

                {NAV_DIRECT.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="block rounded-full px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 justify-self-end sm:gap-1.5">
            <Link
              to="/entrar"
              className="inline-flex h-10 items-center rounded-full px-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink sm:h-11 sm:px-3.5"
            >
              Entrar
            </Link>
            <Link
              to="/entrar"
              className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-brand px-3 text-sm font-medium text-white shadow-lg shadow-brand/30 transition-colors hover:bg-brand-hi active:bg-brand-deep sm:h-11 sm:px-5"
            >
              Começar grátis
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              aria-expanded={mobileOpen}
              aria-controls="menu-mobile"
              className="grid size-10 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-hi hover:text-ink lg:hidden"
            >
              <span className="sr-only">{mobileOpen ? 'Fechar menu' : 'Abrir menu'}</span>
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {mobileOpen ? (
                  <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        <nav
          id="menu-mobile"
          aria-label="Navegação principal"
          className={cn(
            'max-h-[calc(100dvh-6rem)] overflow-y-auto border-t border-line lg:hidden',
            mobileOpen ? 'block' : 'hidden',
          )}
        >
          <div className="px-5 py-3">
            {NAV_GROUPS.map((group) => (
              <details key={group.label} className="group border-b border-line last:border-b-0">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-3 text-sm font-medium text-ink marker:hidden">
                  {group.label}
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="size-4 text-ink-muted transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <ul className="pb-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-lg px-2 py-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-hi hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}

            {NAV_DIRECT.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex min-h-11 items-center border-t border-line py-3 text-sm font-medium text-ink"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  )
}
