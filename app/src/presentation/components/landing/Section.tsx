import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { RevealWords } from './Reveal'

interface SectionProps {
  readonly id?: string
  readonly children: ReactNode
  readonly className?: string
  readonly bleed?: boolean
}

export function Section({ id, children, className, bleed = false }: SectionProps) {
  return (
    <section id={id} className={cn('scroll-mt-20 py-[clamp(4rem,10vw,7rem)]', className)}>
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
  const reduced = useReducedMotion()
  const fade = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.5, delay },
  })

  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow ? (
        <motion.p
          {...fade(0)}
          className={cn(
            'text-sm font-medium tracking-wide uppercase',
            onBrand ? 'text-white/80' : 'text-brand-hi',
          )}
        >
          {eyebrow}
        </motion.p>
      ) : null}
      <h2
        className={cn(
          'mt-3 text-balance text-[clamp(1.75rem,5vw,2.5rem)] font-semibold leading-[1.15] tracking-tight',
          onBrand ? 'text-white' : 'text-ink',
        )}
      >
        {typeof title === 'string' ? <RevealWords text={title} delay={0.1} /> : title}
      </h2>
      {description ? (
        <motion.p
          {...fade(0.35)}
          className={cn('mt-4 text-pretty text-[clamp(1rem,2.4vw,1.125rem)]', onBrand ? 'text-white/85' : 'text-ink-muted')}
        >
          {description}
        </motion.p>
      ) : null}
    </div>
  )
}
