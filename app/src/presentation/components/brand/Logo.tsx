import { cn } from '@/shared/lib/cn'

/**
 * A marca oficial é o wordmark em arquivo (public/logo.png), tratado pra ter
 * fundo transparente. Nada de redesenhar a logo em código: o arquivo é a fonte
 * da verdade, então trocar a arte é trocar o PNG.
 */

interface LogoProps {
  readonly className?: string
  /** Quando o nome já aparece no texto ao lado, o alt vira vazio. */
  readonly decorative?: boolean
}

export function Wordmark({ className, decorative = false }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt={decorative ? '' : 'Momentumm'}
      width={1000}
      height={53}
      decoding="async"
      /*
        O wordmark é muito largo (proporção ~19:1): controlar pela ALTURA
        estoura a largura e come o menu inteiro. Por isso o tamanho é definido
        pela largura, com a altura calculada sozinha. Quem passa `className`
        assume a largura inteira: o `cn` não resolve conflito de classe.
      */
      className={cn('h-auto select-none', className ?? 'w-40 sm:w-48')}
      {...(decorative ? { 'aria-hidden': true } : {})}
    />
  )
}

/** Só o "MM" roxo, pra espaços quadrados e apertados. */
export function LogoMark({ className, decorative = true }: LogoProps) {
  return (
    <img
      src="/simbolo.png"
      alt={decorative ? '' : 'Momentumm'}
      width={512}
      height={512}
      decoding="async"
      className={cn('size-7 select-none', className)}
      {...(decorative ? { 'aria-hidden': true } : {})}
    />
  )
}
