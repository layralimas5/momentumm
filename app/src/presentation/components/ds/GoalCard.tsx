import { Link } from 'react-router-dom'
import type { StageProgress } from '@/domain/entities/plan-progress'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { StatusTag } from './Badges'
import { ProgressBar } from './Progress'

export interface GoalCardData {
  readonly id: string
  readonly title: string
  /** 0 a 1. */
  readonly ratio: number
  /** Pontos percentuais ganhos no mês. Null quando não dá pra medir. */
  readonly monthGain: number | null
  readonly daysLeft: number | null
  readonly nextMilestone: string | null
  readonly alert: string | null
  readonly dimmed?: boolean
}

/** O objetivo como jornada: porcentagem grande, barra, prazo e o próximo marco. */
export function GoalCard({ goal, featured = false }: { readonly goal: GoalCardData; readonly featured?: boolean }) {
  const pct = Math.round(goal.ratio * 100)

  return (
    <Link
      to={`/app/objetivos/${goal.id}`}
      className={cn('card press block p-5', featured && 'card-float', goal.dimmed && 'opacity-80')}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className={cn('min-w-0 font-semibold tracking-tight text-ink', featured ? 'text-lg' : 'text-[0.95rem]')}>
          {goal.title}
        </h3>
        <span className={cn('shrink-0 font-bold text-brand-hi tabular', featured ? 'text-2xl' : 'text-lg')}>
          {pct}%
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        {goal.monthGain !== null && goal.monthGain > 0 ? (
          <StatusTag tone="brand" icon="tendencia">
            +{goal.monthGain}% este mês
          </StatusTag>
        ) : null}
        {goal.alert ? <StatusTag tone="flame">{goal.alert}</StatusTag> : null}
      </div>

      <ProgressBar value={goal.ratio} label={`${goal.title}: ${pct}%`} className="mt-4" />

      {goal.daysLeft !== null || goal.nextMilestone ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {goal.daysLeft !== null ? (
            <div className="well rounded-2xl px-3 py-2.5">
              <dt className="eyebrow text-[0.6rem] text-ink-faint">Prazo</dt>
              <dd className="mt-0.5 font-semibold text-ink tabular">
                {goal.daysLeft} {goal.daysLeft === 1 ? 'dia' : 'dias'}
              </dd>
            </div>
          ) : null}
          {goal.nextMilestone ? (
            <div className="well min-w-0 rounded-2xl px-3 py-2.5">
              <dt className="eyebrow text-[0.6rem] text-ink-faint">Próximo marco</dt>
              <dd className="mt-0.5 truncate font-semibold text-ink">{goal.nextMilestone}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </Link>
  )
}

/** Os marcos (etapas) numa linha do tempo curta: feito, em curso, por vir. */
export function MilestoneTimeline({ stages }: { readonly stages: readonly StageProgress[] }) {
  const currentIndex = stages.findIndex((stage) => stage.status !== 'concluida')

  return (
    <ol className="flex flex-col">
      {stages.map((stage, index) => {
        const done = stage.status === 'concluida'
        const current = index === currentIndex
        const last = index === stages.length - 1
        return (
          <li key={stage.stage.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
            <span className="relative flex justify-center" aria-hidden="true">
              {last ? null : <span className={cn('absolute top-6 bottom-0 w-0.5', done ? 'bg-brand/50' : 'bg-line-hi')} />}
              <span
                className={cn(
                  'relative mt-1 grid size-5 place-items-center rounded-full',
                  done && 'bg-brand text-white',
                  current && 'bg-brand-dim ring-2 ring-brand',
                  !done && !current && 'well',
                )}
              >
                {done ? <Icon name="check" className="size-3" strokeWidth={3} /> : null}
              </span>
            </span>
            <p
              className={cn(
                'pb-4 text-sm',
                done ? 'text-ink-muted' : current ? 'font-semibold text-ink' : 'text-ink-faint',
              )}
            >
              {stage.stage.title}
              <span className="sr-only">{done ? ', concluído' : current ? ', em andamento' : ', por vir'}</span>
            </p>
          </li>
        )
      })}
    </ol>
  )
}
