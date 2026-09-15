import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'

interface MomentumRingProps {
  readonly value: number
  /** Diâmetro em px. */
  readonly size?: number
  readonly stroke?: number
  readonly className?: string
  readonly children?: React.ReactNode
}

/**
 * O anel do momentum: o número dentro, o arco em volta.
 *
 * O arco preenche na abertura e a cada mudança de valor: é o movimento que
 * faz o score parecer vivo em vez de um número num canto. Sem `prefers-reduced-motion`
 * ele só aparece no lugar.
 */
export function MomentumRing({ value, size = 84, stroke = 7, className, children }: MomentumRingProps) {
  const reduceMotion = useReducedMotion()
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = Math.min(1, Math.max(0, value / 100))

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
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
          stroke="url(#momentum-ring-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="momentum-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-hi)" />
            <stop offset="100%" stopColor="var(--color-brand)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
