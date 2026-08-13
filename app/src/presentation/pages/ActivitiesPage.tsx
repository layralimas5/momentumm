import { useMemo, useState } from 'react'
import { groupByDay, totalMinutes, totalValueOfType } from '@/domain/entities/activity'
import { ACTIVITY_TYPE_LIST, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import { formatDayLabel, type DayKey } from '@/domain/entities/day'
import { ActivityRow } from '@/presentation/components/activity/ActivityRow'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { useActivities } from '@/presentation/hooks/use-activities'
import { cn } from '@/shared/lib/cn'

type Filter = ActivityTypeSlug | 'todos'

export function ActivitiesPage() {
  const { activities, today, loading, error, remove } = useActivities()
  const [filter, setFilter] = useState<Filter>('todos')

  const filtered = useMemo(
    () => (filter === 'todos' ? activities : activities.filter((item) => item.type === filter)),
    [activities, filter],
  )

  const days = useMemo(() => {
    const grouped = groupByDay(filtered)
    return [...grouped.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [filtered])

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Atividades</h1>
        <p className="mt-1 text-sm text-ink-muted">Tudo que você já registrou, do mais recente.</p>
      </header>

      {error ? <ErrorNote message={error} /> : null}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por eixo">
        <FilterChip label="Todos" active={filter === 'todos'} onClick={() => setFilter('todos')} />
        {ACTIVITY_TYPE_LIST.map((type) => (
          <FilterChip
            key={type.slug}
            label={type.label}
            active={filter === type.slug}
            color={type.colorToken}
            onClick={() => setFilter(type.slug)}
          />
        ))}
      </div>

      {loading ? (
        <LoadingBlock label="Carregando o histórico" />
      ) : days.length === 0 ? (
        <EmptyState
          title="Nada por aqui ainda"
          description="Assim que você registrar alguma coisa, o histórico aparece organizado por dia."
        />
      ) : (
        <>
          <Summary activities={filtered} />
          <div className="flex flex-col gap-4">
            {days.map(([day, items]) => (
              <section key={day} aria-label={formatDayLabel(day as DayKey, today)}>
                <h2 className="text-sm font-medium text-ink-muted">
                  {formatDayLabel(day as DayKey, today)}
                </h2>
                <ul className="mt-2 rounded-card border border-line bg-surface px-4">
                  {items.map((activity) => (
                    <ActivityRow key={activity.id} activity={activity} onRemove={remove} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Summary({ activities }: { activities: Parameters<typeof totalMinutes>[0] }) {
  const minutes = totalMinutes(activities)
  const hours = Math.floor(minutes / 60)
  const pages = totalValueOfType(activities, 'leitura')

  return (
    <dl className="grid grid-cols-3 gap-2">
      <Stat label="Registros" value={String(activities.length)} />
      <Stat label="Tempo" value={hours > 0 ? `${hours}h` : `${minutes}min`} />
      <Stat label="Páginas" value={String(pages)} />
    </dl>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="tabular mt-0.5 text-xl font-semibold text-ink">{value}</dd>
    </div>
  )
}

interface FilterChipProps {
  readonly label: string
  readonly active: boolean
  readonly color?: string
  readonly onClick: () => void
}

function FilterChip({ label, active, color, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-transparent text-canvas'
          : 'border-line text-ink-muted hover:border-line-hi hover:text-ink',
      )}
      style={active ? { backgroundColor: color ?? 'var(--color-brand)' } : undefined}
    >
      {label}
    </button>
  )
}
