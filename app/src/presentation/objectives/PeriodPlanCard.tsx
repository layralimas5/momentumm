import { useMemo, useState } from 'react'
import { activityType, formatUnit } from '@/domain/entities/activity-type'
import { dayKeyToDate, formatDayLabel, type DayKey } from '@/domain/entities/day'
import { XP_RULES } from '@/domain/entities/evolution'
import { frequencyLabel } from '@/domain/entities/habit'
import { buildPeriodPlan, type PlanPeriod } from '@/domain/entities/period-plan'
import type { Task } from '@/domain/entities/task'
import { StatusTag } from '@/presentation/components/ds/Badges'
import { Card } from '@/presentation/components/ds/Card'
import { CheckButton } from '@/presentation/components/ds/Controls'
import { Icon } from '@/presentation/components/ui/Icon'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import type { ObjectiveView } from '@/presentation/planner/use-objectives'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'

function rangeLabel(period: PlanPeriod): string {
  const format = (day: DayKey) =>
    dayKeyToDate(day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
  return period.start === period.end ? format(period.start) : `${format(period.start)} a ${format(period.end)}`
}

/** Buraco que pesa: uma etapa vence aqui e nenhuma ação foi marcada pra ela. */
function atRisk(period: PlanPeriod): boolean {
  return period.gap && period.milestones.length > 0
}

function countOf(period: PlanPeriod): number {
  return period.milestones.length + period.tasks.length + period.overdue.length
}

/**
 * O plano do objetivo destrinchado no tempo: o que fazer esta semana, no resto
 * do mês e em cada mês até o prazo. A semana abre aberta; o resto, recolhido.
 */
export function PeriodPlanCard({ view }: { readonly view: ObjectiveView }) {
  const planner = usePlanner()
  const composer = useComposer()
  const { objective } = view.progress

  const periods = useMemo(
    () =>
      buildPeriodPlan({
        today: planner.today,
        deadline: objective.deadline,
        stages: view.plan.stages.map((item) => item.stage),
        openTasks: view.openTasks,
        dailyPace: view.ratioSource === 'volume' && view.progress.remaining > 0 ? view.progress.dailyPace : null,
      }),
    [planner.today, objective.deadline, view],
  )

  const [open, setOpen] = useState<string | null>(periods[0]?.key ?? null)
  const axis = planner.axes.find((item) => item.slug === objective.axis) ?? activityType(objective.axis)
  const habits = view.habits.map((entry) => entry.habit)

  const planActions = (period: PlanPeriod) =>
    composer.open('acao', {
      presetObjectiveId: objective.id,
      presetStageId: period.focusStage?.id ?? null,
      presetDay: period.start,
    })

  return (
    <Card aria-labelledby={`plano-${objective.id}`} padded={false}>
      <div className="px-5 pt-5 pb-3">
        <h3 id={`plano-${objective.id}`} className="eyebrow text-[0.72rem] text-ink-muted">
          Plano por período
        </h3>
        <p className="mt-1 text-sm text-ink-faint">O que precisa sair em cada fase pra chegar no prazo.</p>
      </div>

      {habits.length > 0 ? (
        <div className="mx-5 mb-3 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2.5 well">
          <span className="eyebrow text-[0.6rem] text-ink-faint">Todo período</span>
          {habits.map((habit) => (
            <span key={habit.id} className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Icon name="habitos" className="size-3.5 text-brand-hi" />
              {habit.name} · {frequencyLabel(habit)}
            </span>
          ))}
        </div>
      ) : null}

      <ol className="divide-y divide-line">
        {periods.map((period) => {
          const expanded = open === period.key
          const count = countOf(period)
          return (
            <li key={period.key}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : period.key)}
                aria-expanded={expanded}
                className="press flex min-h-16 w-full items-center gap-3 px-5 py-3 text-left"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2.5 shrink-0 rounded-full',
                    period.kind === 'semana' ? 'bg-brand' : atRisk(period) ? 'bg-flame' : 'bg-line-hi',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.95rem] font-semibold text-ink">{period.label}</span>
                  <span className="block truncate text-xs text-ink-faint">
                    {rangeLabel(period)}
                    {period.focusStage ? ` · Foco: ${period.focusStage.title}` : ''}
                  </span>
                </span>
                {period.gap ? (
                  <StatusTag tone={atRisk(period) ? 'flame' : 'neutral'}>Sem ações</StatusTag>
                ) : count > 0 ? (
                  <StatusTag tone={period.kind === 'semana' ? 'brand' : 'neutral'}>
                    {count} {count === 1 ? 'item' : 'itens'}
                  </StatusTag>
                ) : null}
                <Icon name={expanded ? 'acima' : 'abaixo'} className="size-4 shrink-0 text-ink-faint" />
              </button>

              {expanded ? (
                <div className="flex flex-col gap-2.5 px-5 pb-5">
                  {period.volume !== null ? (
                    <p className="flex items-center gap-2 rounded-2xl bg-brand-dim px-3.5 py-3 text-sm font-medium text-brand-ink">
                      <Icon name="tendencia" className="size-4 shrink-0" />
                      Somar {formatUnit(axis, period.volume)}
                      <span className="font-normal opacity-80">
                        (≈{formatUnit(axis, Math.ceil(view.progress.dailyPace))} por dia)
                      </span>
                    </p>
                  ) : null}

                  {period.milestones.map(({ stage, late }) => (
                    <p key={stage.id} className="flex items-start gap-2.5 text-sm">
                      <Icon name="bandeira" className={cn('mt-0.5 size-4 shrink-0', late ? 'text-flame' : 'text-brand-hi')} />
                      <span className="min-w-0 flex-1 text-ink">
                        Fechar a etapa <strong className="font-semibold">{stage.title}</strong>
                        {stage.dueOn ? (
                          <span className={cn('block text-xs', late ? 'text-flame' : 'text-ink-faint')}>
                            {late ? 'Atrasada desde ' : 'Até '}
                            {formatDayLabel(stage.dueOn, planner.today).toLowerCase()}
                          </span>
                        ) : (
                          <span className="block text-xs text-ink-faint">Sem data: vence com o objetivo</span>
                        )}
                      </span>
                    </p>
                  ))}

                  {[...period.overdue, ...period.tasks].map((task) => (
                    <TaskLine key={task.id} task={task} today={planner.today} late={task.day < planner.today} />
                  ))}

                  {period.gap ? (
                    <p className="text-sm text-pretty text-ink-muted">
                      Nada marcado pra esse período
                      {period.focusStage ? ` e a etapa ${period.focusStage.title} precisa andar` : ''}.
                    </p>
                  ) : null}

                  {!period.gap && count === 0 && period.volume === null ? (
                    <p className="text-sm text-ink-faint">Nada pendente aqui.</p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => planActions(period)}
                    className="mt-1 inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-1 text-sm font-semibold text-brand-hi"
                  >
                    <Icon name="mais" className="size-4" strokeWidth={2.25} />
                    {period.gap ? 'Planejar ações deste período' : 'Adicionar ação'}
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function TaskLine({ task, today, late }: { readonly task: Task; readonly today: DayKey; readonly late: boolean }) {
  const planner = usePlanner()
  const composer = useComposer()

  return (
    <div className="flex items-center gap-3">
      <CheckButton
        done={false}
        onToggle={() => void planner.setTaskDone(task.id, true)}
        label={`Concluir ${task.title}`}
        xp={task.isMainPriority ? XP_RULES.priority_done.points : XP_RULES.task_done.points}
      />
      <button
        type="button"
        onClick={() => composer.open('acao', { editing: task })}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate text-sm text-ink">{task.title}</span>
        <span className={cn('block text-xs', late ? 'text-flame' : 'text-ink-faint')}>
          {late ? 'Atrasada · ' : ''}
          {formatDayLabel(task.day, today)}
        </span>
      </button>
    </div>
  )
}
