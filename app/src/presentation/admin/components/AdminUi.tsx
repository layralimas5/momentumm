import type { ReactNode } from 'react'
import { deltaPercent, formatDelta, PERIOD_LABELS, type Period, type PeriodPreset } from '@/domain/admin/period'
import { Button } from '@/presentation/components/ui/Button'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { cn } from '@/shared/lib/cn'
import { usePeriod } from '../use-period'

/**
 * As peças que todas as telas do painel repetem: cabeçalho, seletor de
 * período, cartão de métrica com comparação, tabela, etiqueta de estado,
 * vazio honesto. Nada aqui conhece o domínio — recebe número e rótulo.
 */

export function AdminPage({
  title,
  description,
  action,
  children,
}: {
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink lg:text-[1.75rem]">{title}</h1>
          <p className="mt-1 max-w-2xl text-pretty text-sm text-ink-muted">{description}</p>
        </div>
        {action ? <div className="w-full min-w-0 sm:w-auto sm:shrink-0">{action}</div> : null}
      </header>
      {children}
    </div>
  )
}

export function PeriodPicker() {
  const { period, preset, setPreset, setCustom } = usePeriod()
  const presets: readonly Exclude<PeriodPreset, 'custom'>[] = ['7d', '30d', '90d']

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <div role="group" aria-label="Período" className="flex rounded-xl border border-line bg-surface p-1">
        {presets.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={preset === item}
            onClick={() => setPreset(item)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              preset === item ? 'bg-surface-top text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {PERIOD_LABELS[item]}
          </button>
        ))}
      </div>
      <label className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-ink-faint">
        <span className="sr-only">Início</span>
        <input
          type="date"
          value={period.from}
          max={period.to}
          onChange={(event) => setCustom({ ...period, from: event.target.value as Period['from'] })}
          className="h-9 min-w-0 max-w-[9.5rem] rounded-lg border border-line bg-surface px-2 text-xs text-ink"
        />
        <span aria-hidden="true">até</span>
        <span className="sr-only">Fim</span>
        <input
          type="date"
          value={period.to}
          min={period.from}
          onChange={(event) => setCustom({ ...period, to: event.target.value as Period['to'] })}
          className="h-9 min-w-0 max-w-[9.5rem] rounded-lg border border-line bg-surface px-2 text-xs text-ink"
        />
      </label>
    </div>
  )
}

export function MetricGrid({ children, cols = 4 }: { readonly children: ReactNode; readonly cols?: 3 | 4 | 5 }) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-2 sm:gap-3',
        cols === 3 && 'md:grid-cols-3',
        cols === 4 && 'md:grid-cols-4',
        cols === 5 && 'md:grid-cols-3 xl:grid-cols-5',
      )}
    >
      {children}
    </dl>
  )
}

interface MetricProps {
  readonly label: string
  readonly value: number | null | undefined
  readonly previous?: number | null | undefined
  readonly format?: 'int' | 'percent' | 'brl' | 'usd' | 'ms' | 'hours'
  readonly hint?: string | undefined
  /** Quando subir é ruim (erro, cancelamento), a cor inverte. */
  readonly lowerIsBetter?: boolean
}

export function Metric({ label, value, previous, format = 'int', hint, lowerIsBetter = false }: MetricProps) {
  const delta = previous === undefined ? undefined : deltaPercent(value ?? null, previous)
  const positive = delta !== null && delta !== undefined && (lowerIsBetter ? delta < 0 : delta > 0)
  const negative = delta !== null && delta !== undefined && (lowerIsBetter ? delta > 0 : delta < 0)

  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="tabular mt-0.5 text-xl font-semibold text-ink sm:text-2xl">{formatValue(value, format)}</dd>
      {delta !== undefined ? (
        <p
          className={cn(
            'mt-0.5 text-xs tabular',
            positive && 'text-positive',
            negative && 'text-danger',
            !positive && !negative && 'text-ink-faint',
          )}
        >
          {formatDelta(delta)} <span className="text-ink-faint">vs período anterior</span>
        </p>
      ) : hint ? (
        <p className="mt-0.5 truncate text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  )
}

export function formatValue(value: number | null | undefined, format: MetricProps['format'] = 'int'): string {
  if (value === null || value === undefined) return '—'
  switch (format) {
    case 'percent':
      return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    case 'brl':
      return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    case 'usd':
      return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    case 'ms':
      return `${Math.round(value).toLocaleString('pt-BR')} ms`
    case 'hours':
      return value >= 48 ? `${(value / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} d` : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
    default:
      return value.toLocaleString('pt-BR')
  }
}

export function Section({
  title,
  hint,
  action,
  children,
}: {
  readonly title: string
  readonly hint?: string | undefined
  readonly action?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <section className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">{title}</h2>
          {hint ? <p className="mt-1 text-sm text-ink-faint">{hint}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function Table({ head, children }: { readonly head: readonly string[]; readonly children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-faint">
            {head.map((label) => (
              <th key={label} scope="col" className="py-2 pr-4 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return <td className={cn('py-2.5 pr-4 align-top text-ink', className)}>{children}</td>
}

export function StatusTag({
  children,
  tone = 'neutral',
}: {
  readonly children: ReactNode
  readonly tone?: 'neutral' | 'brand' | 'positive' | 'warn' | 'danger'
}) {
  const tones = {
    neutral: 'border-line text-ink-muted',
    brand: 'border-brand/40 bg-brand-dim/40 text-brand-ink',
    positive: 'border-positive/30 bg-positive/10 text-positive',
    warn: 'border-flame/30 bg-flame-dim/50 text-flame',
    danger: 'border-danger/40 bg-danger/10 text-danger',
  } as const
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone])}>
      {children}
    </span>
  )
}

export function Empty({ title, description }: { readonly title: string; readonly description: string }) {
  return (
    <div className="rounded-card border border-dashed border-line px-5 py-8 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{description}</p>
    </div>
  )
}

export function QueryState({
  loading,
  error,
  onRetry,
}: {
  readonly loading: boolean
  readonly error: string | null
  readonly onRetry: () => void
}) {
  if (loading) return <LoadingBlock label="Carregando o painel" />
  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <ErrorNote message={error} />
        <Button variant="secondary" size="sm" className="self-start" onClick={onRetry}>
          Tentar de novo
        </Button>
      </div>
    )
  }
  return null
}

export function Pager({
  page,
  total,
  pageSize,
  onPage,
}: {
  readonly page: number
  readonly total: number
  readonly pageSize: number
  readonly onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-faint">
      <span className="tabular">
        Página {page} de {pages} · {total.toLocaleString('pt-BR')} registros
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Próxima
        </Button>
      </div>
    </div>
  )
}

/** Série pequena em SVG, sem biblioteca: uma linha, uma área, nada mais. */
export function Sparkline({
  points,
  label,
  className,
  color = 'var(--color-brand)',
}: {
  readonly points: readonly number[]
  readonly label: string
  readonly className?: string
  readonly color?: string
}) {
  const width = 240
  const height = 56
  const max = Math.max(1, ...points)
  const step = points.length > 1 ? width / (points.length - 1) : width
  const coords = points.map((value, index) => [index * step, height - (value / max) * (height - 4) - 2] as const)
  const path = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = coords.length > 0 ? `${path} L${width},${height} L0,${height} Z` : ''

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
      className={cn('h-14 w-full', className)}
    >
      {area ? <path d={area} fill={color} opacity={0.12} /> : null}
      {path ? <path d={path} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  )
}

/** Barras horizontais pra distribuições (motivo, módulo, recurso). */
export function BarList({
  items,
  labelOf,
  format = 'int',
}: {
  readonly items: Readonly<Record<string, number>>
  readonly labelOf?: (key: string) => string
  readonly format?: MetricProps['format']
}) {
  const entries = Object.entries(items).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, value]) => value))
  if (entries.length === 0) return <p className="text-sm text-ink-faint">Sem registro no período.</p>
  return (
    <ul className="flex flex-col gap-2">
      {entries.map(([key, value]) => (
        <li key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-ink">{labelOf ? labelOf(key) : key}</span>
              <span className="tabular text-xs text-ink-faint">{formatValue(value, format)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-top">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function formatDate(value: Date | null | undefined, withTime = false): string {
  if (!value) return '—'
  return value.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
