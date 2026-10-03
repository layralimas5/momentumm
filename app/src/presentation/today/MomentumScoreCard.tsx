import { Link } from 'react-router-dom'
import type { MomentumScore } from '@/domain/entities/momentum'
import { Card } from '@/presentation/components/ds/Card'
import { Sparkline } from '@/presentation/components/ds/Charts'
import { AnimatedNumber, ProgressBar } from '@/presentation/components/ds/Progress'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/** "+4 esta semana": a variação contra sete dias atrás, com a seta do sentido. */
export function DeltaChip({ delta, className }: { readonly delta: number; readonly className?: string }) {
  const up = delta >= 0
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-semibold whitespace-nowrap tabular',
        up ? 'bg-brand-dim text-brand-ink' : 'well text-ink-muted',
        className,
      )}
    >
      <Icon name={up ? 'tendencia' : 'descer'} className="size-3.5" strokeWidth={2.25} />
      {up ? '+' : '−'}
      {Math.abs(delta)} esta semana
    </span>
  )
}

/** O número grande e o "/100" pequeno, lado a lado. */
export function ScoreNumber({ value, className }: { readonly value: number; readonly className?: string }) {
  return (
    <p className={cn('flex items-baseline gap-1.5', className)}>
      <AnimatedNumber value={value} className="text-[3.4rem] leading-none font-bold tracking-tight text-ink" />
      <span className="text-lg font-medium text-ink-faint">/100</span>
    </p>
  )
}

export function MomentumScoreCard({
  momentum,
  series,
  showTrend,
}: {
  readonly momentum: MomentumScore
  readonly series: readonly number[]
  /** O gratuito vê só o número de hoje; a curva é do PRO. */
  readonly showTrend: boolean
}) {
  return (
    <Card aria-labelledby="momentum-hoje">
      <div className="flex items-center gap-2">
        <h2 id="momentum-hoje" className="eyebrow shrink-0 text-[0.7rem] tracking-[0.1em] text-ink-muted">
          Momentum Score
        </h2>
        <Link
          to="/app/progresso"
          className="ml-auto inline-flex shrink-0 items-center text-[0.8rem] font-medium whitespace-nowrap text-brand-hi hover:underline"
        >
          Ver análise
          <Icon name="seta" className="size-3.5" />
        </Link>
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <ScoreNumber value={momentum.value} />
        <div className="flex flex-col items-end gap-2">
          {momentum.hasEnoughData ? <DeltaChip delta={momentum.delta} /> : null}
          {showTrend && series.length > 1 ? <Sparkline values={series} className="h-11 w-28 shrink-0" /> : null}
        </div>
      </div>

      <ProgressBar value={momentum.value / 100} label={`Momentum Score: ${momentum.value} de 100`} className="mt-5" />
    </Card>
  )
}
