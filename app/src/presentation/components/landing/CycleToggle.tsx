import { useId } from 'react'
import { formatBRL, monthlyEquivalentCents } from '@/domain/billing/billing-plans'
import { cn } from '@/shared/lib/cn'
import type { BillingCycle } from './plans'

/**
 * Botões de verdade com `aria-pressed`, não um switch: as duas opções têm
 * nome e o leitor de tela lê "Anual, pressionado" em vez de "ligado".
 */
export function CycleToggle({
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
    { cycle: 'anual', label: 'Anual', hint: `${formatBRL(monthlyEquivalentCents('anual'))}/mês` },
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
                  // Branco sobre o roxo do botão ativo não chega no AA num
                  // texto de 11px: o selo inverte em vez de clarear o fundo.
                  active ? 'bg-white text-brand-deep' : 'bg-positive/15 text-positive',
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
