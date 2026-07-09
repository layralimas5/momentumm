import { cn } from '@/shared/lib/cn'

interface ProgressBarProps {
  /** Valor de 0 a 100. */
  value: number
  className?: string
  label?: string
}

/** Barra de progresso acessível (role progressbar) com gradiente da marca. */
export function ProgressBar({ value, className, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800', className)}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-blush-400 transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
