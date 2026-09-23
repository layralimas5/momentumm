import { Link } from 'react-router-dom'
import { quizPathFor } from '@/domain/analytics/quiz-links'
import { Reveal } from './Reveal'
import { CTA } from './site'
import { useOffer } from './use-offer'
import { useSiteCta } from './use-site-cta'

/**
 * O fechamento repete a frase que encerra o onboarding do app: a pessoa não
 * precisa resolver o objetivo inteiro hoje. O destino do CTA vem de `site.ts`
 * e acompanha o estágio do produto.
 */
export function FinalCta() {
  const cta = useSiteCta()
  const offer = useOffer()
  const primaryLabel = cta.signedIn ? cta.primary.label : (offer?.cta ?? cta.primary.label)

  return (
    <section id="comecar" className="scroll-mt-20 border-t border-line bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:py-28">
        <Reveal>
          <div className="surface-brand edge-light relative overflow-hidden rounded-card px-6 py-14 text-center sm:px-12 sm:py-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-brand/15 blur-[100px]"
            />
            <div className="relative">
              <h2 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                {offer?.closing ?? 'Você diz quanto tempo tem livre por dia. A gente monta o plano.'}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-ink-muted">
                Coloca a sua meta e os minutos que sobram no seu dia. O Momentumm transforma isso em
                etapas e ações, te mostra só o próximo passo e ajusta quando a semana não sai como o
                planejado.
              </p>

              <div className="mt-9 flex flex-col items-center gap-4">
                <Link
                  to={cta.primary.to}
                  className="inline-flex h-14 w-full max-w-xs items-center justify-center rounded-xl bg-brand px-8 font-medium text-white transition-colors hover:bg-brand-hi sm:w-auto"
                >
                  {primaryLabel}
                </Link>
                {cta.signedIn ? null : (
                  <Link
                    to={quizPathFor('lp-fim')}
                    className="text-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    {CTA.secondary.label}
                  </Link>
                )}
              </div>

              <p className="mt-6 text-sm text-ink-faint">
                {cta.signedIn ? 'Você já tem conta. O plano de hoje te espera.' : CTA.reassurance}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
