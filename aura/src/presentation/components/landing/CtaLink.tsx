import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { CHECKOUT_ENABLED, CHECKOUT_URL } from '@/presentation/components/landing/checkout'

interface CtaLinkProps {
  className?: string
  children: ReactNode
  'aria-label'?: string
}

/**
 * Destino único dos CTAs de conversão. Com checkout configurado, vai pro
 * pagamento (a pessoa recebe o acesso por e-mail depois); enquanto não houver,
 * leva à página interna "/vagas" — ninguém entra no app sem passar pelo funil.
 */
export function CtaLink({ className, children, ...rest }: CtaLinkProps) {
  if (CHECKOUT_ENABLED) {
    return (
      <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className={className} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link to="/vagas" className={className} {...rest}>
      {children}
    </Link>
  )
}
