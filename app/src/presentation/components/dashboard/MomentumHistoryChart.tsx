import { formatDayLabel, type DayKey } from '@/domain/entities/day'
import type { MomentumPoint } from '@/domain/entities/momentum'
import { cn } from '@/shared/lib/cn'

/**
 * A evolução do score, em linha.
 *
 * O eixo vai sempre de 0 a 100, e não do menor ao maior ponto da série: escala
 * automática transformaria uma variação de três pontos numa montanha, e a
 * pessoa leria queda livre onde houve estabilidade.
 *
 * Desenhado em SVG à mão porque é uma polilinha — trazer uma biblioteca de
 * gráficos pra isso custaria mais bytes que a tela inteira.
 */
export function MomentumHistoryChart({
  history,
  today,
  className,
  compact = false,
}: {
  readonly history: readonly MomentumPoint[]
  readonly today: DayKey
  readonly className?: string
  /** Sem legenda: a versão pequena da faixa, onde a curva é só tendência. */
  readonly compact?: boolean
}) {
  if (history.length < 2) return null

  const width = 100
  const height = 32
  const step = width / (history.length - 1)

  const points = history.map((point, index) => ({
    x: index * step,
    y: height - (point.value / 100) * height,
    point,
  }))

  const line = points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `0,${height} ${line} ${width},${height}`
  const last = points[points.length - 1]

  const first = history[0]
  const current = history[history.length - 1]

  return (
    <figure className={cn('flex flex-col gap-1.5', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Evolução do momentum: ${history.length} dias, de ${first?.value ?? 0} a ${current?.value ?? 0} pontos`}
        className={cn('w-full overflow-visible', compact ? 'h-8' : 'h-16')}
      >
        <polygon points={area} fill="var(--color-brand)" opacity={0.12} />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {last ? (
          <circle cx={last.x} cy={last.y} r={2} fill="var(--color-brand)" vectorEffect="non-scaling-stroke" />
        ) : null}
      </svg>

      {compact ? null : (
        <figcaption className="flex items-center justify-between text-xs text-ink-faint">
          <span>{first ? formatDayLabel(first.day, today) : ''}</span>
          <span>hoje</span>
        </figcaption>
      )}
    </figure>
  )
}
