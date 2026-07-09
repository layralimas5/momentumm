import { ArrowRight } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { CtaLink } from '@/presentation/components/landing/CtaLink'

interface CtaButtonProps {
  /** Objetivo único de conversão — mesmo texto em toda a página. */
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

/**
 * CTA primário da landing (tema escuro). Leva ao checkout (ou à página de
 * vagas enquanto o checkout não está configurado).
 */
export function CtaButton({ label = 'Quero garantir minha vaga', size = 'md', className }: CtaButtonProps) {
  const sizes = size === 'sm' ? 'h-9 px-4 text-sm' : 'h-12 px-6 text-base'
  return (
    <CtaLink
      className={cn(
        'group inline-flex items-center justify-center gap-2 rounded-full font-semibold text-white',
        'bg-gradient-to-r from-brand-500 to-blush-500 shadow-lg shadow-brand-500/30',
        'transition-all hover:shadow-xl hover:shadow-brand-500/40 hover:brightness-110',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        sizes,
        className,
      )}
    >
      {label}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </CtaLink>
  )
}
