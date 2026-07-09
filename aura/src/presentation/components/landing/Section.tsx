import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

interface SectionProps extends HTMLAttributes<HTMLElement> {
  id?: string
}

/** Wrapper de seção com espaçamento e largura consistentes. */
export function Section({ id, className, children, ...props }: SectionProps) {
  return (
    <section id={id} className={cn('py-16 md:py-24', className)} {...props}>
      <div className="mx-auto max-w-6xl px-5 sm:px-6">{children}</div>
    </section>
  )
}

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  subtitle?: string
  className?: string
}

/** Cabeçalho de seção padronizado (eyebrow + título + subtítulo). Tema escuro. */
export function SectionHeading({ eyebrow, title, subtitle, className }: SectionHeadingProps) {
  return (
    <div className={cn('mx-auto max-w-2xl text-center', className)}>
      {eyebrow && (
        <span className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-400">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-zinc-400 md:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  )
}
