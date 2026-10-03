import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { HeatCell } from '@/domain/entities/rhythm'
import { cn } from '@/shared/lib/cn'

interface Point {
  readonly x: number
  readonly y: number
}

function toPoints(values: readonly number[], width: number, height: number, pad: number): Point[] {
  if (values.length === 0) return []
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = Math.max(1, max - min)
  const step = values.length === 1 ? 0 : (width - pad * 2) / (values.length - 1)

  return values.map((value, index) => ({
    x: pad + index * step,
    y: pad + (height - pad * 2) * (1 - (value - min) / span),
  }))
}

/** Curva suave (Catmull-Rom convertida em Bézier): a linha não quebra em quina. */
function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return ''
  const [first] = points
  if (!first) return ''
  let d = `M${first.x.toFixed(1)},${first.y.toFixed(1)}`

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[index + 2] ?? p2
    if (!p0 || !p1 || !p2 || !p3) continue
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }

  return d
}

/** Linha curta com área, ao lado do número grande. Decorativa: o número já diz tudo. */
export function Sparkline({
  values,
  className,
  width = 120,
  height = 44,
}: {
  readonly values: readonly number[]
  readonly className?: string
  readonly width?: number
  readonly height?: number
}) {
  const id = useId()
  const reduce = useReducedMotion()
  const points = toPoints(values, width, height, 4)
  const last = points[points.length - 1]
  if (!last) return null
  const line = smoothPath(points)
  const area = `${line} L${last.x},${height} L${points[0]?.x ?? 0},${height} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn('overflow-visible', className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-fill)`} />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth={2.25}
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
      <circle cx={last.x} cy={last.y} r={4} fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth={2} />
    </svg>
  )
}

/** O gráfico grande do Progresso: linha roxa, área translúcida e quatro marcas no eixo. */
export function AreaChart({
  values,
  ticks,
  label,
  className,
}: {
  readonly values: readonly number[]
  /** Rótulos do eixo, distribuídos de ponta a ponta. */
  readonly ticks: readonly string[]
  readonly label: string
  readonly className?: string
}) {
  const id = useId()
  const reduce = useReducedMotion()
  const width = 320
  const height = 150
  const points = toPoints(values, width, height, 6)
  const last = points[points.length - 1]
  const first = points[0]

  return (
    <figure className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full overflow-visible" role="img" aria-label={label}>
        <defs>
          <linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {last && first ? (
          <>
            <motion.path
              key={`area-${values.length}`}
              d={`${smoothPath(points)} L${last.x},${height} L${first.x},${height} Z`}
              fill={`url(#${id}-area)`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduce ? 0 : 0.6 }}
            />
            <motion.path
              key={`line-${values.length}`}
              d={smoothPath(points)}
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth={2.5}
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
            <circle cx={last.x} cy={last.y} r={5} fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth={2.5} />
          </>
        ) : null}
      </svg>
      <figcaption className="mt-2 flex justify-between text-[0.7rem] text-ink-faint tabular" aria-hidden="true">
        {ticks.map((tick, index) => (
          <span key={`${tick}-${index}`}>{tick}</span>
        ))}
      </figcaption>
    </figure>
  )
}

const HEAT_CLASSES: Readonly<Record<HeatCell['level'], string>> = {
  0: 'bg-surface-top',
  1: 'bg-brand/25',
  2: 'bg-brand/45',
  3: 'bg-brand/70',
  4: 'bg-brand',
}

/** Calendário de constância: uma coluna por semana, uma linha por dia. */
export function Heatmap({
  weeks,
  label,
}: {
  readonly weeks: readonly (readonly HeatCell[])[]
  readonly label: string
}) {
  return (
    <div className="well overflow-x-auto rounded-2xl p-3 no-scrollbar">
      <div role="img" aria-label={label} className="mx-auto flex w-max gap-[5px]">
        {weeks.map((week) => (
          <div key={week[0]?.day} className="flex flex-col gap-[5px]">
            {week.map((cell) => (
              <span
                key={cell.day}
                title={cell.future ? undefined : cell.day}
                className={cn(
                  'size-[15px] rounded-[4px]',
                  cell.future ? 'bg-transparent' : HEAT_CLASSES[cell.level],
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function HeatLegend() {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-ink-faint" aria-hidden="true">
      <span>Menos consistente</span>
      <span className="flex gap-1">
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span key={level} className={cn('size-2.5 rounded-[3px]', HEAT_CLASSES[level])} />
        ))}
      </span>
      <span>Mais</span>
    </div>
  )
}
