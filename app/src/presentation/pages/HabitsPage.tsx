import { activityType } from '@/domain/entities/activity-type'
import { addDays } from '@/domain/entities/day'
import {
  countsAsDone,
  DAY_PART_LABELS,
  frequencyLabel,
  habitStreak,
  habitTargetLabel,
  isScheduledOn,
  statusOf,
} from '@/domain/entities/habit'
import { checkLimit } from '@/domain/entities/plan'
import { Button } from '@/presentation/components/ui/Button'
import { HabitGlyph, Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote } from '@/presentation/components/ui/States'
import { Panel, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { UpgradeHint } from '@/presentation/components/dashboard/UpgradeHint'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { usePlanner } from '@/presentation/planner/use-planner'
import { PageHeader } from './PageHeader'
import { cn } from '@/shared/lib/cn'

const HISTORY_DAYS = 14

/**
 * Hábitos.
 *
 * A tela mostra constância, não cobrança: cada hábito traz as últimas duas
 * semanas em quadradinhos, e dia perdido é um quadrado apagado — não um alerta
 * vermelho.
 */
export function HabitsPage() {
  const planner = usePlanner()
  const composer = useComposer()

  const limit = checkLimit(planner.habits.length, planner.limits.activeHabits, 'hábitos ativos')

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Hábitos"
        description="A repetição que sustenta o resto. Poucos e pequenos ganham de muitos e ambiciosos."
        action={
          <Button onClick={() => composer.open('habito')} disabled={limit.reached}>
            <Icon name="mais" className="size-4" />
            Novo hábito
          </Button>
        }
      />

      {planner.error ? <ErrorNote message={planner.error} /> : null}
      {limit.message ? <UpgradeHint message={limit.message} /> : null}

      {planner.habits.length === 0 ? (
        <EmptyState
          title="Nenhum hábito ainda"
          description="Começa com um só, do tamanho que sobrevive a uma semana ruim. O segundo entra quando o primeiro virar automático."
          action={
            <Button onClick={() => composer.open('habito')}>
              <Icon name="mais" className="size-4" />
              Criar meu primeiro hábito
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {planner.habits.map((habit) => {
            const axis = activityType(habit.axis)
            const status = statusOf(planner.habitLogs, habit.id, planner.today)
            const streak = habitStreak(habit, planner.habitLogs, planner.today)
            const done = countsAsDone(status)

            const history = Array.from({ length: HISTORY_DAYS }, (_, index) =>
              addDays(planner.today, index - (HISTORY_DAYS - 1)),
            )
            const kept = history.filter(
              (day) =>
                isScheduledOn(habit, day) &&
                countsAsDone(statusOf(planner.habitLogs, habit.id, day)),
            ).length
            const scheduled = history.filter((day) => isScheduledOn(habit, day)).length

            return (
              <li key={habit.id}>
                <Panel className="flex h-full flex-col">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-hi"
                      style={{ color: axis.colorToken }}
                    >
                      <HabitGlyph icon={habit.icon} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{habit.name}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-faint">
                        {axis.label} · {DAY_PART_LABELS[habit.dayPart]} · {frequencyLabel(habit)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void planner.archiveHabit(habit.id)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-surface-hi hover:text-danger"
                    >
                      Arquivar
                      <span className="sr-only"> o hábito {habit.name}</span>
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Tag color={axis.colorToken}>{habitTargetLabel(habit)}</Tag>
                    <Tag>Mínimo: {habitTargetLabel(habit, habit.minimalTarget)}</Tag>
                    {streak > 0 ? (
                      <Tag tone="warn">
                        <Icon name="fogo" className="size-3.5" />
                        {streak} {streak === 1 ? 'dia' : 'dias'}
                      </Tag>
                    ) : null}
                  </div>

                  <ol
                    className="mt-4 flex gap-1"
                    aria-label={`Últimos ${HISTORY_DAYS} dias de ${habit.name}`}
                  >
                    {history.map((day) => {
                      const dayStatus = statusOf(planner.habitLogs, habit.id, day)
                      const scheduledDay = isScheduledOn(habit, day)
                      return (
                        <li key={day} className="flex-1">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'block h-6 rounded-sm border transition-colors',
                              !scheduledDay
                                ? 'border-transparent bg-surface-hi/40'
                                : countsAsDone(dayStatus)
                                  ? 'border-transparent bg-brand'
                                  : day === planner.today
                                    ? 'border-brand bg-surface-hi'
                                    : 'border-line bg-surface-hi',
                            )}
                          />
                          <span className="sr-only">
                            {day}:{' '}
                            {!scheduledDay
                              ? 'fora da frequência'
                              : countsAsDone(dayStatus)
                                ? 'cumprido'
                                : 'sem registro'}
                          </span>
                        </li>
                      )
                    })}
                  </ol>

                  <div className="mt-3 flex items-center gap-3">
                    <ProgressBar
                      className="flex-1"
                      value={scheduled === 0 ? 0 : kept / scheduled}
                      label={`Constância de ${habit.name} nos últimos ${HISTORY_DAYS} dias`}
                      color={axis.colorToken}
                    />
                    <span className="tabular shrink-0 text-xs text-ink-faint">
                      {kept}/{scheduled}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                    <Button
                      size="sm"
                      variant={done ? 'secondary' : 'primary'}
                      onClick={() =>
                        void planner.setHabitStatus(habit.id, done ? 'pendente' : 'feito')
                      }
                    >
                      <Icon name={done ? 'desfazer' : 'check'} className="size-4" />
                      {done ? 'Desfazer hoje' : 'Concluir hoje'}
                    </Button>
                    {done ? null : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void planner.setHabitStatus(habit.id, 'minimo')}
                      >
                        <Icon name="minimo" className="size-4" />
                        Versão mínima
                      </Button>
                    )}
                  </div>
                </Panel>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
