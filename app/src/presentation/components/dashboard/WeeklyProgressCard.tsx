import { dayKeyToDate } from '@/domain/entities/day'
import type { PlanLimits } from '@/domain/entities/plan'
import { deltaLabel, type WeeklySummary } from '@/domain/entities/week'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, PanelHeader } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'
import { UpgradeHint } from './UpgradeHint'

interface WeeklyProgressCardProps {
  readonly week: WeeklySummary
  readonly limits: PlanLimits
}

const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const

/**
 * Progresso semanal.
 *
 * Sete barras e uma frase. Gráfico bonito que exige interpretação não serve —
 * o que decide a semana seguinte é a conclusão escrita embaixo, não a curva.
 */
export function WeeklyProgressCard({ week, limits }: WeeklyProgressCardProps) {
  const { current, previous, series } = week
  const peak = Math.max(...series.map((day) => day.minutes), 1)

  return (
    <Panel aria-labelledby="semana-titulo">
      <PanelHeader id="semana-titulo" title="Progresso semanal" icon="hoje" />

      <ol className="mt-5 flex items-end justify-between gap-1.5" aria-label="Últimos sete dias">
        {series.map((day, index) => {
          const isToday = index === series.length - 1
          const height = Math.max(6, Math.round((day.minutes / peak) * 72))
          const weekday = WEEKDAY_INITIALS[dayKeyToDate(day.day).getDay()]

          return (
            <li key={day.day} className="flex flex-1 flex-col items-center gap-2">
              <span className="flex h-20 w-full items-end">
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-full rounded-md transition-[height] duration-500 ease-out',
                    day.intensity > 0.6
                      ? 'bg-brand'
                      : day.intensity > 0
                        ? 'bg-brand/45'
                        : 'bg-surface-top',
                    isToday && 'ring-1 ring-brand-hi',
                  )}
                  style={{ height: `${height}px` }}
                />
              </span>
              <span className={cn('text-xs', isToday ? 'text-ink' : 'text-ink-faint')}>
                {weekday}
              </span>
              <span className="sr-only">
                {day.day}: {day.minutes} minutos, {day.habitsDone} hábitos,{' '}
                {day.tasksDone} ações concluídas
              </span>
            </li>
          )
        })}
      </ol>

      <dl className="mt-5 grid grid-cols-3 gap-2">
        <Metric
          label="Hábitos"
          value={current.habitsDone}
          delta={limits.advancedAnalytics ? deltaLabel(current.habitsDone, previous.habitsDone, '') : null}
        />
        <Metric
          label="Ações"
          value={current.tasksDone}
          delta={limits.advancedAnalytics ? deltaLabel(current.tasksDone, previous.tasksDone, '') : null}
        />
        <Metric
          label="Minutos"
          value={current.focusMinutes}
          delta={
            limits.advancedAnalytics
              ? deltaLabel(current.focusMinutes, previous.focusMinutes, '')
              : null
          }
        />
      </dl>

      <p className="mt-4 flex gap-2.5 border-t border-line pt-4 text-sm text-ink-muted">
        <Icon name="insights" className="mt-0.5 size-4 shrink-0 text-ink-faint" />
        <span>{week.conclusion}</span>
      </p>

      {limits.advancedAnalytics ? null : (
        <UpgradeHint
          className="mt-3"
          message="Comparação com semanas anteriores e relatório mensal ficam no PRO."
        />
      )}
    </Panel>
  )
}

function Metric({
  label,
  value,
  delta,
}: {
  label: string
  value: number
  delta: string | null
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-hi/50 px-3 py-2.5">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="tabular mt-0.5 text-xl font-semibold text-ink">{value}</dd>
      {delta ? <p className="mt-0.5 truncate text-xs text-ink-faint">{delta}</p> : null}
    </div>
  )
}
