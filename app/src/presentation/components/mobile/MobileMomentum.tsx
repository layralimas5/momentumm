import { MOMENTUM_LEVEL_LABELS, type MomentumScore } from '@/domain/entities/momentum'
import type { DayDot } from '@/domain/entities/momentum'
import type { Streak } from '@/domain/entities/streak'
import { Icon } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'

interface MobileMomentumProps {
  readonly momentum: MomentumScore
  readonly series: readonly DayDot[]
  readonly streak: Streak
  readonly onOpen: () => void
}

/**
 * Resumo do ritmo no celular.
 *
 * O card inteiro é um botão: tocar abre a análise completa. Aqui ficam só o
 * número, a classificação, a variação e uma frase — gráfico que exige
 * interpretação numa tela de 360px não é informação, é enfeite. As sete barras
 * são tendência, não leitura precisa.
 */
export function MobileMomentum({ momentum, series, streak, onOpen }: MobileMomentumProps) {
  const tone =
    momentum.level === 'avancando'
      ? 'positive'
      : momentum.level === 'desacelerando'
        ? 'warn'
        : 'brand'

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Momentum ${momentum.value} de 100, ${MOMENTUM_LEVEL_LABELS[momentum.level]}. Tocar para ver a análise completa.`}
      className="surface-card w-full p-4 text-left transition-colors active:bg-surface-hi"
    >
      <div className="flex items-center gap-3">
        <span className="text-gradient-brand tabular text-4xl leading-none font-semibold tracking-tight">
          {momentum.value}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <Tag tone={tone}>{MOMENTUM_LEVEL_LABELS[momentum.level]}</Tag>
            {streak.current > 0 ? (
              <Tag tone={streak.atRisk ? 'warn' : 'neutral'}>
                <Icon name="fogo" className="size-3.5" />
                {streak.current}
              </Tag>
            ) : null}
          </span>
          <span className="mt-1 block text-sm text-ink-faint">
            {momentum.delta === 0
              ? 'igual à semana passada'
              : `${momentum.delta > 0 ? '+' : '−'}${Math.abs(momentum.delta)} vs. semana passada`}
          </span>
        </span>

        <Sparkline series={series} />
        <Icon name="seta" className="size-4 shrink-0 text-ink-faint" />
      </div>

      <p className="mt-3 text-sm text-ink-muted">{momentum.explanation}</p>
    </button>
  )
}

/** Sete barras: a forma da semana, não o valor exato de cada dia. */
function Sparkline({ series }: { series: readonly DayDot[] }) {
  return (
    <span aria-hidden="true" className="hidden h-8 shrink-0 items-end gap-1 min-[360px]:flex">
      {series.map((day) => (
        <span
          key={day.day}
          className={cn(
            'w-1.5 rounded-full',
            day.intensity > 0.5 ? 'bg-brand' : day.intensity > 0 ? 'bg-brand/50' : 'bg-line-hi',
          )}
          style={{ height: `${Math.max(4, Math.round(day.intensity * 32))}px` }}
        />
      ))}
    </span>
  )
}
