import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * Moldura de celular desenhada em CSS, não em imagem: fica nítida em qualquer
 * tela, não pesa no LCP e não trava a landing esperando print do app.
 */
export function PhoneMockup({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative mx-auto w-full max-w-[240px] rounded-[2.5rem] border border-line-hi bg-surface p-2.5 shadow-2xl shadow-black/40 sm:max-w-[280px]',
        className,
      )}
    >
      <div className="absolute left-1/2 top-3.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-canvas" />
      <div className="h-[400px] overflow-hidden rounded-[2rem] bg-canvas px-4 pb-4 pt-10 sm:h-[520px]">
        {children}
      </div>
    </div>
  )
}

export function MockHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-4">
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="text-xs text-ink-muted">{subtitle}</p>
    </header>
  )
}

export function MockCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface p-3.5', className)}>{children}</div>
  )
}
