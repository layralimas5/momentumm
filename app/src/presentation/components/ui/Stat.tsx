import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

interface StatProps {
  readonly label: string
  readonly value: string
  readonly hint?: string
  /** Cor do traço lateral. Usada pra amarrar o número ao eixo correspondente. */
  readonly accent?: string
}

/** Número seco em cartão. É o bloco que ocupa a largura extra no desktop. */
export function Stat({ label, value, hint, accent }: StatProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface px-4 py-3',
        accent && 'border-l-2',
      )}
      style={accent ? { borderLeftColor: accent } : undefined}
    >
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="tabular mt-0.5 text-xl font-semibold text-ink sm:text-2xl">{value}</dd>
      {hint ? <p className="mt-0.5 truncate text-xs text-ink-faint">{hint}</p> : null}
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">{children}</dl>
}
