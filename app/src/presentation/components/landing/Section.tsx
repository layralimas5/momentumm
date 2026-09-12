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
  /** `brand` é pra seção com fundo roxo: texto branco, sem depender dos tokens de tinta. */
  readonly tone?: 'default' | 'brand'
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  tone = 'default',
}: SectionHeadingProps) {
  const onBrand = tone === 'brand'
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow ? (
        <p
          className={cn(
            'text-sm font-medium tracking-wide uppercase',
            onBrand ? 'text-white/80' : 'text-brand-hi',
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          'mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl',
          onBrand ? 'text-white' : 'text-ink',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn('mt-4 text-pretty text-lg', onBrand ? 'text-white/85' : 'text-ink-muted')}>
          {description}
        </p>
      ) : null}
    </div>
  )
}
