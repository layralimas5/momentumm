import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

/** Superfície base — card premium com borda de baixo contraste. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
      {...props}
    />
  )
}
