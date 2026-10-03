import { Link } from 'react-router-dom'
import { Reveal } from './Reveal'
import { trackLanding } from './landing-analytics'
import { CTA, TRIAL_LINE, TRIAL_PROMISE_VERIFIED } from './site'
import { useSiteCta } from './use-site-cta'

/**
 * O diferencial do PRO: o review semanal com a leitura da IA.
 *
 * App de hábito conta repetição; nenhum fecha a semana com a pessoa. Aqui o
 * review cruza o que foi planejado com o que foi feito, a Momentumm AI
 * rascunha a leitura e o ajuste sai pronto pra aplicar. É o motivo de
 * escolha que não é preço, e acontece toda semana, não uma vez.
 *
 * O botão é o mesmo da página inteira, colocado onde o desejo está alto:
 * logo antes dos planos.
 */
export function WeeklyReview() {
  const cta = useSiteCta('lp-exclusivo')

  return (
    <section id="diferencial" className="scroll-mt-24 border-t border-line sm:scroll-mt-28">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <Reveal>
          <div className="surface-brand edge-light relative overflow-hidden rounded-card px-6 py-12 sm:px-12 sm:py-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand/20 blur-[90px]"
            />
            <div className="relative grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center md:gap-12">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-brand-hi">Só no PRO</p>
                <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                  Toda semana, a sua semana lida pra você.
                </h2>
                <p className="mt-4 max-w-xl text-pretty text-lg text-ink-muted">
                  O review semanal cruza o que você planejou com o que fez, e a Momentumm AI
                  rascunha a leitura: onde você avançou, o que pede atenção e o ajuste da próxima
                  semana, pronto pra aplicar.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 md:items-start">
                <Link
                  to={cta.primary.to}
                  onClick={() => trackLanding('hero_cta_clicked')}
                  className="pulse-button inline-flex h-12 w-full max-w-xs items-center justify-center rounded-xl bg-brand px-7 font-medium text-white transition-colors hover:bg-brand-hi"
                >
                  {cta.primary.label}
                </Link>
                <p className="text-center text-sm text-ink-muted md:text-left">
                  {cta.signedIn
                    ? 'Você já tem conta. O review está no app.'
                    : TRIAL_PROMISE_VERIFIED
                      ? TRIAL_LINE
                      : CTA.reassurance}
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
