import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon, type IconName } from './Icon'

/**
 * Blocos do dashboard. Todo card da tela nasce daqui pra profundidade,
 * espaçamento e hierarquia de título serem os mesmos em toda parte — é o que
 * evita o efeito colcha de retalhos quando a tela tem dez seções.
 */

type Tone = 'plain' | 'raised' | 'brand'

const TONES: Record<Tone, string> = {
  plain: 'surface-card',
  raised: 'surface-card-hi',
  brand: 'surface-brand edge-light',
}

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  readonly tone?: Tone
  readonly glow?: boolean
  /** Sem o padding padrão: pra conteúdo que encosta na borda (capa, imagem). */
  readonly flush?: boolean
  readonly children: ReactNode
}

export function Panel({ tone = 'plain', glow = false, flush = false, className, children, ...rest }: PanelProps) {
  return (
    <section {...rest} className={cn(TONES[tone], glow && 'surface-brand-glow', flush ? 'overflow-hidden' : 'p-5', className)}>
      {children}
    </section>
  )
}

interface PanelHeaderProps {
  readonly title: string
  readonly id?: string
  readonly icon?: IconName
  readonly hint?: string
  /** Ação secundária à direita do título (link "ver todos", botão discreto). */
  readonly action?: ReactNode
}

export function PanelHeader({ title, id, icon, hint, action }: PanelHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2
          id={id}
          className="flex items-center gap-2 text-sm font-semibold tracking-wide text-ink-muted uppercase"
        >
          {icon ? <Icon name={icon} className="size-4 text-ink-faint" /> : null}
          <span className="truncate">{title}</span>
        </h2>
        {hint ? <p className="mt-1 text-sm text-ink-faint">{hint}</p> : null}
      </div>
      {action ? <div className="min-w-0 max-w-full shrink-0">{action}</div> : null}
    </div>
  )
}

/** Etiqueta curta. Usada pra eixo, esforço, ritmo e estado. */
export function Tag({
  children,
  color,
  tone = 'neutral',
  className,
}: {
  readonly children: ReactNode
  readonly color?: string
  readonly tone?: 'neutral' | 'brand' | 'positive' | 'warn'
  readonly className?: string
}) {
  const tones = {
    neutral: 'border-line text-ink-muted',
    brand: 'border-brand/40 bg-brand-dim/40 text-brand-ink',
    positive: 'border-positive/30 bg-positive/10 text-positive',
    warn: 'border-flame/30 bg-flame-dim/50 text-flame',
  } as const

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {color ? (
        <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      ) : null}
      {children}
    </span>
  )
}

interface ProgressBarProps {
  /** 0 a 1. */
  readonly value: number
  readonly label: string
  readonly color?: string
  readonly className?: string
}

export function ProgressBar({ value, label, color, className }: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
      className={cn('h-1.5 overflow-hidden rounded-full bg-surface-top', className)}
    >
      <span
        className="block h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%`, backgroundColor: color ?? 'var(--color-brand)' }}
      />
    </div>
  )
}

/** Botão de ícone. Alvo de toque de 40px mesmo com o desenho pequeno. */
export function IconButton({
  icon,
  label,
  onClick,
  className,
  disabled,
}: {
  readonly icon: IconName
  readonly label: string
  readonly onClick: () => void
  readonly className?: string
  readonly disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'grid size-10 place-items-center rounded-lg text-ink-faint transition-colors',
        'hover:bg-surface-hi hover:text-ink active:bg-surface-top',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        className,
      )}
    >
      <Icon name={icon} />
      <span className="sr-only">{label}</span>
    </button>
  )
}
