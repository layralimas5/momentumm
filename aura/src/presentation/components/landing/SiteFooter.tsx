import { Link } from 'react-router-dom'
import { AuraMark } from '@/presentation/components/AuraMark'

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-12 sm:px-6 md:flex-row">
        <div className="text-center md:text-left">
          <AuraMark light />
          <p className="mt-3 max-w-xs text-sm text-zinc-500">
            A jornada entre a mulher que você é hoje e a que decidiu se tornar.
          </p>
        </div>

        <nav aria-label="Rodapé" className="flex items-center gap-6 text-sm">
          <a href="#produto" className="text-zinc-400 transition-colors hover:text-white">
            O produto
          </a>
          <a href="#planos" className="text-zinc-400 transition-colors hover:text-white">
            Planos
          </a>
          <Link to="/entrar" className="font-medium text-brand-300 transition-colors hover:text-brand-200">
            Entrar
          </Link>
        </nav>
      </div>

      <div className="border-t border-white/5 py-6">
        <p className="text-center text-sm text-zinc-600">© {year} Aura · feito por Layra Lima</p>
      </div>
    </footer>
  )
}
