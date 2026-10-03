import { useEffect, useState, type ReactNode } from 'react'
import { animate, motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

/** Barra fina com trilho afundado. `value` de 0 a 1. */
export function ProgressBar({
  value,
  label,
  className,
  size = 'md',
}: {
  readonly value: number
  readonly label: string
  readonly className?: string
  readonly size?: 'sm' | 'md'
}) {
  const reduce = useReducedMotion()
  const ratio = clamp(value)

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className={cn('well overflow-hidden rounded-full', size === 'sm' ? 'h-1.5' : 'h-2', className)}
    >
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-brand to-brand-hi"
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${ratio * 100}%` }}
        transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}

/** Anel de progresso com o conteúdo no centro. */
export function ProgressRing({
  value,
  label,
  size = 104,
  stroke = 9,
  children,
  className,
}: {
  readonly value: number
  readonly label: string
  readonly size?: number
  readonly stroke?: number
  readonly children?: ReactNode
  readonly className?: string
}) {
  const reduce = useReducedMotion()
  const ratio = clamp(value)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('well relative grid shrink-0 place-items-center rounded-full', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-top)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className="ring-glow"
          initial={reduce ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={{ duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  )
}

/** Número que conta até o valor quando aparece ou muda. */
export function AnimatedNumber({
  value,
  className,
  format = (n) => n.toLocaleString('pt-BR'),
}: {
  readonly value: number
  readonly className?: string
  readonly format?: (value: number) => string
}) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      setShown(value)
      return
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setShown(Math.round(latest)),
    })
    return () => controls.stop()
  }, [value, reduce])

  return <span className={cn('tabular', className)}>{format(shown)}</span>
}
