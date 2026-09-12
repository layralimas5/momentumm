import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { planMatrix, type PlanMatrixRow } from '@/domain/entities/plan'
import { cn } from '@/shared/lib/cn'
import {
  ANNUAL_EXTRAS,
  PRICING_FOOTNOTE,
  PRICING_PLANS,
  type BillingCycle,
  type PricingPlan,
} from './plans'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'
import { CTA } from './site'

/**
 * Uma tabela só, no lugar de cards mais matriz: o cabeçalho de cada coluna
 * já é o plano com preço e botão, e as linhas dizem recurso a recurso o que
 * muda. As linhas saem do domínio (`planMatrix`), então o que está escrito
 * aqui é o que o app aplica. "Não disponível" vira traço e "Disponível" vira
 * check, porque é assim que o olho compara duas colunas sem ler tudo.
 */
export function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>('anual')
  const rows = planMatrix()

  return (
    <Section id="planos" className="border-t border-line">
      <SectionHeading
        eyebrow="Planos"
        title="O gratuito organiza e executa. O PRO registra, analisa e evolui."
        description="No gratuito você cria objetivo, organiza hábitos, acompanha o dia e vê o Momentum Score de hoje. O PRO libera entender os próprios padrões, registrar a jornada, ver métricas e ajustar o plano com a leitura da IA."
      />

      <div className="mt-10 flex justify-center">
        <CycleToggle value={cycle} onChange={setCycle} />
      </div>

      <Reveal className="mt-8">
        <div className="relative overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">
              Comparação de preço e recursos entre o plano gratuito e o PRO
            </caption>
            <thead>
              <tr className="border-b border-line align-top">
                <th scope="col" className="px-5 py-6 text-left sm:px-6">
                  <p className="text-base font-semibold text-ink">Compare os planos</p>
                  <p className="mt-1 text-sm font-normal text-ink-faint">
                    Encontre o que serve pro teu momento
                  </p>
                </th>
                {PRICING_PLANS.map((plan) => (
                  <th
                    key={plan.id}
                    scope="col"
                    className={cn(
                      'w-[28%] px-5 py-6 text-left sm:px-6',
                      plan.highlight && 'bg-brand-dim/25',
                    )}
                  >
                    <PlanHeader plan={plan} cycle={cycle} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <FeatureRow key={row.feature} row={row} />
              ))}
              {cycle === 'anual' ? (
                <>
                  <tr className="border-t border-line">
                    <th
                      scope="rowgroup"
                      colSpan={3}
                      className="px-5 pb-2 pt-5 text-left text-xs font-medium uppercase tracking-wide text-brand-hi sm:px-6"
                    >
                      Só no PRO anual
                    </th>
                  </tr>
                  {ANNUAL_EXTRAS.map((feature) => (
                    <FeatureRow
                      key={feature}
                      row={{ feature, free: 'Não disponível', pro: 'Disponível' }}
                    />
                  ))}
                </>
              ) : null}
            </tbody>
          </table>
        </div>
      </Reveal>

      <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-ink-faint">
        {PRICING_FOOTNOTE}
      </p>
    </Section>
  )
}

function PlanHeader({ plan, cycle }: { plan: PricingPlan; cycle: BillingCycle }) {
  const price = plan.prices[cycle]

  return (
    <div className="flex h-full flex-col">
      <p className={cn('text-base font-semibold', plan.highlight ? 'text-brand-ink' : 'text-ink')}>
        {plan.badge}
      </p>
      <p className="mt-1 text-xs font-normal text-ink-faint">{plan.headline}</p>

      <div className="mt-4 min-h-[4.75rem]" aria-live="polite">
        <p className="flex flex-wrap items-baseline gap-x-1">
          <span className="tabular text-2xl font-semibold text-ink">{price.amount}</span>
          <span className="text-xs font-normal text-ink-muted">{price.period}</span>
          {price.strike ? (
            <>
              <span className="sr-only">, de</span>
              <s className="tabular ml-1 text-xs font-normal text-ink-faint decoration-danger/70">
                {price.strike}
              </s>
            </>
          ) : null}
        </p>
        {price.note ? (
          <p className="tabular mt-0.5 text-xs font-normal text-ink-muted">{price.note}</p>
        ) : null}
        {price.savings ? (
          <p className="mt-1.5 inline-flex rounded-full bg-positive/15 px-2 py-0.5 text-[11px] font-medium text-positive">
            {price.savings}
          </p>
        ) : null}
      </div>

      <Link
        to={CTA.primary.to}
        className={cn(
          'mt-4 inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors',
          plan.highlight
            ? 'bg-brand text-white hover:bg-brand-hi'
            : 'border border-line-hi text-ink hover:bg-surface-hi',
        )}
      >
        {plan.cta}
      </Link>
    </div>
  )
}

function FeatureRow({ row }: { readonly row: PlanMatrixRow }) {
  return (
    <tr className="border-t border-line">
      <th scope="row" className="px-5 py-3.5 text-left font-normal text-ink sm:px-6">
        {row.feature}
      </th>
      <td className="px-5 py-3.5 text-ink-muted sm:px-6">
        <CellValue value={row.free} />
      </td>
      <td className="bg-brand-dim/25 px-5 py-3.5 text-ink sm:px-6">
        <CellValue value={row.pro} highlight />
      </td>
    </tr>
  )
}

/** Traço pra "não tem", check pra "tem", texto quando o valor é um número ou um limite. */
function CellValue({ value, highlight = false }: { value: string; highlight?: boolean }) {
  if (value === 'Não disponível') {
    return (
      <span className="text-ink-faint">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Não disponível</span>
      </span>
    )
  }

  if (value.startsWith('Disponível')) {
    const detail = value.slice('Disponível'.length).trim()
    return (
      <span className="inline-flex items-center gap-2">
        <CheckIcon highlight={highlight} />
        <span className="sr-only">Disponível</span>
        {detail ? <span className="text-ink-muted">{detail}</span> : null}
      </span>
    )
  }

  return <>{value}</>
}

/**
 * Botões de verdade com `aria-pressed`, não um switch: as duas opções têm
 * nome e o leitor de tela lê "Anual, pressionado" em vez de "ligado".
 */
function CycleToggle({
  value,
  onChange,
}: {
  value: BillingCycle
  onChange: (cycle: BillingCycle) => void
}) {
  const id = useId()
  const options: readonly {
    readonly cycle: BillingCycle
    readonly label: string
    readonly hint?: string
  }[] = [
    { cycle: 'mensal', label: 'Mensal' },
    { cycle: 'anual', label: 'Anual', hint: 'metade do preço' },
  ]

  return (
    <div
      role="group"
      aria-labelledby={id}
      className="inline-flex rounded-full border border-line bg-surface p-1"
    >
      <span id={id} className="sr-only">
        Ciclo de cobrança do PRO
      </span>
      {options.map((option) => {
        const active = option.cycle === value
        return (
          <button
            key={option.cycle}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.cycle)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors',
              active ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
            {option.hint ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                  active ? 'bg-white/15 text-white' : 'bg-positive/15 text-positive',
                )}
              >
                {option.hint}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function CheckIcon({ highlight = false }: { highlight?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-full',
        highlight ? 'bg-brand text-white' : 'bg-positive/20 text-positive',
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 13 4 4L19 7" />
      </svg>
    </span>
  )
}
