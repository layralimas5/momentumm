import { motion } from 'framer-motion'
import {
  MOMENTUM_LEVEL_LABELS,
  MOMENTUM_WINDOW_DAYS,
  type MomentumScore,
} from '@/domain/entities/momentum'
import type { Streak } from '@/domain/entities/streak'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'

interface MomentumCardProps {
  readonly momentum: MomentumScore
  readonly recommendation: string
  readonly streak: Streak
}

/**
 * O ritmo do dia em um número — sempre acompanhado da leitura dele.
 *
 * Número sozinho aqui seria enfeite: 62 não diz nada. O que muda a decisão é
 * "retomando, 8 acima da semana passada, então não tenta compensar hoje".
 */
export function MomentumCard({ momentum, recommendation, streak }: MomentumCardProps) {
  const tone =
    momentum.level === 'avancando'
      ? 'positive'
      : momentum.level === 'desacelerando'
        ? 'warn'
        : 'brand'

  return (
    <Panel aria-labelledby="momentum-titulo" className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="momentum-titulo"
            className="text-sm font-semibold tracking-wide text-ink-muted uppercase"
          >
            Seu Momentumm de hoje
          </h2>

          <div className="mt-3 flex items-end gap-3">
            <motion.span
              key={momentum.value}
              initial={{ opacity: 0.4, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="text-gradient-brand tabular text-5xl leading-none font-semibold tracking-tight"
            >
              {momentum.value}
            </motion.span>
            <span className="pb-1 text-sm text-ink-faint">de 100</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Tag tone={tone}>{MOMENTUM_LEVEL_LABELS[momentum.level]}</Tag>
            <DeltaTag delta={momentum.delta} />
            {streak.current > 0 ? (
              <Tag tone={streak.atRisk ? 'warn' : 'neutral'}>
                <Icon name="fogo" className="size-3.5" />
                {streak.current} {streak.current === 1 ? 'dia' : 'dias'}
              </Tag>
            ) : null}
          </div>
        </div>

        <Gauge value={momentum.value} />
      </div>

      <p className="mt-4 text-sm text-ink-muted">{momentum.explanation}</p>

      <p className="mt-4 flex gap-2.5 rounded-xl border border-brand/25 bg-brand-dim/25 px-3.5 py-3 text-sm text-ink xl:mt-auto">
        <Icon name="raio" className="mt-0.5 size-4 shrink-0 text-brand-hi" />
        <span>{recommendation}</span>
      </p>
    </Panel>
  )
}

function DeltaTag({ delta }: { delta: number }) {
  if (delta === 0) return <Tag>Estável na semana</Tag>
  return (
    <Tag tone={delta > 0 ? 'positive' : 'neutral'}>
      {delta > 0 ? '+' : '−'}
      {Math.abs(delta)} vs. últimos {MOMENTUM_WINDOW_DAYS} dias
    </Tag>
  )
}

const GAUGE_RADIUS = 34
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS

/** Anel do score. Uma leitura só: quanto do arco está preenchido. */
function Gauge({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" className={cn('size-20 shrink-0 -rotate-90')}>
      <circle cx="40" cy="40" r={GAUGE_RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="5" />
      <circle
        cx="40"
        cy="40"
        r={GAUGE_RADIUS}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={GAUGE_CIRCUMFERENCE}
        strokeDashoffset={GAUGE_CIRCUMFERENCE * (1 - value / 100)}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  )
}
