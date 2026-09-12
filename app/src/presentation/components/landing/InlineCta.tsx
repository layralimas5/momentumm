import { Link } from 'react-router-dom'
import { Reveal } from './Reveal'
import { CTA } from './site'

/**
 * Chamada entre seções. Do hero até os planos são milhares de pixels sem
 * botão: quem se convence no meio precisava rolar até o fim. É uma faixa
 * com o mesmo destino do CTA principal, com o botão cheio da marca pra
 * não passar despercebida, sem virar um card gigante repetido.
 */
export function InlineCta({ prompt }: { readonly prompt: string }) {
  return (
    <Reveal>
      <div className="mx-auto -mt-4 max-w-5xl px-4 pb-20 sm:-mt-8 sm:pb-28">
        <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-brand/40 bg-brand-dim/30 px-6 py-6 text-center sm:flex-row sm:gap-6 sm:py-5">
          <p className="text-base font-medium text-ink sm:text-lg">{prompt}</p>
          <Link
            to={CTA.primary.to}
            className="inline-flex h-13 shrink-0 items-center justify-center rounded-full bg-brand px-8 text-base font-medium text-white shadow-lg shadow-brand/30 transition-colors hover:bg-brand-hi"
          >
            {CTA.primary.label}
          </Link>
        </div>
      </div>
    </Reveal>
  )
}
