import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TRIAL_DAYS } from '@/domain/billing/trial'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { trackLanding, useSectionView } from './landing-analytics'
import {
  ANNUAL_EXTRAS,
  PRICING_FOOTNOTE,
  PRICING_PLANS,
  type BillingCycle,
  type PricingPlan,
} from './plans'
import { Reveal } from './Reveal'
import { CycleToggle } from './CycleToggle'
import { Section, SectionHeading } from './Section'
import { TRIAL_PROMISE_VERIFIED } from './site'
import { useSiteCta } from './use-site-cta'

/**
 * As garantias ficam coladas no preço, que é onde o risco aparece. Eram três
 * cards; viraram uma linha, porque cada uma cabe em cinco palavras e três
 * caixas pra isso é só mais rolagem.
 */
const GUARANTEES = [
  'Privado por padrão',
  'Cancela num clique',
  'Nada é apagado se você voltar pro gratuito',
] as const

export function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>('anual')
  const viewRef = useSectionView('pricing_viewed')

  return (
    <Section id="planos" className="border-t border-line">
      <div ref={viewRef}>
        <SectionHeading
          eyebrow="Planos"
          title="Comece de graça. Assine quando fizer diferença."
          description="O gratuito roda o ciclo inteiro. O PRO tira os limites, abre o histórico completo e a leitura da IA."
        />

        <div className="mt-8 flex justify-center">
          <CycleToggle value={cycle} onChange={setCycle} />
        </div>

        <ul className="mx-auto mt-8 grid max-w-4xl items-stretch gap-4 md:grid-cols-2">
          {PRICING_PLANS.map((plan, index) => (
            <li key={plan.id} className="h-full">
              <Reveal delay={index * 0.08} className="h-full">
                <PlanCard plan={plan} cycle={cycle} />
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal delay={0.16}>
          <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-muted">
            {GUARANTEES.map((item) => (
              <li key={item} className="inline-flex items-center gap-2">
                <Icon name="check" className="size-4 shrink-0 text-positive" />
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-ink-faint">
          {PRICING_FOOTNOTE}
        </p>
      </div>
    </Section>
  )
}

function PlanCard({ plan, cycle }: { plan: PricingPlan; cycle: BillingCycle }) {
  const cta = useSiteCta('lp-precos')
  const price = plan.prices[cycle]
  const isPro = plan.highlight === true
  const showAnnualExtras = isPro && cycle === 'anual'

  // O card do gratuito usa o CTA da página inteira; o do PRO leva pro checkout.
  const to = isPro ? `/app/assinatura?ciclo=${cycle}` : cta.primary.to
  const label = isPro ? plan.cta : cta.primary.label

  return (
    <article
      aria-labelledby={`plano-${plan.id}`}
      className={cn(
        'pulse-on-hover flex h-full flex-col rounded-card border p-6',
        isPro ? 'border-brand bg-brand-dim/30 shadow-xl shadow-brand/10' : 'border-line bg-surface',
      )}
    >
      <p
        className={cn(
          'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide',
          isPro ? 'bg-brand text-white' : 'border border-line text-ink-muted',
        )}
      >
        {isPro ? <BoltIcon /> : null}
        {plan.badge}
      </p>

      <h3 id={`plano-${plan.id}`} className="mt-4 text-balance text-lg font-semibold text-ink">
        {plan.headline}
      </h3>

      <div className="mt-4 min-h-[5.5rem]" aria-live="polite">
        <p className="flex flex-wrap items-baseline gap-x-1">
          <span className="tabular text-3xl font-semibold text-ink">{price.amount}</span>
          <span className="text-sm text-ink-muted">{price.period}</span>
          {price.strike ? (
            <>
              <span className="sr-only">, contra</span>
              <s className="tabular ml-2 text-sm text-ink-faint">{price.strike}</s>
              <span className="sr-only">pagando mês a mês</span>
            </>
          ) : null}
        </p>
        {price.note ? <p className="tabular mt-1 text-sm text-ink-muted">{price.note}</p> : null}
        {price.savings ? (
          <p className="mt-2 inline-flex rounded-full bg-positive/15 px-2.5 py-1 text-xs font-medium text-positive">
            {price.savings}
          </p>
        ) : null}
      </div>

      <p className="mt-2 text-pretty text-sm text-ink-muted">{plan.description}</p>

      <ul className="mt-5 flex flex-1 flex-col gap-2 border-t border-line pt-5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-sm text-ink-muted">
            <CheckIcon />
            {feature}
          </li>
        ))}
        {showAnnualExtras
          ? ANNUAL_EXTRAS.map((feature) => (
              <li key={feature} className="flex gap-2.5 text-sm text-ink">
                <CheckIcon highlight />
                {feature}
              </li>
            ))
          : null}
      </ul>

      <Link
        to={to}
        onClick={() => trackLanding('pricing_cta_clicked')}
        className={cn(
          'pulse-button mt-6 inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors',
          isPro
            ? 'bg-brand text-white hover:bg-brand-hi'
            : 'border border-line text-ink hover:border-line-hi',
        )}
      >
        {label}
      </Link>
      <p className="mt-2.5 text-center text-xs text-ink-faint">
        {isPro
          ? TRIAL_PROMISE_VERIFIED
            ? `${TRIAL_DAYS} dias de teste, sem cartão. Cancela quando quiser.`
            : 'Cancela quando quiser.'
          : 'Grátis e sem cartão. Sem prazo pra decidir.'}
      </p>
    </article>
  )
}

function CheckIcon({ highlight = false }: { highlight?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('mt-0.5 inline size-4 shrink-0', highlight ? 'text-brand-hi' : 'text-positive')}
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
