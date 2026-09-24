import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * Moldura de celular desenhada em CSS, não em imagem: fica nítida em qualquer
 * tela e não pesa no LCP. O conteúdo é uma captura real do app, passada como
 * filho (ver `Features`).
 */
export function PhoneMockup({
  children,
  className,
  tall = false,
  flush = false,
}: {
  children: ReactNode
  className?: string
  /** Altura maior pra telas com mais conteúdo (hero). */
  tall?: boolean
  /** Sem o padding interno: pra uma captura real do app, que já traz a própria margem. */
  flush?: boolean
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative mx-auto w-full max-w-[300px] rounded-[2.5rem] border border-line-hi bg-surface p-2.5 shadow-2xl shadow-black/40',
        className,
      )}
    >
      <div className="absolute left-1/2 top-3.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-canvas" />
      <div
        className={cn(
          'overflow-hidden rounded-[2rem] bg-canvas',
          flush ? '' : 'px-3.5 pb-4 pt-10',
          tall ? 'h-[600px]' : 'h-[540px]',
        )}
      >
        {children}
      </div>
    </div>
  )
}
