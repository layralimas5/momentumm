import { Link } from 'react-router-dom'
import { Reveal } from './Reveal'
import { trackLanding } from './landing-analytics'
import { CTA, TRIAL_LINE, TRIAL_PROMISE_VERIFIED } from './site'
import { useOffer } from './use-offer'
import { useSiteCta } from './use-site-cta'

/**
 * O fechamento não repete a lista de recursos: repete a promessa. Quem chegou
 * até aqui já viu o produto, e o que falta é a frase que nomeia a decisão.
 *
 * O título acompanha a oferta que trouxe a pessoa (`offers.ts`), pra a página
 * fechar a mesma conversa que o conteúdo abriu.
 */
export function FinalCta() {
  const cta = useSiteCta('lp-fim')
  const offer = useOffer()

  return (
    <section id="comecar" className="scroll-mt-28 border-t border-line bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:py-28">
        <Reveal>
          <div className="surface-brand edge-light relative overflow-hidden rounded-card px-6 py-14 text-center sm:px-12 sm:py-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-brand/15 blur-[100px]"
            />
            <div className="relative">
              <h2 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                {offer?.closing ?? (
                  <>
                    <span className="block">Você não precisa começar de novo.{' '}</span>
                    <span className="block text-brand-hi">Precisa continuar daqui.</span>
                  </>
                )}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-ink-muted">
                Transforme sua meta em um plano possível, encontre seu próximo passo e veja seu
                progresso acontecer.
              </p>

              <div className="mt-9 flex flex-col items-center gap-4">
                <Link
                  to={cta.primary.to}
                  onClick={() => trackLanding('hero_cta_clicked')}
                  className="pulse-button inline-flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-brand px-8 font-medium text-white transition-colors hover:bg-brand-hi sm:w-auto"
                >
                  {cta.primary.label}
                  {cta.signedIn ? null : <ArrowIcon />}
                </Link>
                {cta.entry ? (
                  <Link
                    to={cta.entry.to}
                    className="text-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    Já tenho conta
                  </Link>
                ) : null}
              </div>

              <p className="mt-6 text-sm text-ink-faint">
                {cta.signedIn
                  ? 'Você já tem conta. O plano de hoje te espera.'
                  : TRIAL_PROMISE_VERIFIED
                    ? TRIAL_LINE
                    : CTA.reassurance}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h13M12 5l7 7-7 7" />
    </svg>
  )
}
