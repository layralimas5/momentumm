import { Link } from 'react-router-dom'
import { MOMENTUM_LEVEL_LABELS, type MomentumScore } from '@/domain/entities/momentum'
import type { Streak } from '@/domain/entities/streak'
import { Icon } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'

/**
 * O Momentum em uma faixa, não em um card.
 *
 * Ele precisa de destaque e não de espaço: é um número de contexto, não a ação
 * do dia. Como card grande ele disputava a primeira dobra com o foco — e a
 * pessoa abre o app pra decidir o que fazer, não pra ler a própria nota.
 *
 * O número nunca aparece sozinho. Sem a variação e a leitura em uma frase, 62
 * não significa nada e ninguém muda de comportamento por causa dele.
 */
export function MomentumStrip({
  momentum,
  streak,
  hasHistory,
}: {
  readonly momentum: MomentumScore
  readonly streak: Streak
  /** Falso quando ainda não há semana anterior pra comparar. */
  readonly hasHistory: boolean
}) {
  const tone =
    momentum.level === 'avancando'
      ? 'positive'
      : momentum.level === 'desacelerando'
        ? 'warn'
        : 'brand'

  const rising = momentum.delta > 0
  const flat = momentum.delta === 0

  return (
    <section
      aria-labelledby="momentum-titulo"
      className="surface-card flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3.5"
    >
      <div className="flex items-baseline gap-2">
        <h2 id="momentum-titulo" className="sr-only">
          Momentum Score
        </h2>
        <span className="text-gradient-brand tabular text-3xl leading-none font-semibold tracking-tight">
          {momentum.value}
        </span>
        <span className="text-xs text-ink-faint">Momentum</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={tone}>{MOMENTUM_LEVEL_LABELS[momentum.level]}</Tag>

        {/*
          Sem semana anterior não existe variação. Mostrar "+62" pra quem começou
          ontem é comparar com o vazio e inflar o primeiro número que a pessoa vê.
        */}
        {hasHistory ? (
          <span
            className={cn(
              'tabular inline-flex items-center gap-1 text-xs',
              flat ? 'text-ink-faint' : rising ? 'text-positive' : 'text-flame',
            )}
          >
            <Icon
              name={flat ? 'minimo' : rising ? 'subir' : 'descer'}
              className="size-3.5"
            />
            {flat
              ? 'igual à semana passada'
              : `${rising ? '+' : ''}${momentum.delta} nesta semana`}
          </span>
        ) : (
          <span className="text-xs text-ink-faint">primeira semana de registro</span>
        )}

        {streak.current > 0 ? (
          <span className="tabular inline-flex items-center gap-1 text-xs text-ink-faint">
            <Icon name="fogo" className="size-3.5 text-flame" />
            {streak.current} {streak.current === 1 ? 'dia' : 'dias'}
          </span>
        ) : null}
      </div>

      <Link
        to="/app/progresso"
        className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-ink-muted"
      >
        Entender a pontuação
        <Icon name="seta" className="size-3.5" />
      </Link>
    </section>
  )
}
