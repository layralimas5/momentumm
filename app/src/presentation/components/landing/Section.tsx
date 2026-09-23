import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { RevealWords } from './Reveal'

/**
 * O respiro que a âncora precisa: o header é fixo e flutua com a própria
 * margem (12px + 56px no celular, 16px + 64px no desktop). Com menos que
 * isso, clicar num link do menu leva o título pra debaixo da pílula e a
 * pessoa acha que a página rolou pro lugar errado.
 */
const SCROLL_MARGIN = 'scroll-mt-24 sm:scroll-mt-28'

interface SectionProps {
  readonly id?: string
  readonly children: ReactNode
  readonly className?: string
  readonly bleed?: boolean
}

export function Section({ id, children, className, bleed = false }: SectionProps) {
  return (
    <section id={id} className={cn(SCROLL_MARGIN, 'py-16 sm:py-24', className)}>
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
          'mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl',
          onBrand ? 'text-white' : 'text-ink',
        )}
      >
        {typeof title === 'string' ? <RevealWords text={title} delay={0.1} /> : title}
      </h2>
      {description ? (
        <motion.p
          {...fade(0.35)}
          className={cn('mt-4 text-pretty text-lg', onBrand ? 'text-white/85' : 'text-ink-muted')}
        >
          {description}
        </motion.p>
      ) : null}
    </div>
  )
}
