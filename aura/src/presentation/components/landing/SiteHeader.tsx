import { Link } from 'react-router-dom'
import { AuraMark } from '@/presentation/components/AuraMark'
import { CtaButton } from '@/presentation/components/landing/CtaButton'

const navLinks = [
  { href: '#produto', label: 'O produto' },
  { href: '#planos', label: 'Planos' },
  { href: '#faq', label: 'Dúvidas' },
]

/** Header fixo com blur no tema escuro. Nav enxuta pra não competir com o CTA. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6">
        <Link to="/" aria-label="Aura — início">
          <AuraMark light />
        </Link>

        <nav aria-label="Seções" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/entrar"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white sm:inline-flex"
          >
            Entrar
          </Link>
          <CtaButton label="Garantir vaga" size="sm" />
        </div>
      </div>
    </header>
  )
}
