import { useMemo } from 'react'
import { totalMinutes } from '@/domain/entities/activity'
import { activityType } from '@/domain/entities/activity-type'
import { addDays, formatDayLabel } from '@/domain/entities/day'
import { FocusCard } from '@/presentation/components/dashboard/FocusCard'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, ProgressBar } from '@/presentation/components/ui/Surface'
import { useDashboard } from '@/presentation/planner/use-dashboard'
import { usePlanner } from '@/presentation/planner/use-planner'
import { PageHeader } from './PageHeader'

const HISTORY_DAYS = 7

/** Foco: iniciar a sessão e ver onde o tempo concentrado foi parar na semana. */
export function FocusPage() {
  const planner = usePlanner()
  const view = useDashboard()

  const sessions = useMemo(
    () => planner.activities.filter((activity) => activity.source === 'timer').slice(0, 12),
    [planner.activities],
  )

  const week = useMemo(() => {
    const start = addDays(planner.today, -(HISTORY_DAYS - 1))
    const inWeek = planner.activities.filter(
      (activity) => activity.day >= start && activity.day <= planner.today,
    )
    const total = totalMinutes(inWeek)

    return {
      total,
      byAxis: (['leitura', 'estudo', 'treino', 'meditacao'] as const).map((slug) => {
        const minutes = totalMinutes(inWeek.filter((activity) => activity.type === slug))
        return { type: activityType(slug), minutes, ratio: total === 0 ? 0 : minutes / total }
      }),
    }
  }, [planner.activities, planner.today])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Foco"
        description="Sessão cronometrada que vira registro sozinha. O tempo conta por relógio real, não por aba aberta."
      />

      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start 2xl:grid-cols-[25rem_minmax(0,1fr)]">
        <FocusCard
          task={view.mainPriority}
          capacity={view.capacity}
          minutesToday={view.focusMinutesToday}
          limits={planner.limits}
        />

        <div className="flex min-w-0 flex-col gap-5">
          <Panel aria-labelledby="distribuicao-titulo">
            <PanelHeader
              id="distribuicao-titulo"
              title="Onde seu tempo foi parar"
              icon="hoje"
              hint={`${week.total} minutos nos últimos ${HISTORY_DAYS} dias.`}
            />

            {week.total === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                Nenhum minuto registrado na semana. A primeira sessão já preenche esse quadro.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {week.byAxis.map((item) => (
                  <li key={item.type.slug} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm text-ink-muted">{item.type.label}</span>
                    <ProgressBar
                      className="flex-1"
                      value={item.ratio}
                      label={`Minutos em ${item.type.label}`}
                      color={item.type.colorToken}
                    />
                    <span className="tabular w-16 shrink-0 text-right text-sm text-ink-faint">
                      {item.minutes} min
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel aria-labelledby="sessoes-titulo">
            <PanelHeader id="sessoes-titulo" title="Últimas sessões" icon="relogio" />

            {sessions.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="Nenhuma sessão de foco ainda"
                  description="Começa uma sessão pela prioridade do dia. No fim, ela vira registro sem você digitar nada."
                />
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {sessions.map((activity) => {
                  const type = activityType(activity.type)
                  return (
                    <li
                      key={activity.id}
                      className="flex items-center gap-3 rounded-xl border border-line bg-surface-hi/50 px-3.5 py-2.5"
                    >
                      <span aria-hidden="true" style={{ color: type.colorToken }}>
                        <Icon name="foco" className="size-4 shrink-0" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">
                          {activity.note ?? type.label}
                        </p>
                        <p className="text-xs text-ink-faint">
                          {formatDayLabel(activity.day, planner.today)} ·{' '}
                          {activity.occurredAt.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-sm text-ink-muted">
                        {activity.durationMin} min
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
