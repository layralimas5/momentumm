import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * Moldura de celular desenhada em CSS, não em imagem: fica nítida em qualquer
 * tela, não pesa no LCP e não trava a landing esperando print do app.
 *
 * As primitivas abaixo (MockCard, MockTag, MockProgress...) reproduzem a
 * linguagem do dashboard real (surface-card, Tag, ProgressBar) sem importar o
 * dashboard: a landing não pode depender do PlannerProvider pra renderizar um
 * print.
 */
export function PhoneMockup({
  children,
  className,
  tall = false,
}: {
  children: ReactNode
  className?: string
  /** Altura maior pra telas com mais conteúdo (hero). */
  tall?: boolean
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative mx-auto w-full max-w-[300px] rounded-[2.5rem] border border-line-hi bg-surface p-2.5 shadow-2xl shadow-black/40',
        className,
      )}
    >
      <div className="absolute left-1/2 top-3.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-canvas" />
      <div
        className={cn(
          'overflow-hidden rounded-[2rem] bg-canvas px-3.5 pb-4 pt-10',
          tall ? 'h-[600px]' : 'h-[540px]',
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function MockHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-3">
      <p className="text-[11px] text-ink-faint">{subtitle}</p>
      <p className="text-base font-semibold text-ink">{title}</p>
    </header>
  )
}

export function MockCard({
  children,
  className,
  tone = 'plain',
}: {
  children: ReactNode
  className?: string
  tone?: 'plain' | 'brand'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl p-3',
        tone === 'brand' ? 'surface-brand edge-light' : 'border border-line bg-surface',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function MockLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
      {children}
    </p>
  )
}

const TAG_TONES = {
  neutral: 'border-line text-ink-muted',
  brand: 'border-brand/40 bg-brand-dim/40 text-brand-ink',
  positive: 'border-positive/30 bg-positive/10 text-positive',
  warn: 'border-flame/30 bg-flame-dim/50 text-flame',
} as const

export function MockTag({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: keyof typeof TAG_TONES
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        TAG_TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

export function MockProgress({
  value,
  color,
  className,
}: {
  /** 0 a 1. */
  value: number
  color?: string
  className?: string
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-surface-top', className)}>
      <span
        className="block h-full rounded-full"
        style={{ width: `${percent}%`, backgroundColor: color ?? 'var(--color-brand)' }}
      />
    </div>
  )
}

export function MockCheck({ done = false, color }: { done?: boolean; color?: string | undefined }) {
  return (
    <span
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-full border',
        done ? 'border-transparent' : 'border-line-hi',
      )}
      style={done ? { backgroundColor: color ?? 'var(--color-brand)' } : undefined}
    >
      {done ? (
        <svg viewBox="0 0 24 24" className="size-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 13 4 4L19 7" />
        </svg>
      ) : null}
    </span>
  )
}

/** Uma linha de item (hábito ou ação) do jeito que aparece no dashboard. */
export function MockRow({
  label,
  meta,
  done = false,
  color,
}: {
  label: string
  meta?: string
  done?: boolean
  color?: string
}) {
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <MockCheck done={done} color={color} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-xs', done ? 'text-ink-faint line-through' : 'text-ink')}>
          {label}
        </span>
        {meta ? <span className="block truncate text-[10px] text-ink-faint">{meta}</span> : null}
      </span>
    </li>
  )
}

/** A faixa do Momentumm, como no topo do `Hoje`. */
export function MockMomentum({
  value,
  level,
  delta,
  streak,
}: {
  value: number
  level: string
  delta: number
  streak: number
}) {
  return (
    <MockCard className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="flex items-baseline gap-1.5">
        <span className="text-gradient-brand tabular text-2xl font-semibold leading-none tracking-tight">
          {value}
        </span>
        <span className="text-[10px] text-ink-faint">Momentumm</span>
      </span>
      <MockTag tone={level === 'Avançando' ? 'positive' : level === 'Desacelerando' ? 'warn' : 'brand'}>
        {level}
      </MockTag>
      <span className={cn('tabular text-[10px]', delta >= 0 ? 'text-positive' : 'text-flame')}>
        {delta >= 0 ? '+' : ''}
        {delta} nesta semana
      </span>
      <span className="tabular inline-flex items-center gap-1 text-[10px] text-ink-faint">
        <FlameIcon />
        {streak} dias
      </span>
    </MockCard>
  )
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3 text-flame" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c.6 3-1.3 4.4-2.6 5.8C8.1 10.1 7.2 11.3 7.2 13a4.8 4.8 0 0 0 9.6 0c0-1.5-.6-2.7-1.4-3.7-.3 1-.9 1.6-1.7 1.8.5-2.5-.4-5.8-1.7-8.1Z" />
    </svg>
  )
}

/** Curva pequena de 14 pontos, como a do progresso. */
export function MockSparkline({ points, color }: { points: readonly number[]; color?: string }) {
  const max = Math.max(...points, 1)
  const width = 100
  const height = 32
  const step = width / Math.max(points.length - 1, 1)
  const path = points
    .map((point, index) => {
      const x = index * step
      const y = height - (point / max) * (height - 4) - 2
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-full" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color ?? 'var(--color-brand-hi)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
