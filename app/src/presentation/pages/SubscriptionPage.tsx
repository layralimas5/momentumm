import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { formatBRL, isBillingCycle, monthlyEquivalentCents, PRO_PRICES, type BillingCycle } from '@/domain/billing/billing-plans'
import { grantsPro, isWindingDown, SUBSCRIPTION_STATUS_LABELS, type Subscription } from '@/domain/billing/subscription'
import { isPro } from '@/domain/entities/plan'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { CycleToggle } from '@/presentation/components/landing/CycleToggle'
import { Button, buttonClass } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { PRO_BENEFITS, PRO_TAGLINE } from '@/presentation/plan/pro-benefits'
import { CancellationBlock } from '@/presentation/profile/CancellationBlock'
import { toUserMessage } from '@/shared/errors'
import { cn } from '@/shared/lib/cn'
import { PageHeader } from './PageHeader'

/**
 * A assinatura do PRO.
 *
 * Sem PRO: escolhe o ciclo e vai pro checkout do Asaas. Com PRO: vê o que
 * está pago, até quando, e cancela. A página é a mesma pra onde o Asaas
 * devolve a pessoa depois de pagar (`?assinatura=sucesso`): o pagamento é
 * confirmado pelo webhook, então a tela espera o plano virar em vez de
 * declarar PRO por conta própria.
 */

type ReturnStatus = 'sucesso' | 'cancelado' | 'expirado'

/** Quanto tempo a tela espera o webhook depois do retorno do checkout. */
const CONFIRMATION_POLL_MS = 3000
const CONFIRMATION_MAX_POLLS = 20

function readReturnStatus(value: string | null): ReturnStatus | null {
  return value === 'sucesso' || value === 'cancelado' || value === 'expirado' ? value : null
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function SubscriptionPage() {
  const { profile, refreshProfile } = useAuth()
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

  const hasPro = profile ? isPro(profile.plan) : false
  const confirming = returned === 'sucesso' && !hasPro
  const confirmed = useConfirmationPolling(confirming, async () => {
    await refreshProfile()
    await load()
  })

  const checkout = useAsyncAction(async () => {
    const { url } = await container.billing.startCheckout(cycle, '/app/assinatura')
    window.location.assign(url)
  })

  if (!profile || subscription === 'loading') return <LoadingBlock label="Carregando tua assinatura" />

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PageHeader
        title="Assinatura"
        description={hasPro ? 'O teu PRO: o que está pago, até quando, e como mudar.' : PRO_TAGLINE}
      />

      {returned === 'sucesso' ? (
        <ReturnNote
          tone={hasPro ? 'positive' : confirmed === 'timeout' ? 'warn' : 'neutral'}
          message={
            hasPro
              ? 'Pagamento confirmado. O PRO está liberado.'
              : confirmed === 'timeout'
                ? 'O pagamento ainda não chegou até aqui. Pix pode levar alguns minutos; se você pagou, recarrega a página daqui a pouco.'
                : 'Estamos confirmando o pagamento com o Asaas. Isso leva alguns segundos.'
          }
          busy={confirming && confirmed !== 'timeout'}
        />
      ) : null}
      {returned === 'cancelado' ? (
        <ReturnNote tone="neutral" message="Você saiu do checkout sem pagar. Nada foi cobrado." />
      ) : null}
      {returned === 'expirado' ? (
        <ReturnNote tone="neutral" message="O checkout expirou. Abre outro quando quiser: nada foi cobrado." />
      ) : null}

      {loadError ? <ErrorNote message={loadError} /> : null}

      {!container.billing.available ? (
        <Offer cycle={cycle} onCycleChange={setCycle} demo />
      ) : hasPro && subscription && grantsPro(subscription) ? (
        <CurrentSubscription subscription={subscription} onChanged={() => void load()} />
      ) : hasPro ? (
        <Panel className="text-sm text-ink-muted">
          Tua conta é PRO, mas não há assinatura registrada por aqui: o acesso foi concedido pela equipe.
        </Panel>
      ) : (
        <Offer
          cycle={cycle}
          onCycleChange={setCycle}
          onSubscribe={() => void checkout.run()}
          loading={checkout.running}
          error={checkout.error}
        />
      )}
    </div>
  )
}

/**
 * A oferta. No modo demo ela é a mesma, com o botão trocado: quem entrou
 * pela porta "ver por dentro" precisa de conta pra assinar, e o PRO dá pra
 * experimentar em Configurações sem pagar.
 */
function Offer({
  cycle,
  onCycleChange,
  onSubscribe,
  loading = false,
  error = null,
  demo = false,
}: {
  readonly cycle: BillingCycle
  readonly onCycleChange: (cycle: BillingCycle) => void
  readonly onSubscribe?: () => void
  readonly loading?: boolean
  readonly error?: string | null
  readonly demo?: boolean
}) {
  const price = PRO_PRICES[cycle]
  const perMonth = monthlyEquivalentCents(cycle)

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Panel tone="brand" glow className="flex flex-col gap-5">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 text-xs font-medium tracking-wide text-white uppercase">
            <Icon name="raio" className="size-3.5" />
            PRO
          </p>
          <CycleToggle value={cycle} onChange={onCycleChange} />
        </div>

        <div aria-live="polite">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="tabular text-4xl font-semibold text-ink">{formatBRL(price.amountCents)}</span>
            <span className="text-sm text-ink-muted">{cycle === 'anual' ? '/ano' : '/mês'}</span>
            <span className="sr-only">, de</span>
            <s className="tabular ml-1 text-sm text-ink-faint">{formatBRL(price.strikeCents)}</s>
          </p>
          <p className="tabular mt-1 text-sm text-ink-muted">
            {cycle === 'anual'
              ? `Equivale a ${formatBRL(perMonth)} por mês, cobrado uma vez por ano.`
              : 'Cobrado todo mês. Cancela quando quiser.'}
          </p>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {PRO_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex gap-2 text-sm text-ink-muted">
              <Icon name="check" className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.5} />
              {benefit}
            </li>
          ))}
        </ul>

        {error ? <ErrorNote message={error} /> : null}

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
        ) : (
          <Button size="lg" loading={loading} onClick={onSubscribe} className="w-full sm:w-fit">
            <Icon name="raio" className="size-4" />
            Assinar o PRO {cycle}
          </Button>
        )}

        <p className="text-xs text-ink-faint">
          Pagamento por cartão ou Pix, na página segura do Asaas. O cartão fica lá, nunca aqui. Sem fidelidade:
          cancelar mantém o PRO até o fim do período pago.
        </p>
      </Panel>

      <Panel className="flex flex-col gap-3 text-sm text-ink-muted">
        <p className="text-sm font-semibold text-ink">Como funciona</p>
        <ol className="flex list-decimal flex-col gap-2 pl-4">
          <li>Você escolhe o ciclo e vai pro checkout do Asaas.</li>
          <li>Paga com cartão ou Pix. O Asaas pede CPF e endereço, como qualquer loja.</li>
          <li>Volta pra cá. Assim que o pagamento é confirmado, o PRO abre sozinho.</li>
        </ol>
        <Link to="/#pro" className="mt-auto text-sm font-medium text-brand-hi underline-offset-2 hover:underline">
          Ver a comparação completa dos planos
        </Link>
      </Panel>
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
            <dt className="text-ink-faint">Valor</dt>
            <dd className="tabular text-ink">
              {formatBRL(subscription.amountCents)} por {subscription.interval === 'anual' ? 'ano' : 'mês'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">{windingDown ? 'PRO até' : 'Próxima renovação'}</dt>
            <dd className="text-ink">{periodEnd ? formatDate(periodEnd) : 'a confirmar'}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Assinante desde</dt>
            <dd className="text-ink">{formatDate(subscription.startedAt)}</dd>
          </div>
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
          A cobrança é feita pelo Asaas, no cartão ou Pix que você escolheu no checkout. Recibos e segunda via
          chegam no teu e-mail.
        </p>
        <p>Pra trocar de cartão ou de ciclo, cancela a assinatura atual e assina de novo quando ela terminar.</p>
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
 * Depois do checkout, o PRO só abre quando o webhook grava a assinatura.
 * Esta espera relê o perfil a cada poucos segundos até o plano virar ou
 * o tempo acabar — nunca declara PRO por conta própria.
 */
function useConfirmationPolling(active: boolean, refresh: () => Promise<void>): 'waiting' | 'timeout' | 'idle' {
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
      if (polls >= CONFIRMATION_MAX_POLLS) setState('timeout')
      else timer = window.setTimeout(() => void tick(), CONFIRMATION_POLL_MS)
    }
    let timer = window.setTimeout(() => void tick(), CONFIRMATION_POLL_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [active])

  return state
}
