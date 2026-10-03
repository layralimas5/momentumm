import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

export type TagTone = 'brand' | 'neutral' | 'solid' | 'positive' | 'flame'

const TAG_TONES: Readonly<Record<TagTone, string>> = {
  brand: 'bg-brand-dim text-brand-ink',
  neutral: 'well text-ink-muted',
  solid: 'bg-brand text-white',
  positive: 'bg-positive/12 text-positive-ink',
  flame: 'bg-flame-dim text-flame',
}

/** Etiqueta curta de estado: "Concluído", "AGORA", "AI Ativa", "TOP 5%". */
export function StatusTag({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  readonly children: ReactNode
  readonly tone?: TagTone
  readonly icon?: IconName
  readonly className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[0.72rem] leading-none font-semibold whitespace-nowrap',
        TAG_TONES[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} className="size-3.5" strokeWidth={2} /> : null}
      {children}
    </span>
  )
}

export function formatXp(value: number): string {
  return value.toLocaleString('pt-BR')
}

/** "+5 XP" na linha, ou o total na pílula do topo. */
export function XPBadge({
  amount,
  total = false,
  className,
}: {
  readonly amount: number
  readonly total?: boolean
  readonly className?: string
}) {
  if (total) {
    return (
      <span
        className={cn(
          'chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink tabular',
          className,
        )}
      >
        <Icon name="estrela" className="size-4 text-brand-hi" strokeWidth={2} />
        {formatXp(amount)} XP
      </span>
    )
  }

  return (
    <span className={cn('text-xs font-semibold text-brand-hi tabular', className)}>
      +{formatXp(amount)} XP
    </span>
  )
}

/** A sequência no formato do topo: chama + "14D". */
export function StreakBadge({
  days,
  atRisk = false,
  className,
  size = 'md',
}: {
  readonly days: number
  readonly atRisk?: boolean
  readonly className?: string
  readonly size?: 'sm' | 'md'
}) {
  return (
    <span
      className={cn(
        'well inline-flex items-center gap-1 rounded-full font-bold text-ink tabular',
        size === 'sm' ? 'px-1.5 py-0.5 text-[0.62rem]' : 'px-3 py-1.5 text-xs',
        className,
      )}
    >
      <Icon
        name="fogo"
        className={cn(size === 'sm' ? 'size-3' : 'size-3.5', atRisk ? 'text-ink-faint' : 'text-brand-hi')}
        strokeWidth={2}
      />
      {days}D
      <span className="sr-only">
        {` de sequência${atRisk ? ', depende de um registro ainda hoje' : ''}`}
      </span>
    </span>
  )
}
