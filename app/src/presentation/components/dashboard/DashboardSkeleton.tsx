import { cn } from '@/shared/lib/cn'

/**
 * Esqueleto do dashboard. Segue a mesma malha da tela pronta: carregar e
 * terminar de carregar não pode empurrar o conteúdo pra outro lugar (CLS).
 */
export function DashboardSkeleton({ mobile = false }: { mobile?: boolean }) {
  /*
    O esqueleto segue a malha da tela pronta em cada formato. Um esqueleto de
    desktop no celular empurraria o conteúdo de lugar quando os dados chegassem,
    que é exatamente o que ele existe pra evitar.
  */
  if (mobile) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-6">
        <span className="sr-only">Carregando seu dia</span>
        <Block className="h-28" />
        <Block className="h-64" />
        <Block className="h-44" />
        <Block className="h-40" />
      </div>
    )
  }

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-5">
      <span className="sr-only">Carregando seu dashboard</span>

      <Block className="h-24" />
      <Block className="h-44" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <Block className="h-64" />
          <Block className="h-72" />
        </div>
        <div className="flex flex-col gap-5">
          <Block className="h-56" />
          <Block className="h-64" />
        </div>
      </div>
    </div>
  )
}

function Block({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block animate-pulse rounded-card border border-line bg-surface', className)}
    />
  )
}
