import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

type CardProps<T extends ElementType> = {
  readonly as?: T
  /** `float` é o degrau acima: prioridade, sheet, o card que pede ação. */
  readonly tone?: 'flat' | 'float'
  readonly className?: string
  readonly children: ReactNode
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>

export function Card<T extends ElementType = 'section'>({
  as,
  tone = 'flat',
  className,
  children,
  ...rest
}: CardProps<T>) {
  const Tag = as ?? 'section'
  return (
    <Tag className={cn(tone === 'float' ? 'card-float' : 'card', 'p-5 sm:p-6', className)} {...rest}>
      {children}
    </Tag>
  )
}

/** Rótulo pequeno em caixa alta. Identidade, não decoração: usar com parcimônia. */
export function Eyebrow({
  children,
  dot = false,
  icon,
  tone = 'brand',
  className,
}: {
  readonly children: ReactNode
  readonly dot?: boolean
  readonly icon?: IconName
  readonly tone?: 'brand' | 'muted'
  readonly className?: string
}) {
  return (
    <p
      className={cn(
        'eyebrow flex items-center gap-1.5',
        tone === 'brand' ? 'text-brand-hi' : 'text-ink-faint',
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {icon ? <Icon name={icon} className="size-3.5" strokeWidth={2} /> : null}
      {children}
    </p>
  )
}

/** Título de seção fora de card: "Hoje", "Seu Dia", "Momentumm Percebeu". */
export function SectionHeader({
  title,
  icon,
  aside,
  id,
  caps = false,
}: {
  readonly title: string
  readonly icon?: IconName
  readonly aside?: ReactNode
  readonly id?: string
  readonly caps?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <h2
        id={id}
        className={cn(
          'flex min-w-0 items-center gap-2 text-ink',
          caps ? 'eyebrow text-[0.78rem] tracking-[0.12em]' : 'text-lg font-semibold tracking-tight sm:text-xl',
        )}
      >
        {icon ? <Icon name={icon} className="size-5 text-brand-hi" /> : null}
        <span className="truncate">{title}</span>
      </h2>
      {aside ? <div className="shrink-0 text-xs text-ink-faint sm:text-sm">{aside}</div> : null}
    </div>
  )
}

/** O ícone dentro de um disco afundado, à esquerda de um título de card. */
export function IconWell({
  name,
  className,
  tone = 'brand',
}: {
  readonly name: IconName
  readonly className?: string
  readonly tone?: 'brand' | 'muted'
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'well grid size-10 shrink-0 place-items-center rounded-full',
        tone === 'brand' ? 'text-brand-hi' : 'text-ink-muted',
        className,
      )}
    >
      <Icon name={name} className="size-[1.15rem]" />
    </span>
  )
}
