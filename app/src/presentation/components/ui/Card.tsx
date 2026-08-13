import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cn('rounded-card border border-line bg-surface p-5', className)}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-medium tracking-wide text-ink-muted uppercase">{children}</h2>
}
