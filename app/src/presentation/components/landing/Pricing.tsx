import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
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
import { CTA } from './site'

export function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>('anual')

  return (
    <Section id="planos" className="border-t border-line">
      <SectionHeading
        eyebrow="Planos"
        title="O gratuito organiza e executa. O PRO registra, analisa e evolui."
        description="No gratuito você cria objetivo, organiza hábitos, acompanha o dia e vê o Momentumm Score de hoje. O PRO libera entender os próprios padrões, registrar a jornada, ver métricas e ajustar o plano com a leitura da IA."
      />

      <div className="mt-10 flex justify-center">
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

      <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-ink-faint">
        {PRICING_FOOTNOTE}
      </p>
    </Section>
  )
}

function PlanCard({ plan, cycle }: { plan: PricingPlan; cycle: BillingCycle }) {
  const price = plan.prices[cycle]
  const showAnnualExtras = plan.highlight === true && cycle === 'anual'

  return (
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

      <div className="mt-4 min-h-[5.5rem]" aria-live="polite">
        <p className="flex flex-wrap items-baseline gap-x-1">
          <span className="tabular text-3xl font-semibold text-ink">{price.amount}</span>
          <span className="text-sm text-ink-muted">{price.period}</span>
          {price.strike ? (
            <>
              <span className="sr-only">, de</span>
              <s className="tabular ml-2 text-sm text-ink-faint decoration-danger/70">
                {price.strike}
              </s>
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

      <ul className="mt-6 flex flex-1 flex-col gap-2.5 border-t border-line pt-6">
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
        to={plan.highlight ? `/app/assinatura?ciclo=${cycle}` : CTA.primary.to}
        className={cn(
          'mt-6 inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors',
          plan.highlight
            ? 'bg-brand text-white hover:bg-brand-hi'
            : 'border border-line text-ink hover:border-line-hi',
        )}
      >
        {plan.cta}
      </Link>
      <p className="mt-2.5 text-center text-xs text-ink-faint">
        {plan.highlight
          ? 'Sem cartão no teste. Cancela quando quiser.'
          : 'Sem cartão. Sem prazo pra decidir.'}
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
