import { useCallback, useEffect, useRef, useState } from 'react'
import { trackFunnelIfLinked } from '@/infrastructure/analytics/funnel'
import { Link, useSearchParams } from 'react-router-dom'
import {
  cyclePeriod,
  formatBRL,
  isBillingCycle,
  monthlyEquivalentCents,
  quoteSentence,
  type BillingCycle,
  type ProOffer,
  type ProQuote,
} from '@/domain/billing/billing-plans'
import type { PixCharge, PixCustomer } from '@/domain/billing/billing-service'
import {
  isWindingDown,
  SUBSCRIPTION_STATUS_LABELS,
  subscriptionBilling,
  type Subscription,
} from '@/domain/billing/subscription'
import { planAccessOf, trialDaysLeft, type PlanTrial } from '@/domain/billing/trial'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { useProQuotes } from '@/presentation/billing/use-pro-quotes'
import { CycleToggle } from '@/presentation/components/landing/CycleToggle'
import { Button, buttonClass } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { PixChargePanel } from '@/presentation/plan/PixChargePanel'
import { PixCustomerForm } from '@/presentation/plan/PixCustomerForm'
import { formatTrialEnd } from '@/presentation/plan/TrialBanner'
import { PRO_BENEFITS, PRO_TAGLINE } from '@/presentation/plan/pro-benefits'
import { CancellationBlock } from '@/presentation/profile/CancellationBlock'
import { toUserMessage } from '@/shared/errors'
import { cn } from '@/shared/lib/cn'
import { PageHeader } from './PageHeader'

/**
 * A assinatura do PRO.
 *
 * Sem PRO: escolhe o ciclo e paga. No cartão, vai pro checkout do Asaas e
 * volta por `?assinatura=sucesso`; no Pix, informa nome e CPF e paga o QR
 * aqui mesmo. Nos dois o pagamento é confirmado pelo webhook, então a tela
 * espera o plano virar em vez de declarar PRO por conta própria. Com PRO:
 * vê o que está pago, até quando, e cancela.
 */

type ReturnStatus = 'sucesso' | 'cancelado' | 'expirado'

type PaymentMethod = 'cartao' | 'pix'

/** Quanto tempo a tela espera o webhook. O cartão confirma na volta; o Pix depende do banco da pessoa. */
const CONFIRMATION_POLL_MS = 3000
const CARD_MAX_POLLS = 20
const PIX_MAX_POLLS = 100

function readReturnStatus(value: string | null): ReturnStatus | null {
  return value === 'sucesso' || value === 'cancelado' || value === 'expirado' ? value : null
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function SubscriptionPage() {
  const { profile, trial, refreshProfile } = useAuth()
  const [params] = useSearchParams()
  const returned = readReturnStatus(params.get('assinatura'))
  const requestedCycle = params.get('ciclo')

  const [cycle, setCycle] = useState<BillingCycle>(isBillingCycle(requestedCycle) ? requestedCycle : 'anual')
  const [subscription, setSubscription] = useState<Subscription | null | 'loading'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setSubscription(await container.billing.mySubscription())
      setLoadError(null)
    } catch (error) {
      setLoadError(toUserMessage(error))
      setSubscription(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Sem nenhuma assinatura, nem cancelada: é a primeira, e o mensal entra pela oferta.
  const { quotes } = useProQuotes(subscription === null)

  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null)

  /*
    "Pago" é a assinatura que o webhook gravou, nunca `profile.plan` sozinho:
    no teste de 7 dias o plano já é PRO, e a tela ainda precisa esperar o
    Asaas confirmar antes de dizer que o pagamento entrou.
  */
  const access = profile
    ? planAccessOf(
        profile.plan,
        subscription === 'loading' ? null : subscription,
        trial,
        profile.planCourtesyUntil,
      )
    : 'free'
  const hasPaidPro = access === 'paid'
  const refresh = useCallback(async () => {
    await refreshProfile()
    await load()
  }, [refreshProfile, load])
  const confirming = returned === 'sucesso' && !hasPaidPro
  const confirmed = useConfirmationPolling(confirming, CARD_MAX_POLLS, refresh)
  const pixConfirmed = useConfirmationPolling(pixCharge !== null && !hasPaidPro, PIX_MAX_POLLS, refresh)

  /*
    O pagamento entrou nesta visita (voltou do checkout ou pagou o Pix aqui):
    é o fim do funil do quiz, pra quem veio por ele. Uma vez por tela.
  */
  const paidHere = hasPaidPro && (returned === 'sucesso' || pixCharge !== null)
  const subscriptionTracked = useRef(false)
  useEffect(() => {
    if (!paidHere || subscriptionTracked.current) return
    subscriptionTracked.current = true
    trackFunnelIfLinked('subscription_completed')
  }, [paidHere])

  const checkout = useAsyncAction(async () => {
    const { url } = await container.billing.startCheckout(cycle, '/app/assinatura')
    window.location.assign(url)
  })
  const pix = useAsyncAction(async (customer: PixCustomer) => {
    setPixCharge(await container.billing.startPix(cycle, customer))
  })

  if (!profile || subscription === 'loading') return <LoadingBlock label="Carregando tua assinatura" />

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PageHeader
        title="Assinatura"
        description={
          hasPaidPro
            ? 'O teu PRO: o que está pago, até quando, e como mudar.'
            : access === 'trial'
              ? 'Você está no teste do PRO. Assinar agora garante que nada para no fim dele.'
              : PRO_TAGLINE
        }
      />

      {returned === 'sucesso' ? (
        <ReturnNote
          tone={hasPaidPro ? 'positive' : confirmed === 'timeout' ? 'warn' : 'neutral'}
          message={
            hasPaidPro
              ? 'Pagamento confirmado. O PRO está liberado.'
              : confirmed === 'timeout'
                ? 'O pagamento ainda não chegou até aqui. A confirmação do cartão pode levar alguns minutos; se você pagou, recarrega a página daqui a pouco.'
                : 'Estamos confirmando o pagamento com o Asaas. Isso leva alguns segundos.'
          }
          busy={confirming && confirmed !== 'timeout'}
        />
      ) : null}
      {pixCharge && hasPaidPro ? <ReturnNote tone="positive" message="Pix confirmado. O PRO está liberado." /> : null}
      {returned === 'cancelado' ? (
        <ReturnNote tone="neutral" message="Você saiu do checkout sem pagar. Nada foi cobrado." />
      ) : null}
      {returned === 'expirado' ? (
        <ReturnNote tone="neutral" message="O checkout expirou. Abre outro quando quiser: nada foi cobrado." />
      ) : null}

      {loadError ? <ErrorNote message={loadError} /> : null}

      {access === 'trial' && trial ? <TrialNote trial={trial} /> : null}
      {access === 'free' && trial?.status === 'encerrado' ? (
        <ReturnNote
          tone="neutral"
          message={`Teu teste do PRO terminou em ${formatTrialEnd(trial.endsAt)}. Tudo que você criou continua guardado; assinar libera de novo.`}
        />
      ) : null}

      {!container.billing.available ? (
        <Offer quote={quotes[cycle]} foundersActive={quotes.anual.offer === 'fundadores'} onCycleChange={setCycle} demo />
      ) : hasPaidPro && subscription ? (
        <CurrentSubscription subscription={subscription} onChanged={() => void load()} />
      ) : access === 'courtesy' ? (
        <Panel className="text-sm text-ink-muted">
          Tua conta é PRO, mas não há assinatura registrada por aqui: o acesso foi concedido pela equipe.
        </Panel>
      ) : (
        <Offer
          quote={quotes[cycle]}
          foundersActive={quotes.anual.offer === 'fundadores'}
          onCycleChange={setCycle}
          method={method}
          onMethodChange={setMethod}
          onCardCheckout={() => void checkout.run()}
          onPix={(customer) => void pix.run(customer)}
          pixCharge={pixCharge}
          pixState={pixConfirmed === 'timeout' ? 'timeout' : 'waiting'}
          customerName={profile.name}
          loading={checkout.running || pix.running}
          error={checkout.error ?? pix.error}
        />
      )}
    </div>
  )
}

/**
 * O teste em andamento, como painel: até quando, o que acontece depois, e
 * que assinar agora não cobra nada duas vezes. A oferta vem logo abaixo.
 */
function TrialNote({ trial }: { readonly trial: PlanTrial }) {
  const days = trialDaysLeft(trial)
  return (
    <Panel tone="brand" className="flex flex-col gap-2">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-brand-hi uppercase">
        <Icon name="raio" className="size-3.5" />
        PRO de teste
      </p>
      <p className="text-base font-semibold text-ink">
        Vale até {formatTrialEnd(trial.endsAt)}
        {days > 0 ? ` (${days === 1 ? 'último dia' : `faltam ${days} dias`})` : ''}.
      </p>
      <p className="text-sm text-ink-muted">
        Sem cartão e sem cobrança automática. No fim do prazo a conta volta pro gratuito: objetivos,
        hábitos, ações e histórico ficam guardados, e o que passar do limite do gratuito volta
        inteiro quando você assinar. Assinando agora, o PRO segue pela assinatura, sem interrupção.
      </p>
    </Panel>
  )
}

/**
 * A oferta. No modo demo ela é a mesma, com o botão trocado: quem entrou
 * pela porta "ver por dentro" precisa de conta pra assinar, e o PRO dá pra
 * experimentar em Configurações sem pagar.
 *
 * O rodapé do painel muda com o passo: escolha do método, formulário do
 * Pix, QR pra pagar. O ciclo trava assim que o QR existe, porque a cobrança
 * já nasceu com aquele valor.
 */
function Offer({
  quote,
  foundersActive,
  onCycleChange,
  method = null,
  onMethodChange,
  onCardCheckout,
  onPix,
  pixCharge = null,
  pixState = 'waiting',
  customerName = '',
  loading = false,
  error = null,
  demo = false,
}: {
  readonly quote: ProQuote
  /** O anual desta pessoa está na campanha Fundadores. */
  readonly foundersActive: boolean
  readonly onCycleChange: (cycle: BillingCycle) => void
  readonly method?: PaymentMethod | null
  readonly onMethodChange?: (method: PaymentMethod | null) => void
  readonly onCardCheckout?: () => void
  readonly onPix?: (customer: PixCustomer) => void
  readonly pixCharge?: PixCharge | null
  readonly pixState?: 'waiting' | 'timeout'
  readonly customerName?: string
  readonly loading?: boolean
  readonly error?: string | null
  readonly demo?: boolean
}) {
  const { cycle } = quote
  const cycleLocked = pixCharge !== null

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Panel tone="brand" glow className="flex flex-col gap-5">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 text-xs font-medium tracking-wide text-white uppercase">
            <Icon name="raio" className="size-3.5" />
            PRO
          </p>
          {cycleLocked ? null : (
            <CycleToggle
              value={cycle}
              onChange={onCycleChange}
              {...(foundersActive ? { annualHint: 'Fundadores' } : {})}
            />
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold text-balance text-ink">Continue avançando com o Momentumm PRO</h2>
          <p className="mt-1 text-sm text-pretty text-ink-muted">
            Transforme suas metas em ações, acompanhe sua evolução e mantenha sua constância.
          </p>
        </div>

        <QuotePrice quote={quote} />

        <ul className="grid gap-2 sm:grid-cols-2">
          {PRO_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex gap-2 text-sm text-ink-muted">
              <Icon name="check" className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.5} />
              {benefit}
            </li>
          ))}
        </ul>

        {error && method !== 'pix' ? <ErrorNote message={error} /> : null}

        {demo ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link to="/entrar" className={buttonClass({ size: 'lg', className: 'w-full sm:w-fit' })}>
              <Icon name="raio" className="size-4" />
              Criar conta pra assinar
            </Link>
            <Link
              to="/app/configuracoes"
              className="text-sm font-medium text-brand-hi underline-offset-2 hover:underline sm:ml-2"
            >
              Ou simular o PRO no demo
            </Link>
          </div>
        ) : pixCharge ? (
          <PixChargePanel charge={pixCharge} amountCents={pixCharge.amountCents ?? quote.firstCents} state={pixState} />
        ) : method === 'pix' ? (
          <PixCustomerForm
            initialName={customerName}
            submitLabel={`Gerar Pix de ${formatBRL(quote.firstCents)}`}
            loading={loading}
            error={error}
            onSubmit={(customer) => onPix?.(customer)}
            onBack={() => onMethodChange?.(null)}
          />
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button size="lg" loading={loading} onClick={onCardCheckout} className="w-full sm:w-fit">
              <Icon name="raio" className="size-4" />
              {cycle === 'anual' ? 'Escolher anual no cartão' : 'Começar com PRO no cartão'}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={loading}
              onClick={() => onMethodChange?.('pix')}
              className="w-full sm:w-fit"
            >
              Pagar com Pix
            </Button>
          </div>
        )}

        <p className="text-sm text-ink">
          <span className="font-medium">Antes de pagar:</span> {quoteSentence(quote)}
        </p>

        <p className="text-xs text-ink-faint">
          {pixCharge
            ? 'A cada ciclo o Asaas manda um novo Pix pro teu e-mail. Sem fidelidade: cancelar mantém o PRO até o fim do período pago.'
            : 'Cartão na página segura do Asaas (o cartão fica lá, nunca aqui) ou Pix aqui mesmo. Sem fidelidade: cancelar mantém o PRO até o fim do período pago.'}
        </p>
      </Panel>

      <Panel className="flex flex-col gap-3 text-sm text-ink-muted">
        <p className="text-sm font-semibold text-ink">Como funciona</p>
        <ol className="flex list-decimal flex-col gap-2 pl-4">
          <li>Você escolhe o ciclo e como pagar.</li>
          <li>
            No cartão, o checkout do Asaas pede CPF e endereço, como qualquer loja, e renova sozinho. No Pix, você
            paga o QR aqui e recebe um novo por e-mail a cada ciclo.
          </li>
          <li>Assim que o pagamento é confirmado, o PRO abre sozinho.</li>
        </ol>
        <Link to="/#pro" className="mt-auto text-sm font-medium text-brand-hi underline-offset-2 hover:underline">
          Ver a comparação completa dos planos
        </Link>
      </Panel>
    </div>
  )
}

const OFFER_LABELS: Readonly<Record<ProOffer, string>> = {
  primeiro_mes: 'primeiro mês promocional',
  fundadores: 'Oferta Fundadores',
}

/**
 * O preço da oferta, com a renovação sempre na mesma vista.
 *
 * O anual é o que a tela quer que a pessoa escolha, e ele diz isso com um
 * selo só. Nada de contador, nada de "últimas vagas".
 */
function QuotePrice({ quote }: { readonly quote: ProQuote }) {
  const period = cyclePeriod(quote.cycle)
  const founders = quote.offer === 'fundadores'
  const intro = quote.offer === 'primeiro_mes'

  return (
    <div aria-live="polite">
      {quote.cycle === 'anual' ? (
        <p className="mb-2 inline-flex rounded-full bg-positive/15 px-2.5 py-1 text-xs font-medium text-positive">
          {founders ? 'Oferta Fundadores' : 'Melhor custo-benefício'}
        </p>
      ) : null}
      <p className="flex flex-wrap items-baseline gap-x-1.5">
        {founders ? (
          <>
            <s className="tabular text-lg text-ink-faint">{formatBRL(quote.renewalCents)}</s>
            <span className="sr-only">, agora </span>
          </>
        ) : null}
        <span className="tabular text-4xl font-semibold text-ink">{formatBRL(quote.firstCents)}</span>
        <span className="text-sm text-ink-muted">
          {founders ? 'no primeiro ano' : intro ? 'no primeiro mês' : `/${period}`}
        </span>
      </p>
      <p className="tabular mt-1 text-sm text-ink-muted">
        {founders
          ? `Depois, ${formatBRL(quote.renewalCents)}/ano, pelo preço anual vigente.`
          : intro
            ? `Depois, ${formatBRL(quote.renewalCents)}/mês. Cancela quando quiser.`
            : quote.cycle === 'anual'
              ? `Equivale a ${formatBRL(monthlyEquivalentCents('anual', quote.firstCents))} por mês, cobrado uma vez por ano.`
              : 'Cobrado todo mês. Cancela quando quiser.'}
      </p>
      {founders ? (
        <p className="mt-2 text-sm text-ink-muted">
          Entre agora e aproveite a condição especial dos primeiros usuários do Momentumm.
        </p>
      ) : null}
    </div>
  )
}

function CurrentSubscription({
  subscription,
  onChanged,
}: {
  readonly subscription: Subscription
  readonly onChanged: () => void
}) {
  const windingDown = isWindingDown(subscription)
  const periodEnd = subscription.currentPeriodEnd
  const billing = subscriptionBilling(subscription)
  const period = cyclePeriod(subscription.interval)
  const offerSpan = subscription.interval === 'anual' ? 'no primeiro ano' : 'no primeiro mês'

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Panel tone="brand" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 text-xs font-medium tracking-wide text-white uppercase">
            <Icon name="raio" className="size-3.5" />
            PRO {subscription.interval}
          </p>
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium',
              windingDown ? 'border-line text-ink-muted' : 'border-positive/40 bg-positive/10 text-positive',
            )}
          >
            {windingDown ? 'Cancelada, ainda ativa' : SUBSCRIPTION_STATUS_LABELS[subscription.status]}
          </span>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-faint">Plano atual</dt>
            <dd className="text-ink">
              PRO {subscription.interval}
              {billing.inOffer && subscription.offer ? `, ${OFFER_LABELS[subscription.offer]}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">Valor atual</dt>
            <dd className="tabular text-ink">
              {formatBRL(billing.currentCents)} {billing.inOffer ? offerSpan : `por ${period}`}
            </dd>
          </div>
          {billing.nextCharge ? (
            <>
              <div>
                <dt className="text-ink-faint">Próxima cobrança</dt>
                <dd className="tabular text-ink">
                  {formatBRL(billing.nextCharge.amountCents)} em {formatDate(billing.nextCharge.at)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-faint">Renovação</dt>
                <dd className="tabular text-ink">
                  {formatBRL(billing.nextCharge.amountCents)} por {period}
                </dd>
              </div>
            </>
          ) : (
            <div>
              <dt className="text-ink-faint">{windingDown ? 'PRO até' : 'Próxima cobrança'}</dt>
              <dd className="text-ink">
                {windingDown && periodEnd ? `${formatDate(periodEnd)}, sem nova cobrança` : 'a confirmar'}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-ink-faint">Assinante desde</dt>
            <dd className="text-ink">{formatDate(subscription.startedAt)}</dd>
          </div>
          {billing.inOffer && billing.nextCharge ? (
            <div className="sm:col-span-2">
              <dt className="sr-only">Sobre a renovação</dt>
              <dd className="text-ink-muted">
                A condição de entrada vale só {offerSpan}. A partir de {formatDate(billing.nextCharge.at)}, o valor
                passa a ser {formatBRL(billing.nextCharge.amountCents)} por {period}.
              </dd>
            </div>
          ) : null}
          {subscription.status === 'inadimplente' ? (
            <div className="sm:col-span-2">
              <dt className="sr-only">Aviso</dt>
              <dd className="text-danger">
                O último pagamento não foi confirmado. Confere a cobrança no e-mail do Asaas: o PRO volta assim que
                ela for paga.
              </dd>
            </div>
          ) : null}
        </dl>

        {windingDown ? (
          <p className="text-sm text-ink-muted">
            A renovação está desligada. Quando o período acabar, a conta volta pro gratuito sem perder nada do que
            você registrou.
          </p>
        ) : (
          <CancellationBlock onCanceled={onChanged} />
        )}
      </Panel>

      <Panel className="flex flex-col gap-3 text-sm text-ink-muted">
        <p className="text-sm font-semibold text-ink">Pagamento</p>
        <p>
          A cobrança é feita pelo Asaas, no cartão ou no Pix que você escolheu ao assinar. Recibos, segunda via e
          o Pix de cada ciclo chegam no teu e-mail.
        </p>
        <p>Pra trocar de forma de pagamento ou de ciclo, cancela a assinatura atual e assina de novo quando ela terminar.</p>
        <Link to="/app/configuracoes" className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), 'mt-auto w-fit')}>
          Configurações da conta
        </Link>
      </Panel>
    </div>
  )
}

function ReturnNote({
  tone,
  message,
  busy = false,
}: {
  readonly tone: 'positive' | 'neutral' | 'warn'
  readonly message: string
  readonly busy?: boolean
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-busy={busy || undefined}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
        tone === 'positive' && 'border-positive/40 bg-positive/10 text-ink',
        tone === 'neutral' && 'border-line bg-surface text-ink',
        tone === 'warn' && 'border-danger/40 bg-danger/10 text-ink',
      )}
    >
      {busy ? (
        <span aria-hidden="true" className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      ) : null}
      {message}
    </p>
  )
}

/**
 * Depois de pagar, o PRO só abre quando o webhook grava a assinatura.
 * Esta espera relê o perfil a cada poucos segundos até o plano virar ou
 * o tempo acabar, nunca declara PRO por conta própria.
 */
function useConfirmationPolling(
  active: boolean,
  maxPolls: number,
  refresh: () => Promise<void>,
): 'waiting' | 'timeout' | 'idle' {
  const [state, setState] = useState<'waiting' | 'timeout' | 'idle'>('idle')
  // `refresh` muda a cada render do pai; a espera é decidida só por `active`.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    if (!active) {
      setState('idle')
      return
    }
    setState('waiting')
    let polls = 0
    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      polls += 1
      await refreshRef.current().catch(() => undefined)
      if (cancelled) return
      if (polls >= maxPolls) setState('timeout')
      else timer = window.setTimeout(() => void tick(), CONFIRMATION_POLL_MS)
    }
    let timer = window.setTimeout(() => void tick(), CONFIRMATION_POLL_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [active, maxPolls])

  return state
}
