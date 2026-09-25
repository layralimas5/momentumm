import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TRIAL_DAYS } from '@/domain/billing/trial'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { trackLanding, useSectionView } from './landing-analytics'
import {
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

        <ul className="mx-auto mt-8 grid max-w-5xl items-stretch gap-5 md:grid-cols-[0.85fr_1.15fr]">
          {PRICING_PLANS.map((plan, index) => (
            <li key={plan.id} className={cn('h-full', plan.highlight && 'order-first md:order-none')}>
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

interface PlanCardProps {
  readonly plan: PricingPlan
  readonly cycle: BillingCycle
}

/**
 * O PRO é o card que a página quer que a pessoa escolha, e o desenho diz
 * isso: mais largo, fundo de marca, preço maior e a lista inteira do que ele
 * tem, em grupos. O que muda no jeito de pagar (anual ou mensal) fica colado
 * no preço. O gratuito fica contido, e os limites dele aparecem como limites
 * (marcação neutra), não como vantagens.
 */
function PlanCard({ plan, cycle }: PlanCardProps) {
  const cta = useSiteCta('lp-precos')
  const price = plan.prices[cycle]
  const isPro = plan.highlight === true
  const showGroupLabels = plan.features.length > 1

  // O card do gratuito usa o CTA da página inteira; o do PRO leva pro checkout.
  const to = isPro ? `/app/assinatura?ciclo=${cycle}` : cta.primary.to
  const label = isPro ? plan.cta : cta.primary.label

  return (
    <article
      aria-labelledby={`plano-${plan.id}`}
      className={cn(
        'pulse-on-hover flex h-full flex-col rounded-card border',
        isPro
          ? 'surface-brand edge-light border-brand p-6 shadow-2xl shadow-brand/20 ring-1 ring-brand/40 sm:p-8'
          : 'border-line bg-surface p-6',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide',
            isPro ? 'bg-brand text-white' : 'border border-line text-ink-muted',
          )}
        >
          {isPro ? <BoltIcon /> : null}
          {plan.badge}
        </p>
        {isPro ? (
          <p className="rounded-full border border-brand/40 bg-brand-dim/40 px-2.5 py-1 text-xs font-medium text-brand-ink">
            Recomendado
          </p>
        ) : null}
      </div>

      <h3
        id={`plano-${plan.id}`}
        className={cn('mt-4 text-balance font-semibold', isPro ? 'text-xl text-ink' : 'text-lg text-ink-muted')}
      >
        {plan.headline}
      </h3>

      <div className="mt-4 min-h-[5.5rem]" aria-live="polite">
        <p className="flex flex-wrap items-baseline gap-x-1">
          <span className={cn('tabular font-semibold text-ink', isPro ? 'text-4xl sm:text-5xl' : 'text-3xl')}>
            {price.amount}
          </span>
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
        {price.perks ? (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {price.perks.map((perk) => (
              <li key={perk} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <CheckIcon tone="positive" />
                {perk}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="mt-3 text-pretty text-sm text-ink-muted">{plan.description}</p>

      <div className="mt-5 flex flex-1 flex-col border-t border-line pt-5">
        {plan.featuresIntro ? (
          <p className="mb-4 text-sm font-semibold text-ink">{plan.featuresIntro}</p>
        ) : null}

        <div className="flex flex-col gap-5">
          {plan.features.map((group) => (
            <div key={group.label}>
              {showGroupLabels ? (
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-hi">{group.label}</p>
              ) : null}
              <ul className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <li key={item} className={cn('flex gap-2.5 text-sm', isPro ? 'text-ink' : 'text-ink-muted')}>
                    <CheckIcon tone={isPro ? 'brand' : 'muted'} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {plan.limits ? (
          <ul className="mt-4 flex flex-col gap-2 border-t border-dashed border-line pt-4">
            {plan.limits.map((limit) => (
              <li key={limit} className="flex gap-2.5 text-sm text-ink-faint">
                <MinusIcon />
                {limit}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Link
        to={to}
        onClick={() => trackLanding('pricing_cta_clicked')}
        className={cn(
          'pulse-button mt-6 inline-flex items-center justify-center rounded-xl px-4 font-medium transition-colors',
          isPro
            ? 'h-12 bg-brand text-base text-white hover:bg-brand-hi'
            : 'h-11 border border-line text-sm text-ink hover:border-line-hi',
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

const CHECK_TONE = {
  brand: 'text-brand-hi',
  positive: 'text-positive',
  muted: 'text-ink-faint',
} as const

function CheckIcon({ tone }: { tone: keyof typeof CHECK_TONE }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('mt-0.5 inline size-4 shrink-0', CHECK_TONE[tone])}
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

function MinusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="mt-0.5 inline size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M6 12h12" />
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
