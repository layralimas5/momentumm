import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { activityType } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import type { Goal } from '@/domain/entities/goal'
import { groupPendingTasks, TASK_EFFORT_LABELS, type Task } from '@/domain/entities/task'
import { Button } from '@/presentation/components/ui/Button'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { EmptyState } from '@/presentation/components/ui/States'
import { Panel, PanelHeader } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'

/** Teto de itens visíveis. Lista longa aqui vira a lista infinita que o produto combate. */
const VISIBLE_LIMIT = 5

type GroupBy = 'horizonte' | 'meta' | 'esforco'

interface NextActionsCardProps {
  readonly tasks: readonly Task[]
  readonly goals: readonly Goal[]
  readonly today: DayKey
  readonly excludeId?: string | undefined
  readonly onComplete: (task: Task) => Promise<void>
  readonly onPostpone: (task: Task) => Promise<void>
  readonly onShrink: (task: Task) => Promise<void>
  readonly onStartFocus: (task: Task) => void
  readonly onEdit: (task: Task) => void
  readonly onCreate: () => void
  readonly onSeeAll: () => void
}

/**
 * Próximas ações. Compacta de propósito: mostra o que decide o dia e manda o
 * resto pro planejamento completo. Uma lista sem fim aqui faria a pessoa parar
 * de olhar o card inteiro.
 */
export function NextActionsCard({
  tasks,
  goals,
  today,
  excludeId,
  onComplete,
  onPostpone,
  onShrink,
  onStartFocus,
  onEdit,
  onCreate,
  onSeeAll,
}: NextActionsCardProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('horizonte')

  const relevant = useMemo(
    () => tasks.filter((task) => task.id !== excludeId),
    [tasks, excludeId],
  )

  const groups = useMemo(
    () => buildGroups(relevant, goals, today, groupBy),
    [relevant, goals, today, groupBy],
  )

  const total = groups.reduce((sum, group) => sum + group.tasks.length, 0)
  const hidden = Math.max(0, total - VISIBLE_LIMIT)
  let budget = VISIBLE_LIMIT

  return (
    <Panel aria-labelledby="acoes-titulo">
      <PanelHeader
        id="acoes-titulo"
        title="Próximas ações"
        icon="jornada"
        action={
          <Button variant="ghost" size="sm" onClick={onCreate}>
            <Icon name="mais" className="size-4" />
            Nova ação
          </Button>
        }
      />

      {total === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nada pendente por enquanto"
            description="Toda meta precisa de uma próxima ação concreta. Sem ela, a meta continua sendo intenção."
            action={
              <Button size="sm" onClick={onCreate}>
                <Icon name="mais" className="size-4" />
                Criar ação
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ChoiceGroup
            className="mt-4"
            size="sm"
            label="Agrupar ações por"
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: 'horizonte', label: 'Por prazo' },
              { value: 'meta', label: 'Por meta' },
              { value: 'esforco', label: 'Por esforço' },
            ]}
          />

          <div className="mt-4 flex flex-col gap-4">
            {groups.map((group) => {
              if (budget <= 0) return null
              const visible = group.tasks.slice(0, budget)
              budget -= visible.length

              return (
                <section key={group.key} aria-label={group.label}>
                  <h3 className="text-xs font-medium tracking-wide text-ink-faint uppercase">
                    {group.label}
                  </h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    <AnimatePresence initial={false}>
                      {visible.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          goal={goals.find((goal) => goal.id === task.goalId) ?? null}
                          today={today}
                          onComplete={onComplete}
                          onPostpone={onPostpone}
                          onShrink={onShrink}
                          onStartFocus={onStartFocus}
                          onEdit={onEdit}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                </section>
              )
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="text-xs text-ink-faint">
              {hidden > 0
                ? `Mais ${hidden} ${hidden === 1 ? 'ação' : 'ações'} no planejamento.`
                : 'Tudo que importa está aqui.'}
            </p>
            <Button variant="ghost" size="sm" onClick={onSeeAll}>
              Ver planejamento completo
              <Icon name="seta" className="size-3.5" />
            </Button>
          </div>
        </>
      )}
    </Panel>
  )
}

function TaskRow({
  task,
  goal,
  today,
  onComplete,
  onPostpone,
  onShrink,
  onStartFocus,
  onEdit,
}: {
  task: Task
  goal: Goal | null
  today: DayKey
  onComplete: (task: Task) => Promise<void>
  onPostpone: (task: Task) => Promise<void>
  onShrink: (task: Task) => Promise<void>
  onStartFocus: (task: Task) => void
  onEdit: (task: Task) => void
}) {
  const axis = task.axis ? activityType(task.axis) : null
  const overdue = task.day < today

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.18 }}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface-hi/60 px-3 py-2.5 transition-colors hover:border-line-hi"
    >
      <button
        type="button"
        onClick={() => void onComplete(task)}
        className="grid size-7 shrink-0 place-items-center rounded-md border border-line-hi text-transparent transition-colors hover:border-positive hover:text-positive focus-visible:text-positive"
      >
        <Icon name="check" className="size-4" strokeWidth={2.5} />
        <span className="sr-only">Concluir {task.title}</span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-faint">
          {axis ? <span style={{ color: axis.colorToken }}>{axis.label}</span> : null}
          {goal ? <span>· Meta de {activityType(goal.type).label}</span> : null}
          <span>· {task.estimatedMin} min</span>
          <span>· {TASK_EFFORT_LABELS[task.effort]}</span>
          {overdue ? <span className="text-flame">· atrasada</span> : null}
        </p>
      </div>

      {/*
        As ações aparecem no hover, mas continuam sempre no DOM e alcançáveis
        pelo teclado: esconder com `hidden` deixaria o card inutilizável sem mouse.
      */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity',
          'group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        <RowButton icon="play" label={`Focar em ${task.title}`} onClick={() => onStartFocus(task)} />
        {task.minimalVersion ? (
          <RowButton
            icon="minimo"
            label={`Fazer versão mínima de ${task.title}`}
            onClick={() => void onShrink(task)}
          />
        ) : null}
        <RowButton
          icon="adiar"
          label={`Adiar ${task.title}`}
          onClick={() => void onPostpone(task)}
        />
        <RowButton icon="editar" label={`Editar ${task.title}`} onClick={() => onEdit(task)} />
      </div>
    </motion.li>
  )
}

function RowButton({
  icon,
  label,
  onClick,
}: {
  icon: IconName
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="grid size-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-top hover:text-ink"
    >
      <Icon name={icon} className="size-4" />
      <span className="sr-only">{label}</span>
    </button>
  )
}

interface Group {
  readonly key: string
  readonly label: string
  readonly tasks: readonly Task[]
}

function buildGroups(
  tasks: readonly Task[],
  goals: readonly Goal[],
  today: DayKey,
  groupBy: GroupBy,
): Group[] {
  if (groupBy === 'horizonte') {
    return groupPendingTasks(tasks, today).map((group) => ({
      key: group.key,
      label: group.label,
      tasks: group.tasks,
    }))
  }

  const pending = tasks.filter((task) => task.status === 'pendente')

  if (groupBy === 'meta') {
    const byGoal = new Map<string, Task[]>()
    for (const task of pending) {
      const key = task.goalId ?? 'sem-meta'
      const bucket = byGoal.get(key)
      if (bucket) bucket.push(task)
      else byGoal.set(key, [task])
    }

    return [...byGoal.entries()].map(([key, items]) => {
      const goal = goals.find((item) => item.id === key)
      return {
        key,
        label: goal ? `Meta de ${activityType(goal.type).label}` : 'Sem meta vinculada',
        tasks: items,
      }
    })
  }

  const order = ['pesado', 'medio', 'leve'] as const
  return order
    .map((effort) => ({
      key: effort,
      label: TASK_EFFORT_LABELS[effort],
      tasks: pending.filter((task) => task.effort === effort),
    }))
    .filter((group) => group.tasks.length > 0)
}
