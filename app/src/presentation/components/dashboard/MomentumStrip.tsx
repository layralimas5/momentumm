import { useState } from 'react'
import type { DayKey } from '@/domain/entities/day'
import {
  MOMENTUM_LEVEL_LABELS,
  type MomentumPoint,
  type MomentumScore,
} from '@/domain/entities/momentum'
import type { MomentumNextAction } from '@/domain/entities/momentum-next-action'
import type { Streak } from '@/domain/entities/streak'
import { Icon } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'
import { MomentumDialog } from './MomentumDialog'
import { MomentumHistoryChart } from './MomentumHistoryChart'

/**
 * O Momentum em uma faixa, não em um card.
 *
 * Ele precisa de destaque e não de espaço: é um número de contexto, não a ação
 * do dia. Como card grande ele disputava a primeira dobra com o foco — e a
 * pessoa abre o app pra decidir o que fazer, não pra ler a própria nota.
 *
 * O número nunca aparece sozinho. Sem a variação, a leitura em uma frase e o
 * caminho pro detalhamento, 62 não significa nada e ninguém muda de
 * comportamento por causa dele.
 */
export function MomentumStrip({
  momentum,
  history,
  today,
  streak,
  recommendation,
  detail,
  nextAction = null,
}: {
  readonly momentum: MomentumScore
  readonly history: readonly MomentumPoint[]
  readonly today: DayKey
  readonly streak: Streak
  readonly recommendation: string
  /** Variação e curva. No gratuito só a pontuação de hoje aparece. */
  readonly detail: boolean
  readonly nextAction?: MomentumNextAction | null
}) {
  const [open, setOpen] = useState(false)

  const tone =
    momentum.level === 'avancando'
      ? 'positive'
      : momentum.level === 'desacelerando'
        ? 'warn'
        : 'brand'

  const rising = momentum.delta > 0
  const flat = momentum.delta === 0

  return (
    <>
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
            Sem uma semana de história não existe variação. Mostrar "+62" pra
            quem começou ontem é comparar com o vazio e inflar o primeiro número
            que a pessoa vê.
          */}
          {!detail ? null : momentum.hasEnoughData ? (
            <span
              className={cn(
                'tabular inline-flex items-center gap-1 text-xs',
                flat ? 'text-ink-faint' : rising ? 'text-positive' : 'text-flame',
              )}
            >
              <Icon name={flat ? 'minimo' : rising ? 'subir' : 'descer'} className="size-3.5" />
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

        {/* A curva some antes do resto quando a largura aperta: ela é a parte
            decorativa da faixa, e o número com a leitura é a parte útil. */}
        {detail && history.length > 1 && history.some((point) => point.value > 0) ? (
          <div className="hidden w-32 shrink-0 xl:block">
            <MomentumHistoryChart history={history} today={today} compact />
          </div>
        ) : null}

        <p className="min-w-0 basis-full text-sm text-pretty text-ink-muted lg:basis-auto lg:flex-1">
          {momentum.headline}
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-surface-hi hover:text-ink-muted"
        >
          Entender meu score
          <Icon name="seta" className="size-3.5" />
        </button>
      </section>

      <MomentumDialog
        open={open}
        momentum={momentum}
        history={history}
        today={today}
        recommendation={recommendation}
        detail={detail}
        nextAction={nextAction}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
