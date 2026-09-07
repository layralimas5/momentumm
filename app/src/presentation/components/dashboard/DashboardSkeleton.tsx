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
        <Block className="h-12" />
        <Block className="h-14" />
        <Block className="h-72" />
        <Block className="h-44" />
      </div>
    )
  }

  return (
    /*
      A mesma malha da tela pronta: container centralizado com o mesmo teto de
      largura, cabeçalho, faixa do momentum, o bloco do foco e as duas colunas
      do segundo nível. Esqueleto com outra forma é um salto de layout
      disfarçado de carregamento.
    */
    <div role="status" aria-live="polite" className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <span className="sr-only">Carregando seu dashboard</span>

      <div className="flex flex-col gap-4">
        <Block className="h-20" />
        <Block className="h-14" />
        <Block className="h-72" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Block className="h-56" />
        <Block className="h-56" />
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
