import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

interface SectionProps {
  readonly id?: string
  readonly children: ReactNode
  readonly className?: string
  readonly bleed?: boolean
}

export function Section({ id, children, className, bleed = false }: SectionProps) {
  return (
    <section id={id} className={cn('scroll-mt-20 py-20 sm:py-28', className)}>
      <div className={cn(bleed ? '' : 'mx-auto max-w-5xl px-4')}>{children}</div>
    </section>
  )
}

interface SectionHeadingProps {
  readonly eyebrow?: string
  readonly title: ReactNode
  readonly description?: string
  readonly align?: 'left' | 'center'
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: SectionHeadingProps) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow ? (
        <p className="text-sm font-medium tracking-wide text-brand-hi uppercase">{eyebrow}</p>
      ) : null}
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-pretty text-lg text-ink-muted">{description}</p>
      ) : null}
    </div>
  )
}
