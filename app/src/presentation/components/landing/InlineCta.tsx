import { Link } from 'react-router-dom'
import { Reveal } from './Reveal'
import { CTA } from './site'

/**
 * Chamada leve entre seções. Do hero até os planos são milhares de pixels
 * sem botão: quem se convence no meio precisava rolar até o fim. É uma linha
 * com o mesmo destino do CTA principal, nunca um card gigante repetido.
 */
export function InlineCta({ prompt }: { readonly prompt: string }) {
  return (
    <Reveal>
      <div className="mx-auto -mt-6 flex max-w-5xl flex-col items-center justify-center gap-3 px-4 pb-20 text-center sm:-mt-10 sm:flex-row sm:gap-5 sm:pb-28">
        <p className="text-sm text-ink-muted">{prompt}</p>
        <Link
          to={CTA.primary.to}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-brand/50 bg-brand-dim/30 px-5 text-sm font-medium text-ink transition-colors hover:bg-brand-dim/60"
        >
          {CTA.primary.label}
        </Link>
      </div>
    </Reveal>
  )
}
