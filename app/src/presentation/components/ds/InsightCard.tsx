import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { StatusTag } from './Badges'
import { SoftButton } from './Controls'

/**
 * A IA aparecendo como leitura, não como chat: um rótulo, uma frase e, quando
 * existe, um botão que aplica o ajuste.
 */
export function InsightCard({
  label,
  tag,
  icon = 'lampada',
  message,
  detail,
  actionLabel,
  actionIcon = 'relogio',
  onAction,
  onDismiss,
  className,
}: {
  readonly label: string
  readonly tag?: string
  readonly icon?: IconName
  readonly message: ReactNode
  readonly detail?: string | null
  readonly actionLabel?: string
  readonly actionIcon?: IconName
  readonly onAction?: () => void
  readonly onDismiss?: () => void
  readonly className?: string
}) {
  return (
    <section className={cn('card relative p-4', className)}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 text-brand-hi">
          <Icon name={icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <h3 className="eyebrow text-[0.75rem] text-ink">{label}</h3>
            {tag ? <StatusTag tone="brand">{tag}</StatusTag> : null}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-pretty text-ink-muted">{message}</p>
          {detail ? <p className="mt-1.5 text-xs text-ink-faint">{detail}</p> : null}
        </div>
      </div>

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-ink-faint transition-colors hover:text-ink"
        >
          <Icon name="fechar" className="size-4" />
          <span className="sr-only">Dispensar</span>
        </button>
      ) : null}

      {actionLabel && onAction ? (
        <SoftButton onClick={onAction} className="mt-4">
          <Icon name={actionIcon} className="size-4" />
          {actionLabel}
        </SoftButton>
      ) : null}
    </section>
  )
}
