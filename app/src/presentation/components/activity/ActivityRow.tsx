import type { Activity } from '@/domain/entities/activity'
import { describeActivity } from '@/domain/entities/activity'
import { activityType } from '@/domain/entities/activity-type'

interface ActivityRowProps {
  readonly activity: Activity
  readonly onRemove?: (id: string) => void
}

export function ActivityRow({ activity, onRemove }: ActivityRowProps) {
  const type = activityType(activity.type)
  const time = activity.occurredAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: type.colorToken }}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">
          <span className="font-medium">{type.label}</span>
          <span className="text-ink-muted"> · {describeActivity(activity)}</span>
        </p>
        {activity.note ? (
          <p className="mt-0.5 truncate text-xs text-ink-faint">{activity.note}</p>
        ) : null}
      </div>

      <span className="tabular shrink-0 text-xs text-ink-faint">{time}</span>

      {onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(activity.id)}
          className="tap-target shrink-0 rounded-md px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-surface-hi hover:text-danger"
        >
          Apagar
          <span className="sr-only"> {describeActivity(activity)}</span>
        </button>
      ) : null}
    </li>
  )
}
