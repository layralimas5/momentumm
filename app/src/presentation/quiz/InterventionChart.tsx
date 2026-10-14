import type { InterventionDetail, RecoveryDay } from '@/domain/entities/quiz-strategy'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * O gráfico de cada intervenção. Um desenho por mecanismo: o passo que
 * encolhe vira duas barras, a retomada vira a semana real da pessoa, o
 * progresso vira uma linha que não desce no dia perdido.
 */
export function InterventionChart({ detail }: { readonly detail: InterventionDetail }) {
  switch (detail.kind) {
    case 'shrink':
      return <ShrinkBars {...detail} />
    case 'week':
      return <RecoveryWeek days={detail.days} minimal={detail.minimal} />
    case 'flow':
      return <Flow from={detail.from} to={detail.to} />
    case 'streak':
      return <ProgressLine days={detail.days} />
    case 'split':
      return <SplitBar pieces={detail.pieces} />
    case 'focus':
      return <FocusStack highlight={detail.highlight} others={detail.others} />
    case 'review':
      return <ReviewLoop days={detail.days} />
  }
}

/** As duas versões do mesmo passo, em barras do tamanho de cada uma. */
function ShrinkBars({
  from,
  fromMinutes,
  to,
  toMinutes,
}: {
  readonly from: string
  readonly fromMinutes: number
  readonly to: string
  readonly toMinutes: number | null
}) {
  // Versão mínima sem minutos ("escrever uma linha") fica com um quarto da barra: é o que ela é, um pedaço.
  const ratio = toMinutes ? Math.min(1, toMinutes / fromMinutes) : 0.25
  return (
    <div className="flex flex-col gap-2.5" role="img" aria-label={`No plano: ${from}, ${fromMinutes} minutos. No dia ruim: ${to}.`}>
      <Bar label="Dia normal" value={`${fromMinutes} min`} ratio={1} tone="muted" />
      <Bar label="Dia ruim" value={toMinutes ? `${toMinutes} min` : 'mínimo'} ratio={Math.max(ratio, 0.18)} tone="brand" />
      <p className="truncate text-xs text-ink-faint">{to}</p>
    </div>
  )
}

function Bar({
  label,
  value,
  ratio,
  tone,
}: {
  readonly label: string
  readonly value: string
  readonly ratio: number
  readonly tone: 'muted' | 'brand'
}) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2" aria-hidden="true">
      <span className="text-xs text-ink-faint">{label}</span>
      <span className="well h-7 overflow-hidden rounded-full">
        <span
          className={cn(
            'flex h-full items-center justify-end rounded-full px-2.5 text-xs font-semibold tabular',
            tone === 'brand' ? 'bg-gradient-to-r from-brand to-brand-hi text-white' : 'bg-surface-top text-ink-muted',
          )}
          style={{ width: `${ratio * 100}%` }}
        >
          {value}
        </span>
      </span>
    </div>
  )
}

/** A semana a partir de hoje: o dia perdido e o dia em que o plano retoma. */
function RecoveryWeek({ days, minimal }: { readonly days: readonly RecoveryDay[]; readonly minimal: string }) {
  const description = days
    .filter((day) => day.state === 'perdido' || day.state === 'retomada')
    .map((day) => `${day.label}: ${day.state === 'perdido' ? 'perdido' : 'retoma'}`)
    .join(', ')
  return (
    <div className="flex flex-col gap-3">
      <ol className="grid grid-cols-7 gap-1" role="img" aria-label={`Exemplo na sua semana. ${description}.`}>
        {days.map((day, index) => (
          <li key={index} aria-hidden="true" className="flex flex-col items-center gap-1.5">
            <span className={cn('text-[0.68rem]', day.state === 'retomada' ? 'font-semibold text-brand-hi' : 'text-ink-faint')}>
              {day.label}
            </span>
            <DayDot state={day.state} />
          </li>
        ))}
      </ol>
      <p className="flex items-center gap-2 text-xs text-ink-muted">
        <Icon name="retomar" className="size-3.5 shrink-0 text-brand-hi" />
        <span className="truncate">Retoma com: {minimal}</span>
      </p>
    </div>
  )
}

function DayDot({ state }: { readonly state: RecoveryDay['state'] }) {
  if (state === 'perdido') {
    return (
      <span className="grid size-8 place-items-center rounded-full border border-dashed border-line-hi text-ink-faint">
        <Icon name="fechar" className="size-3.5" />
      </span>
    )
  }
  if (state === 'retomada') {
    return (
      <span className="grid size-8 place-items-center rounded-full bg-brand text-white shadow-[0_0_18px_-2px_var(--color-brand)]">
        <Icon name="check" className="size-4" strokeWidth={2.25} />
      </span>
    )
  }
  return (
    <span className="grid size-8 place-items-center">
      <span className={cn('rounded-full', state === 'plano' ? 'size-2.5 bg-brand/50' : 'size-1.5 bg-line-hi')} />
    </span>
  )
}

/** Gatilho → resposta combinada. */
function Flow({ from, to }: { readonly from: string; readonly to: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
      <span className="well flex items-center rounded-2xl px-3 py-2.5 text-xs text-pretty text-ink-muted">{from}</span>
      <span aria-hidden="true" className="grid place-items-center text-brand-hi">
        <Icon name="seta" className="size-4" />
      </span>
      <span className="flex items-center rounded-2xl bg-gradient-to-br from-brand to-brand-hi px-3 py-2.5 text-xs font-semibold text-pretty text-white">
        {to}
      </span>
    </div>
  )
}

/** Progresso acumulado: o dia perdido deixa a linha parada, nunca a derruba. */
function ProgressLine({ days }: { readonly days: readonly ('feito' | 'perdido')[] }) {
  const width = 280
  const height = 84
  const pad = 12
  const points = days.reduce<{ x: number; total: number; done: boolean }[]>((acc, day, index) => {
    const previous = acc[index - 1]?.total ?? 0
    acc.push({ x: index, total: previous + (day === 'feito' ? 1 : 0), done: day === 'feito' })
    return acc
  }, [])
  const max = points[points.length - 1]?.total ?? 1
  const xy = points.map((point) => ({
    ...point,
    cx: pad + (point.x / Math.max(1, days.length - 1)) * (width - pad * 2),
    cy: height - pad - (point.total / max) * (height - pad * 2),
  }))
  const line = xy.map((point) => `${point.cx},${point.cy}`).join(' ')
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`

  return (
    <figure className="flex flex-col gap-1.5">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Exemplo: sete dias, um perdido no meio, e o progresso continua subindo"
        className="w-full"
      >
        <defs>
          <linearGradient id="quiz-progress-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#quiz-progress-fill)" />
        <polyline points={line} fill="none" stroke="var(--color-brand-hi)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {xy.map((point) =>
          point.done ? (
            <circle key={point.x} cx={point.cx} cy={point.cy} r={4} fill="var(--color-brand-hi)" />
          ) : (
            <circle
              key={point.x}
              cx={point.cx}
              cy={point.cy}
              r={5}
              fill="var(--color-canvas)"
              stroke="var(--color-ink-faint)"
              strokeWidth={1.5}
              strokeDasharray="2 2"
            />
          ),
        )}
      </svg>
      <figcaption className="text-xs text-ink-faint">Exemplo: um dia fora, e a linha não volta pro zero.</figcaption>
    </figure>
  )
}

/** A meta em pedaços: só o primeiro aceso. */
function SplitBar({ pieces }: { readonly pieces: readonly string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex gap-1.5" aria-label="Sua meta em pedaços">
        {pieces.map((piece, index) => (
          <li
            key={piece}
            className={cn(
              'flex h-9 flex-1 items-center justify-center rounded-xl text-xs font-semibold',
              index === 0 ? 'bg-gradient-to-r from-brand to-brand-hi text-white' : 'well text-ink-faint',
            )}
          >
            <span className="sr-only">{piece}</span>
            <span aria-hidden="true">{index + 1}</span>
          </li>
        ))}
      </ol>
      {pieces[0] ? <p className="text-xs text-ink-muted">Agora: <span className="font-medium text-ink">{pieces[0]}</span></p> : null}
    </div>
  )
}

/** Uma coisa acesa, o resto esperando. */
function FocusStack({ highlight, others }: { readonly highlight: string; readonly others: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-hi px-3.5 py-3 text-sm font-semibold text-white">
        <Icon name="objetivo" className="size-4 shrink-0" />
        <span className="truncate">{highlight}</span>
      </p>
      <span className="sr-only">O resto espera o primeiro marco.</span>
      {Array.from({ length: others }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="well h-3 rounded-full"
          style={{ width: `${86 - index * 14}%`, opacity: 0.8 - index * 0.2 }}
        />
      ))}
    </div>
  )
}

/** Os dias da semana do plano, e o ajuste fechando o ciclo. */
function ReviewLoop({ days }: { readonly days: number }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`${days} dias de plano e um ajuste no fim da semana`}>
      {Array.from({ length: days }, (_, index) => (
        <span key={index} aria-hidden="true" className="h-2 flex-1 rounded-full bg-brand/60" />
      ))}
      <span aria-hidden="true" className="ml-1 grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white">
        <Icon name="retomar" className="size-4" />
      </span>
    </div>
  )
}
