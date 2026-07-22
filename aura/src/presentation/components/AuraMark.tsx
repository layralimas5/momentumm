import { cn } from '@/shared/lib/cn'

interface AuraMarkProps {
  className?: string
  withWordmark?: boolean
  /** Força o wordmark branco (uso em fundos escuros, ex.: landing). */
  light?: boolean
}

/**
 * Marca do Aura.
 *
 * Em fundos escuros (`light`) usa o wordmark definitivo (logo com brilho, que só
 * lê bem sobre escuro). Nas telas do app — que alternam tema claro/escuro —
 * mantém o mark provisório (orb + wordmark) até existir uma logo limpa em fundo
 * claro. Troca `/logo-light.png` pela versão final quando ela chegar.
 */
export function AuraMark({ className, withWordmark = true, light = false }: AuraMarkProps) {
  if (light) {
    return (
      <img
        src="/logo-light.png"
        alt="Aura"
        draggable={false}
        className={cn('h-8 w-auto select-none', className)}
      />
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className="relative inline-block h-7 w-7 rounded-full bg-gradient-to-br from-brand-400 via-brand-600 to-blush-500 shadow-sm"
      >
        <span className="absolute inset-[3px] rounded-full bg-white/25 blur-[1px] dark:bg-white/10" />
      </span>
      {withWordmark && (
        <span
          className={cn(
            'text-lg font-semibold tracking-tight',
            light ? 'text-white' : 'text-zinc-900 dark:text-zinc-50',
          )}
        >
          Aura
        </span>
      )}
    </span>
  )
}
