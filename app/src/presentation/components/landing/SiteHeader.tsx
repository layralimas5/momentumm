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

  // No topo o header é transparente pro banner passar por baixo dele.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-colors duration-300',
        scrolled || mobileOpen || openGroup
          ? 'border-b border-line bg-canvas/90 backdrop-blur'
          : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        {/* No celular só o símbolo cabe ao lado do menu e do CTA. */}
        <Link to="/" aria-label="Momentumm, ir para o início" className="shrink-0">
          <LogoMark className="size-7 md:hidden" />
          <Wordmark decorative className="hidden md:block md:w-40 lg:w-44" />
        </Link>

        <div ref={navRef} className="hidden md:block">
          <nav aria-label="Navegação principal">
            <ul className="flex items-center gap-1">
              {NAV_GROUPS.map((group) => {
                const open = openGroup === group.label
                return (
                  <li key={group.label} className="relative">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenGroup(open ? null : group.label)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors',
                        open ? 'text-ink' : 'text-ink-muted hover:text-ink',
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
                              <span className="block text-sm font-medium text-ink">{link.label}</span>
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
                    className="block rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/entrar"
            className="hidden rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:text-ink sm:block"
          >
            Entrar
          </Link>
          <Link
            to="/entrar"
            className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hi"
          >
            Começar grátis
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-expanded={mobileOpen}
            aria-controls="menu-mobile"
            className="rounded-lg p-2 text-ink-muted transition-colors hover:text-ink md:hidden"
          >
            <span className="sr-only">{mobileOpen ? 'Fechar menu' : 'Abrir menu'}</span>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
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
          'max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-canvas md:hidden',
          mobileOpen ? 'block' : 'hidden',
        )}
      >
        <div className="mx-auto max-w-5xl px-4 py-3">
          {NAV_GROUPS.map((group) => (
            <details key={group.label} className="group border-b border-line last:border-b-0">
              <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium text-ink marker:hidden">
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
                      className="block rounded-lg px-2 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
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
              className="block border-t border-line py-3 text-sm font-medium text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}
