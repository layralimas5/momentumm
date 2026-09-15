import { useState } from 'react'
import { activityType } from '@/domain/entities/activity-type'
import { addDays } from '@/domain/entities/day'
import {
  countsAsDone,
  DAY_PART_LABELS,
  frequencyLabel,
  habitConsistency,
  habitStreak,
  habitTargetLabel,
  isHabitRunning,
  isScheduledOn,
  statusOf,
  type Habit,
} from '@/domain/entities/habit'
import { ObjectiveLink, PriorityTag } from '@/presentation/components/shared/Meta'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { HabitGlyph, Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote } from '@/presentation/components/ui/States'
import { IconButton, Panel, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
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
 * vermelho. A taxa embaixo é "de dez esperadas, quantas saíram", e não
 * sequência: uma falha isolada quase não move esse número, e é justamente isso
 * que impede o produto de virar um cassino de sequência.
 */
export function HabitsPage() {
  const planner = usePlanner()
  const composer = useComposer()

  const active = planner.habits.filter((habit) => habit.archivedAt === null)
  const running = active.filter(isHabitRunning)
  const paused = active.filter((habit) => habit.pausedAt !== null)

  const limit = planner.usage.habits

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Hábitos"
        description="A repetição que segura o plano nos dias em que a vontade não aparece. Por isso a versão mínima conta como cumprida: quebrar a sequência custa mais do que fazer pouco."
        action={
          <Button onClick={() => composer.open('habito')} disabled={limit.reached}>
            <Icon name="mais" className="size-4" />
            Novo hábito
          </Button>
        }
      />

      {planner.error ? <ErrorNote message={planner.error} /> : null}
      {limit.message ? <UpgradeHint message={limit.message} /> : null}

      {active.length === 0 ? (
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
        <div className="flex flex-col gap-6">
          <HabitGroup habits={running} />
          {paused.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
                  Pausados <span className="tabular text-ink-faint">({paused.length})</span>
                </h3>
                <p className="mt-1 text-sm text-ink-faint">
                  Saem do dia e param de contar na consistência. O histórico continua aqui.
                </p>
              </div>
              <HabitGroup habits={paused} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}

function HabitGroup({ habits }: { readonly habits: readonly Habit[] }) {
  if (habits.length === 0) return null

  return (
    <ul className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
      {habits.map((habit) => (
        /*
          `min-w-0` porque item de grid não encolhe abaixo do próprio conteúdo
          por padrão: a linha de nome mais os três botões do card fazem 422px de
          largura mínima, e no celular isso empurrava a página inteira pro lado.
        */
        <li key={habit.id} className="min-w-0">
          <HabitCard habit={habit} />
        </li>
      ))}
    </ul>
  )
}

function HabitCard({ habit }: { readonly habit: Habit }) {
  const planner = usePlanner()
  const composer = useComposer()
  const [confirming, setConfirming] = useState(false)

  const axis = activityType(habit.axis)
  const objective = planner.objectives.find((item) => item.id === habit.objectiveId)
  const status = statusOf(planner.habitLogs, habit.id, planner.today)
  const streak = habitStreak(habit, planner.habitLogs, planner.today)
  const done = countsAsDone(status)
  const paused = habit.pausedAt !== null

  const history = Array.from({ length: HISTORY_DAYS }, (_, index) =>
    addDays(planner.today, index - (HISTORY_DAYS - 1)),
  )

  const consistency = habitConsistency(
    habit,
    planner.habitLogs,
    addDays(planner.today, -(HISTORY_DAYS - 1)),
    planner.today,
  )

  return (
    <Panel className={cn('flex h-full flex-col', paused && 'opacity-70')}>
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
            {habit.timeOfDay ? ` · ${habit.timeOfDay}` : ''}
          </p>
          <ObjectiveLink objective={objective} className="mt-1" />
        </div>

        <div className="flex shrink-0 gap-0.5">
          <IconButton
            icon="editar"
            label={`Editar ${habit.name}`}
            onClick={() => composer.open('habito', { editingHabit: habit })}
          />
          <IconButton
            icon={paused ? 'play' : 'pausa'}
            label={paused ? `Retomar ${habit.name}` : `Pausar ${habit.name}`}
            onClick={() => void planner.setHabitPaused(habit.id, !paused)}
          />
          <IconButton
            icon="arquivar"
            label={`Arquivar ${habit.name}`}
            onClick={() => setConfirming(true)}
          />
        </div>
      </div>

      {habit.description ? (
        <p className="mt-3 text-sm text-ink-muted">{habit.description}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Tag color={axis.colorToken}>{habitTargetLabel(habit)}</Tag>
        <Tag>Mínimo: {habitTargetLabel(habit, habit.minimalTarget)}</Tag>
        <PriorityTag priority={habit.priority} />
        {streak > 0 && !paused ? (
          <Tag tone="warn">
            <Icon name="fogo" className="size-3.5" />
            {streak} {streak === 1 ? 'dia' : 'dias'}
          </Tag>
        ) : null}
        {paused ? <Tag>Pausado</Tag> : null}
      </div>

      <ol className="mt-4 flex gap-1" aria-label={`Últimos ${HISTORY_DAYS} dias de ${habit.name}`}>
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
          value={consistency.rate}
          label={`Constância de ${habit.name} nos últimos ${HISTORY_DAYS} dias`}
          color={axis.colorToken}
        />
        <span className="tabular shrink-0 text-xs text-ink-faint">
          {consistency.done}/{consistency.expected}
        </span>
      </div>

      <p className="mt-1.5 text-xs text-ink-faint">
        {consistency.expected === 0
          ? 'Hábito novo: a consistência começa a contar amanhã.'
          : `${Math.round(consistency.rate * 100)}% de consistência em ${HISTORY_DAYS} dias.`}
      </p>

      {paused ? (
        <p className="mt-auto pt-4 text-xs text-ink-faint">
          Pausado. Retomar traz ele de volta pro dia sem perder o histórico.
        </p>
      ) : (
        <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-4">
          <Button
            size="sm"
            variant={done ? 'secondary' : 'primary'}
            onClick={() => void planner.setHabitStatus(habit.id, done ? 'pendente' : 'feito')}
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
      )}

      <ConfirmDialog
        open={confirming}
        title="Arquivar esse hábito?"
        description="Ele sai da lista e do dia. Se você só quer suspender por um tempo, pausar preserva o hábito e o histórico. Arquivar é definitivo."
        confirmLabel="Arquivar"
        destructive
        onConfirm={() => void planner.archiveHabit(habit.id)}
        onClose={() => setConfirming(false)}
      />
    </Panel>
  )
}
