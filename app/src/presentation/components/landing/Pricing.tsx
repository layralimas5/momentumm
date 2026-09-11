import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { PRICING_FOOTNOTE, PRICING_PLANS } from './plans'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'
import { CTA } from './site'

export function Pricing() {
  return (
    <Section id="planos" className="border-t border-line">
      <SectionHeading
        eyebrow="Planos"
        title="O método é grátis. O PRO é profundidade."
        description="O plano gratuito entrega o ciclo inteiro e nunca bloqueia uma tela com banner. O PRO amplia quantidade, histórico e análise pra quem já tem ritmo."
      />

      <ul className="mt-12 grid items-center gap-4 lg:grid-cols-3">
        {PRICING_PLANS.map((plan, index) => (
          /*
            A escala do destaque fica NESTE li, não no card e não no Reveal:
            o Reveal escreve transform inline pra animação de entrada e
            engoliria a classe de escala; o card usa transform no hover.
          */
          <li
            key={plan.id}
            className={cn('h-full', plan.highlight && 'relative z-10 lg:scale-[1.06]')}
          >
            <Reveal delay={index * 0.08} className="h-full">
              <article
                aria-labelledby={`plano-${plan.id}`}
                className={cn(
                  'pulse-on-hover flex h-full flex-col rounded-card border p-6',
                  plan.highlight
                    ? 'border-brand bg-brand-dim/30 shadow-xl shadow-brand/10'
                    : 'border-line bg-surface',
                )}
              >
                <p
                  className={cn(
                    'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide',
                    plan.highlight ? 'bg-brand text-white' : 'border border-line text-ink-muted',
                  )}
                >
                  {plan.highlight ? <BoltIcon /> : null}
                  {plan.badge}
                </p>

                <h3 id={`plano-${plan.id}`} className="mt-4 text-balance text-lg font-semibold text-ink">
                  {plan.headline}
                </h3>

                <div className="mt-4">
                  <p className="flex flex-wrap items-baseline gap-x-1">
                    <span className="tabular text-3xl font-semibold text-ink">{plan.price}</span>
                    <span className="text-sm text-ink-muted">{plan.period}</span>
                    {plan.strikePrice ? (
                      <>
                        <span className="sr-only">, de</span>
                        <s className="tabular ml-2 text-sm text-ink-faint decoration-danger/70">
                          {plan.strikePrice}
                        </s>
                      </>
                    ) : null}
                  </p>
                  {plan.monthlyEquivalent ? (
                    <p className="tabular mt-1 text-sm text-ink-muted">{plan.monthlyEquivalent}</p>
                  ) : null}
                  {plan.savings ? (
                    <p className="mt-2 inline-flex rounded-full bg-positive/15 px-2.5 py-1 text-xs font-medium text-positive">
                      {plan.savings}
                    </p>
                  ) : null}
                </div>

                <p className="mt-4 text-pretty text-sm text-ink-muted">{plan.description}</p>

                <dl
                  className={cn(
                    'mt-5 rounded-xl border px-4 py-3',
                    plan.highlight ? 'border-brand/40 bg-canvas/40' : 'border-line bg-surface-hi/60',
                  )}
                >
                  {plan.specs.map((spec) => (
                    <div
                      key={spec.label}
                      className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0"
                    >
                      <dt className="text-xs text-ink-faint">{spec.label}</dt>
                      <dd
                        className={cn(
                          'text-right text-xs font-medium',
                          plan.highlight ? 'text-brand-hi' : 'text-ink',
                        )}
                      >
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm text-ink-muted">
                      <CheckIcon />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  to={CTA.primary.to}
                  className={cn(
                    'mt-6 inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors',
                    plan.highlight
                      ? 'bg-brand text-white hover:bg-brand-hi'
                      : 'border border-line text-ink hover:border-line-hi',
                  )}
                >
                  {plan.cta}
                </Link>
              </article>
            </Reveal>
          </li>
        ))}
      </ul>

      <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-ink-faint">{PRICING_FOOTNOTE}</p>
    </Section>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="mt-0.5 inline size-4 shrink-0 text-positive"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5" fill="currentColor">
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
    </svg>
  )
}
