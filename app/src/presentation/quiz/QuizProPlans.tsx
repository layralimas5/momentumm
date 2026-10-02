import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  formatBRL,
  monthlyEquivalentCents,
  type BillingCycle,
  type ProQuote,
} from '@/domain/billing/billing-plans'
import { container } from '@/infrastructure/container'
import { useProQuotes } from '@/presentation/billing/use-pro-quotes'
import { buttonClass } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { PRO_BENEFITS } from '@/presentation/plan/pro-benefits'
import { SUBSCRIPTION_PATH } from '@/presentation/plan/subscription-path'
import { cn } from '@/shared/lib/cn'

/**
 * Os dois planos do PRO, com preço, na tela de limite da ativação.
 *
 * Um botão "Assinar o PRO" sozinho pede pra pessoa decidir sem saber quanto
 * custa. Aqui ela vê os dois ciclos lado a lado, com o valor de entrada e a
 * renovação na mesma frase, e cada botão leva direto pro checkout daquele
 * ciclo. O mensal é o recomendado, como na landing: é a porta mais barata
 * pra começar. O anual fica como o mais econômico por mês.
 *
 * O preço sai do mesmo `quotePro` que a cobrança usa. A oferta de entrada só
 * vale pra quem nunca assinou, então a conta é consultada antes; enquanto a
 * resposta não chega, os cards esperam em vez de mostrar um preço errado.
 */
export function QuizProPlans() {
  const firstSubscription = useIsFirstSubscription()
  const { quotes, loading } = useProQuotes(firstSubscription === true)
  const ready = firstSubscription !== null && !loading

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        {ready ? (
          <>
            <PlanCard quote={quotes.mensal} featured />
            <PlanCard quote={quotes.anual} />
          </>
        ) : (
          <>
            <PlanSkeleton />
            <PlanSkeleton />
          </>
        )}
      </div>

      <ul className="mt-4 flex flex-col gap-1.5">
        {PRO_BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-sm text-pretty text-ink-muted">
            <Icon name="check" className="mt-0.5 size-4 shrink-0 text-brand-hi" />
            {benefit}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-faint">Sem fidelidade: cancela quando quiser, em Configurações.</p>
    </div>
  )
}

const CYCLE_NAME: Readonly<Record<BillingCycle, string>> = { mensal: 'Mensal', anual: 'Anual' }

interface PriceLines {
  readonly amount: string
  readonly period: string
  readonly strike: string | null
  readonly note: string
}

function priceLines(quote: ProQuote): PriceLines {
  const renewal = formatBRL(quote.renewalCents)
  if (quote.cycle === 'mensal') {
    return quote.offer === 'primeiro_mes'
      ? { amount: formatBRL(quote.firstCents), period: 'no 1º mês', strike: null, note: `Depois, ${renewal}/mês.` }
      : { amount: renewal, period: '/mês', strike: null, note: 'Mês a mês.' }
  }
  return quote.offer === 'fundadores'
    ? {
        amount: formatBRL(quote.firstCents),
        period: 'no 1º ano',
        strike: renewal,
        note: `Oferta Fundadores. Depois, ${renewal}/ano.`,
      }
    : {
        amount: renewal,
        period: '/ano',
        strike: null,
        note: `Equivale a ${formatBRL(monthlyEquivalentCents('anual', quote.firstCents))}/mês.`,
      }
}

function PlanCard({ quote, featured = false }: { readonly quote: ProQuote; readonly featured?: boolean }) {
  const price = priceLines(quote)

  return (
    <article
      aria-labelledby={`plano-${quote.cycle}`}
      className={cn(
        'flex flex-col rounded-2xl border p-3.5',
        featured ? 'border-brand bg-brand-dim/40 shadow-lg shadow-brand/20' : 'border-line bg-surface',
      )}
    >
      <p
        className={cn(
          'self-start rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
          featured ? 'bg-brand text-white' : 'bg-positive/15 text-positive',
        )}
      >
        {featured ? 'Recomendado' : 'Mais econômico'}
      </p>
      <h3 id={`plano-${quote.cycle}`} className="mt-2 text-sm font-semibold text-ink">
        PRO {CYCLE_NAME[quote.cycle]}
      </h3>

      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1">
        {price.strike ? (
          <>
            <s className="text-xs text-ink-faint tabular-nums">{price.strike}</s>
            <span className="sr-only">, agora </span>
          </>
        ) : null}
        <span className="text-xl font-semibold text-ink tabular-nums">{price.amount}</span>
        <span className="text-xs text-ink-muted">{price.period}</span>
      </p>
      <p className="mt-1 flex-1 text-[11px] text-pretty text-ink-muted">{price.note}</p>

      <Link
        to={`${SUBSCRIPTION_PATH}?ciclo=${quote.cycle}`}
        className={buttonClass({
          size: 'sm',
          variant: featured ? 'primary' : 'secondary',
          className: 'mt-3 w-full',
        })}
      >
        Assinar {CYCLE_NAME[quote.cycle].toLowerCase()}
      </Link>
    </article>
  )
}

function PlanSkeleton() {
  return <div aria-hidden="true" className="h-44 animate-pulse rounded-2xl border border-line bg-surface/60" />
}

/**
 * Nunca ter assinado é o que dá direito ao preço de entrada. Null enquanto a
 * conta não respondeu. Se a consulta falhar, os cards mostram o preço cheio:
 * prometer a oferta sem saber se ela vale é pior que mostrar o preço maior,
 * e a tela de assinatura confere de novo antes de cobrar.
 */
function useIsFirstSubscription(): boolean | null {
  const [first, setFirst] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    container.billing.mySubscription().then(
      (subscription) => {
        if (alive) setFirst(subscription === null)
      },
      () => {
        if (alive) setFirst(false)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  return first
}
