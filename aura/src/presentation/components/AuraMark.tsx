import { cn } from '@/shared/lib/cn'

interface AuraMarkProps {
  className?: string
  withWordmark?: boolean
  /** Força o wordmark branco (uso em fundos escuros, ex.: landing). */
  light?: boolean
}

/**
 * Marca provisória do Aura — um "orb" com gradiente que remete à aura/energia.
 * Placeholder até a identidade visual definitiva ser criada.
 */
export function AuraMark({ className, withWordmark = true, light = false }: AuraMarkProps) {
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
