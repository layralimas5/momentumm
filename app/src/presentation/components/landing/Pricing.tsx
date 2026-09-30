import { Link } from 'react-router-dom'
import { TRIAL_DAYS } from '@/domain/billing/trial'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { trackLanding, useSectionView } from './landing-analytics'
import { useProQuotes } from '@/presentation/billing/use-pro-quotes'
import { pricingFootnote, pricingPlans, PRO_ALL_FEATURES, type PricingPlan } from './plans'
import { Reveal } from './Reveal'
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

/**
 * O recomendado perde o `h-full` no desktop: esticado pelo grid, a margem
 * negativa o deixa mais alto que os vizinhos em vez de só deslocá-lo.
 */
const FEATURED_ITEM = 'h-full lg:-my-6 lg:h-auto'

export function Pricing() {
  const viewRef = useSectionView('pricing_viewed')
  // Quem lê a landing é, quase sempre, quem nunca assinou: o preço de entrada.
  const { quotes } = useProQuotes(true)
  const plans = pricingPlans(quotes)

  return (
    <Section id="planos" className="border-t border-line">
      <div ref={viewRef}>
        <SectionHeading
          eyebrow="Planos"
          title="Pare de começar de novo."
          description="Comece de graça. O PRO transforma seus objetivos em progresso real: clareza do que fazer hoje, constância nos dias ruins e a sua evolução à vista."
        />

        <ul className="mx-auto mt-12 grid max-w-md items-stretch gap-5 lg:max-w-none lg:grid-cols-3 lg:gap-6">
          {plans.map((plan, index) => (
            <li key={plan.id} className={plan.highlight ? FEATURED_ITEM : 'h-full'}>
              <Reveal delay={index * 0.08} className="h-full">
                <PlanCard plan={plan} />
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal delay={0.16}>
          <ProFeaturesDetails />
        </Reveal>

        <Reveal delay={0.2}>
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
          {pricingFootnote(quotes)}
        </p>
      </div>
    </Section>
  )
}

interface PlanCardProps {
  readonly plan: PricingPlan
}

/**
 * Os três cards têm a mesma espinha, na mesma ordem: selo, nome, preço, frase,
 * botão e lista. O bloco do preço e o da frase têm altura mínima no desktop,
 * então os três botões caem na mesma linha, e a lista vem depois do botão:
 * quem já decidiu não precisa rolar o card pra achar onde clicar.
 *
 * O mensal é o card que a página quer que a pessoa escolha, e o desenho diz
 * isso: mais alto que os vizinhos, fundo de marca e selo de recomendado. É a
 * porta mais barata pra começar (R$ 9,90 no primeiro mês); o anual continua
 * com o selo de mais econômico no próprio preço. Os limites do gratuito aparecem
 * como limites (marcação neutra), não como vantagens.
 */
function PlanCard({ plan }: PlanCardProps) {
  const cta = useSiteCta('lp-precos')
  const { price } = plan
  const isPro = plan.checkoutCycle !== undefined
  const isFeatured = plan.highlight === true

  // Sem conta, todos os cards usam o CTA da página inteira: o PRO começa pelo
  // teste, e um segundo texto de botão quebraria a regra do CTA único. Com
  // conta, os cards do PRO levam pro checkout do ciclo deles.
  const goesToCheckout = isPro && (cta.signedIn || !TRIAL_PROMISE_VERIFIED)
  const to = goesToCheckout ? `/app/assinatura?ciclo=${plan.checkoutCycle}` : cta.primary.to
  const label = goesToCheckout ? plan.cta : cta.primary.label

  return (
    <article
      aria-labelledby={`plano-${plan.id}`}
      className={cn(
        'pulse-on-hover relative flex h-full flex-col rounded-card border p-6 sm:p-7',
        isFeatured && 'lg:pt-10',
        isFeatured
          ? 'surface-brand edge-light border-brand shadow-2xl shadow-brand/20 ring-1 ring-brand/40'
          : 'border-line bg-surface',
      )}
    >
      <div className="flex h-7 items-center justify-between gap-3">
        <p
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide',
            isFeatured
              ? 'bg-brand text-white'
              : isPro
                ? 'border border-brand/40 text-brand-ink'
                : 'border border-line text-ink-muted',
          )}
        >
          {isPro ? <BoltIcon /> : null}
          {plan.badge}
        </p>
        {isFeatured ? (
          <p className="rounded-full border border-brand/40 bg-brand-dim/40 px-2.5 py-1 text-xs font-medium text-brand-ink">
            Recomendado
          </p>
        ) : null}
      </div>

      <h3 id={`plano-${plan.id}`} className="mt-4 text-lg font-semibold text-ink">
        {plan.headline}
      </h3>

      <div className="mt-4 lg:min-h-[11.5rem]">
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          {price.strike ? (
            <>
              <s className="tabular text-lg text-ink-faint">{price.strike}</s>
              <span className="sr-only">, agora </span>
            </>
          ) : null}
          <span className="tabular text-4xl font-semibold text-ink">{price.amount}</span>
          <span className="text-sm text-ink-muted">{price.period}</span>
        </p>
        {price.note ? (
          <p className="tabular mt-1 text-sm text-ink-muted">{price.note}</p>
        ) : null}
        {price.tag ? (
          <p
            className={cn(
              'mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
              price.tagTone === 'positive' ? 'bg-positive/15 text-positive' : 'bg-white/5 text-ink-muted',
            )}
          >
            {price.tag}
          </p>
        ) : null}
        {price.perks ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {price.perks.map((perk) => (
              <li key={perk} className="inline-flex items-start gap-1.5 text-xs text-ink-muted">
                <CheckIcon tone="positive" />
                {perk}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="mt-3 text-pretty text-sm text-ink-muted lg:min-h-[2.75rem]">{plan.description}</p>

      <Link
        to={to}
        onClick={() => trackLanding('pricing_cta_clicked')}
        className={cn(
          'pulse-button mt-5 inline-flex h-12 items-center justify-center rounded-xl px-4 font-medium transition-colors',
          isFeatured
            ? 'bg-brand text-white hover:bg-brand-hi'
            : 'border border-line-hi text-ink hover:border-brand/60 hover:bg-brand/10',
        )}
      >
        {label}
      </Link>
      <p className="mt-2.5 text-center text-xs text-ink-faint">
        {isPro
          ? TRIAL_PROMISE_VERIFIED
            ? `${TRIAL_DAYS} dias de teste, sem cartão.`
            : 'Cancela quando quiser.'
          : 'Grátis e sem cartão. Sem prazo pra decidir.'}
      </p>

      <div className="mt-6 flex flex-1 flex-col border-t border-line pt-5">
        {plan.featuresIntro ? (
          <p className="mb-3 text-sm font-semibold text-ink">{plan.featuresIntro}</p>
        ) : null}

        <ul className="flex flex-col gap-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className={cn('flex gap-2.5 text-sm', isPro ? 'text-ink' : 'text-ink-muted')}>
              <CheckIcon tone={isPro ? 'brand' : 'muted'} />
              {feature}
            </li>
          ))}
        </ul>

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
    </article>
  )
}

/** A lista inteira do PRO, fechada por padrão: os cards mostram só o resumo. */
function ProFeaturesDetails() {
  return (
    <details
      className="group mx-auto mt-6 max-w-3xl rounded-card border border-line bg-surface/60 open:bg-surface"
    >
      <summary className="flex cursor-pointer list-none items-center justify-center gap-2 px-5 py-4 text-sm font-medium text-ink marker:hidden">
        Ver tudo o que o PRO tem
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-4 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <ul className="grid gap-x-8 gap-y-2.5 px-5 pb-6 sm:grid-cols-2 sm:px-8">
        {PRO_ALL_FEATURES.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-sm text-ink">
            <CheckIcon tone="brand" />
            {feature}
          </li>
        ))}
      </ul>
    </details>
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
