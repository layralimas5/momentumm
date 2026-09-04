import { useMemo, useState } from 'react'
import {
  groupByDay,
  totalMinutes,
  totalValueOfType,
  type Activity,
} from '@/domain/entities/activity'
import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import { formatDayLabel, type DayKey } from '@/domain/entities/day'
import { ActivityRow } from '@/presentation/components/activity/ActivityRow'
import { QuickLog } from '@/presentation/components/activity/QuickLog'
import { StreakCard } from '@/presentation/components/activity/StreakCard'
import { Stat, StatGrid } from '@/presentation/components/ui/Stat'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { useIsDesktop } from '@/presentation/hooks/use-media-query'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { PageHeader } from './PageHeader'

type Filter = ActivityTypeSlug | 'todos'

/**
 * Minha Jornada: o histórico completo.
 *
 * No desktop o registro rápido e a sequência ficam na coluna lateral, ao lado
 * do histórico: há largura pra ver as duas coisas ao mesmo tempo.
 *
 * No celular não há. Lá a sequência ABRE a página, porque é a resposta que traz
 * a pessoa aqui — "eu não parei" — e no fim da rolagem, depois de semanas de
 * histórico, ela simplesmente não é vista.
 */
export function ActivitiesPage() {
  const { activities, today, loading, error, removeActivity, streak, logActivity, axes } =
    usePlanner()
  const [filter, setFilter] = useState<Filter>('todos')
  const isDesktop = useIsDesktop()

  const filtered = useMemo(
    () => (filter === 'todos' ? activities : activities.filter((item) => item.type === filter)),
    [activities, filter],
  )

  const days = useMemo(() => {
    const grouped = groupByDay(filtered)
    return [...grouped.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [filtered])

  const activeDays = useMemo(
    () => new Set<DayKey>(activities.map((activity) => activity.day)),
    [activities],
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Minha Jornada"
        description="Tudo que você já registrou, do mais recente. É aqui que a evolução deixa de ser sensação."
      />

      {error ? <ErrorNote message={error} /> : null}

      {isDesktop ? null : (
        <StreakCard streak={streak} today={today} activeDays={activeDays} />
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por área">
            <FilterChip
              label="Todos"
              active={filter === 'todos'}
              onClick={() => setFilter('todos')}
            />
            {axes.map((type) => (
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
              <Summary activities={filtered} days={days.length} />

              {/* Cada dia é um bloco fechado, então duas colunas no desktop não quebram a leitura. */}
              <div className="grid gap-4 2xl:grid-cols-2 2xl:items-start">
                {days.map(([day, items]) => (
                  <section key={day} aria-label={formatDayLabel(day as DayKey, today)}>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-medium text-ink-muted">
                        {formatDayLabel(day as DayKey, today)}
                      </h3>
                      <span className="tabular text-xs text-ink-faint">
                        {totalMinutes(items)} min · {items.length}{' '}
                        {items.length === 1 ? 'registro' : 'registros'}
                      </span>
                    </div>
                    <ul className="mt-2 rounded-card border border-line bg-surface px-4">
                      {items.map((activity) => (
                        <ActivityRow
                          key={activity.id}
                          activity={activity}
                          onRemove={removeActivity}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-24">
          <QuickLog onLog={logActivity} />
          {isDesktop ? (
            <StreakCard streak={streak} today={today} activeDays={activeDays} />
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function Summary({ activities, days }: { activities: readonly Activity[]; days: number }) {
  const minutes = totalMinutes(activities)
  const hours = Math.floor(minutes / 60)
  const pages = totalValueOfType(activities, 'leitura')

  return (
    <StatGrid>
      <Stat label="Registros" value={String(activities.length)} />
      <Stat label="Tempo" value={hours > 0 ? `${hours}h` : `${minutes}min`} />
      <Stat label="Páginas" value={String(pages)} />
      {/* Só renderizado quando existe pelo menos um dia, então a média é segura. */}
      <Stat
        label="Dias ativos"
        value={String(days)}
        hint={`${Math.round(minutes / days)} min por dia`}
      />
    </StatGrid>
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
