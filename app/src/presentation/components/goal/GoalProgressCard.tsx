import { motion } from 'framer-motion'
import { activityType } from '@/domain/entities/activity-type'
import { GOAL_PERIOD_LABELS, type GoalProgress } from '@/domain/entities/goal'

interface GoalProgressCardProps {
  readonly progress: GoalProgress
  readonly onArchive?: (id: string) => void
}

export function GoalProgressCard({ progress, onArchive }: GoalProgressCardProps) {
  const type = activityType(progress.goal.type)
  const percent = Math.round(progress.ratio * 100)

  return (
    <li className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">
            {type.label}
            <span className="text-ink-muted"> · {GOAL_PERIOD_LABELS[progress.goal.period]}</span>
          </p>
          <p className="tabular mt-1 text-sm text-ink-muted">
            {progress.done} de {progress.target} {type.unitLabel.many}
            {progress.achieved ? (
              <span className="text-positive"> · meta batida</span>
            ) : progress.goal.period !== 'dia' ? (
              <span className="text-ink-faint">
                {' '}
                · {progress.daysLeft === 0 ? 'último dia' : `faltam ${progress.daysLeft} dias`}
              </span>
            ) : null}
          </p>
        </div>

        {onArchive ? (
          <button
            type="button"
            onClick={() => onArchive(progress.goal.id)}
            className="rounded-md px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-surface-hi hover:text-danger"
          >
            Remover
            <span className="sr-only"> meta de {type.label}</span>
          </button>
        ) : null}
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`Progresso da meta de ${type.label}`}
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-hi"
      >
        <motion.span
          className="block h-full rounded-full"
          style={{ backgroundColor: progress.achieved ? 'var(--color-positive)' : type.colorToken }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </li>
  )
}
