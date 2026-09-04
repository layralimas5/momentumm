import { useState } from 'react'
import { activityType, type ActivityType, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import { addDays } from '@/domain/entities/day'
import { GOAL_PERIODS, GOAL_PERIOD_LABELS, type Goal, type GoalPeriod } from '@/domain/entities/goal'
import {
  DAY_PARTS,
  DAY_PART_LABELS,
  HABIT_ICONS,
  type DayPart,
  type HabitIcon,
} from '@/domain/entities/habit'
import { MAX_MINIMAL_VERSION, MAX_TASK_TITLE, TASK_EFFORTS, TASK_EFFORT_LABELS, type Task, type TaskEffort } from '@/domain/entities/task'
import { Button } from '@/presentation/components/ui/Button'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { HabitGlyph } from '@/presentation/components/ui/Icon'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { cn } from '@/shared/lib/cn'

export type ComposerKind = 'acao' | 'habito' | 'meta'

export interface TaskDraft {
  readonly title: string
  readonly goalId: string | null
  readonly axis: ActivityTypeSlug | null
  readonly estimatedMin: number
  readonly effort: TaskEffort
  readonly minimalVersion: string | null
  readonly day: DayKey
  readonly isMainPriority: boolean
}

export interface HabitDraft {
  readonly name: string
  readonly icon: HabitIcon
  readonly axis: ActivityTypeSlug
  readonly dayPart: DayPart
  readonly weekdays: readonly number[]
  readonly target: number
  readonly minimalTarget: number
}

export interface GoalDraft {
  readonly type: ActivityTypeSlug
  readonly target: number
  readonly period: GoalPeriod
}

interface ComposerProps {
  readonly open: boolean
  /** Áreas da conta, já com as que a pessoa criou. */
  readonly axes: readonly ActivityType[]
  readonly kind: ComposerKind
  readonly today: DayKey
  readonly goals: readonly Goal[]
  /** Preenchido quando o diálogo está editando uma ação existente. */
  readonly editing?: Task | null
  /** Meta já escolhida quando a ação nasce de dentro de uma meta. */
  readonly presetGoalId?: string | null
  readonly onClose: () => void
  readonly onSubmitTask: (draft: TaskDraft, editingId: string | null) => Promise<void>
  readonly onSubmitHabit: (draft: HabitDraft) => Promise<void>
  readonly onSubmitGoal: (draft: GoalDraft) => Promise<void>
}

const TITLES: Record<ComposerKind, { title: string; description: string }> = {
  acao: {
    title: 'Nova ação',
    description: 'Uma ação concreta, com tamanho definido e um plano B pra dia ruim.',
  },
  habito: {
    title: 'Novo hábito',
    description: 'Repetição pequena o suficiente pra sobreviver a uma semana ruim.',
  },
  meta: {
    title: 'Nova meta',
    description: 'Um número e um período. Menos metas, mais chance de bater.',
  },
}

/**
 * Um diálogo para os três tipos de criação. Manter três modais separados
 * significaria três layouts, três validações e três jeitos de errar.
 */
export function Composer(props: ComposerProps) {
  const { open, kind, onClose, editing } = props
  const copy = TITLES[kind]

  return (
    <Dialog
      open={open}
      size="lg"
      title={editing ? 'Editar ação' : copy.title}
      description={copy.description}
      onClose={onClose}
    >
      {kind === 'acao' ? <TaskForm {...props} /> : null}
      {kind === 'habito' ? <HabitForm {...props} /> : null}
      {kind === 'meta' ? <GoalForm {...props} /> : null}
    </Dialog>
  )
}

function TaskForm({
  axes,
  today,
  goals,
  editing,
  presetGoalId,
  onSubmitTask,
  onClose,
}: ComposerProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [goalId, setGoalId] = useState(editing?.goalId ?? presetGoalId ?? '')
  const [axis, setAxis] = useState<ActivityTypeSlug | ''>(editing?.axis ?? '')
  const [estimatedMin, setEstimatedMin] = useState(String(editing?.estimatedMin ?? 25))
  const [effort, setEffort] = useState<TaskEffort>(editing?.effort ?? 'medio')
  const [minimalVersion, setMinimalVersion] = useState(editing?.minimalVersion ?? '')
  const [when, setWhen] = useState<'hoje' | 'amanha'>(
    editing && editing.day > today ? 'amanha' : 'hoje',
  )
  const [isMain, setIsMain] = useState(editing?.isMainPriority ?? false)

  const submit = useAsyncAction(async () => {
    await onSubmitTask(
      {
        title,
        goalId: goalId || null,
        axis: axis || null,
        estimatedMin: Number(estimatedMin),
        effort,
        minimalVersion: minimalVersion.trim() || null,
        day: when === 'hoje' ? today : addDays(today, 1),
        isMainPriority: isMain,
      },
      editing?.id ?? null,
    )
    onClose()
  })

  const valid = title.trim().length >= 2 && Number(estimatedMin) > 0

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) void submit.run()
      }}
    >
      <Field label="O que você vai fazer" error={submit.error}>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            value={title}
            maxLength={MAX_TASK_TITLE}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Treinar 45 minutos"
            autoFocus
          />
        )}
      </Field>

      <Field
        label="Versão mínima"
        hint="O que você faria num dia ruim. É a saída em vez do abandono."
      >
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            value={minimalVersion}
            maxLength={MAX_MINIMAL_VERSION}
            onChange={(event) => setMinimalVersion(event.target.value)}
            placeholder="Fazer 10 minutos de movimento"
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meta relacionada">
          {(id) => (
            <Select id={id} value={goalId} onChange={(event) => setGoalId(event.target.value)}>
              <option value="">Sem meta vinculada</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.target} {activityType(goal.type).unitLabel.many} de{' '}
                  {activityType(goal.type).label} {GOAL_PERIOD_LABELS[goal.period]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Área">
          {(id) => (
            <Select
              id={id}
              value={axis}
              onChange={(event) => setAxis(event.target.value as ActivityTypeSlug | '')}
            >
              <option value="">Nenhuma</option>
              {axes.map((type) => (
                <option key={type.slug} value={type.slug}>
                  {type.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Tempo estimado (minutos)">
          {(id) => (
            <TextInput
              id={id}
              type="number"
              inputMode="numeric"
              min={1}
              value={estimatedMin}
              onChange={(event) => setEstimatedMin(event.target.value)}
            />
          )}
        </Field>

        <div>
          <p className="text-sm font-medium text-ink">Nível de esforço</p>
          <ChoiceGroup
            className="mt-1.5"
            size="sm"
            label="Nível de esforço"
            value={effort}
            onChange={setEffort}
            options={TASK_EFFORTS.map((item) => ({
              value: item,
              label: TASK_EFFORT_LABELS[item].replace('Esforço ', ''),
            }))}
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Quando</p>
        <ChoiceGroup
          className="mt-1.5"
          size="sm"
          label="Dia da ação"
          value={when}
          onChange={setWhen}
          options={[
            { value: 'hoje', label: 'Hoje' },
            { value: 'amanha', label: 'Amanhã' },
          ]}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-hi/50 px-3.5 py-3">
        <input
          type="checkbox"
          checked={isMain}
          onChange={(event) => setIsMain(event.target.checked)}
          className="mt-0.5 size-4 accent-[var(--color-brand)]"
        />
        <span className="text-sm">
          <span className="font-medium text-ink">Esta é a prioridade principal do dia</span>
          <span className="mt-0.5 block text-xs text-ink-faint">
            Só uma por dia. Marcar aqui destrona a anterior.
          </span>
        </span>
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid} loading={submit.running}>
          {editing ? 'Salvar alterações' : 'Criar ação'}
        </Button>
      </div>
    </form>
  )
}

function HabitForm({ axes, onSubmitHabit, onClose }: ComposerProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<HabitIcon>('livro')
  const [axis, setAxis] = useState<ActivityTypeSlug>('leitura')
  const [dayPart, setDayPart] = useState<DayPart>('qualquer')
  const [everyday, setEveryday] = useState(true)
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [target, setTarget] = useState('20')

  const submit = useAsyncAction(async () => {
    const targetValue = Number(target)
    await onSubmitHabit({
      name,
      icon,
      axis,
      dayPart,
      weekdays: everyday ? [] : weekdays,
      target: targetValue,
      minimalTarget: Math.max(1, Math.round(targetValue / 3)),
    })
    onClose()
  })

  const unit = activityType(axis).unitLabel.many
  const valid = name.trim().length >= 2 && Number(target) > 0 && (everyday || weekdays.length > 0)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) void submit.run()
      }}
    >
      <Field label="Nome do hábito" error={submit.error}>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ler antes de dormir"
            autoFocus
          />
        )}
      </Field>

      <div>
        <p className="text-sm font-medium text-ink">Ícone</p>
        <div role="radiogroup" aria-label="Ícone do hábito" className="mt-1.5 flex flex-wrap gap-2">
          {HABIT_ICONS.map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={item === icon}
              aria-label={item}
              onClick={() => setIcon(item)}
              className={cn(
                'grid size-10 place-items-center rounded-xl border transition-colors',
                item === icon
                  ? 'border-brand bg-brand-dim/60 text-brand-ink'
                  : 'border-line text-ink-faint hover:border-line-hi hover:text-ink',
              )}
            >
              <HabitGlyph icon={item} />
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Área">
          {(id) => (
            <Select
              id={id}
              value={axis}
              onChange={(event) => setAxis(event.target.value as ActivityTypeSlug)}
            >
              {axes.map((type) => (
                <option key={type.slug} value={type.slug}>
                  {type.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={`Meta do dia (${unit})`}>
          {(id) => (
            <TextInput
              id={id}
              type="number"
              inputMode="numeric"
              min={1}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          )}
        </Field>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Período do dia</p>
        <ChoiceGroup
          className="mt-1.5"
          size="sm"
          label="Período do dia"
          value={dayPart}
          onChange={setDayPart}
          options={DAY_PARTS.map((item) => ({ value: item, label: DAY_PART_LABELS[item] }))}
        />
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Frequência</p>
        <ChoiceGroup
          className="mt-1.5"
          size="sm"
          label="Frequência"
          value={everyday ? 'todos' : 'escolher'}
          onChange={(value) => setEveryday(value === 'todos')}
          options={[
            { value: 'todos', label: 'Todos os dias' },
            { value: 'escolher', label: 'Dias específicos' },
          ]}
        />

        {everyday ? null : (
          <div
            role="group"
            aria-label="Dias da semana"
            className="mt-2.5 flex flex-wrap gap-1.5"
          >
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((initial, index) => {
              const selected = weekdays.includes(index)
              return (
                <button
                  key={index}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Dia ${index + 1} da semana`}
                  onClick={() =>
                    setWeekdays((current) =>
                      selected ? current.filter((day) => day !== index) : [...current, index],
                    )
                  }
                  className={cn(
                    'size-10 rounded-lg border text-sm font-medium transition-colors',
                    selected
                      ? 'border-brand bg-brand-dim/60 text-ink'
                      : 'border-line text-ink-faint hover:border-line-hi hover:text-ink',
                  )}
                >
                  {initial}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid} loading={submit.running}>
          Criar hábito
        </Button>
      </div>
    </form>
  )
}

function GoalForm({ axes, onSubmitGoal, onClose }: ComposerProps) {
  const [type, setType] = useState<ActivityTypeSlug>('leitura')
  const [period, setPeriod] = useState<GoalPeriod>('dia')
  const [target, setTarget] = useState('')

  const submit = useAsyncAction(async () => {
    await onSubmitGoal({ type, target: Number(target), period })
    onClose()
  })

  const unit = activityType(type).unitLabel.many
  const valid = Number(target) > 0

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) void submit.run()
      }}
    >
      <Field label="Área">
        {(id) => (
          <Select
            id={id}
            value={type}
            onChange={(event) => setType(event.target.value as ActivityTypeSlug)}
          >
            {axes.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label={`Quanto (${unit})`} error={submit.error}>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            type="number"
            inputMode="numeric"
            min={1}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="20"
            autoFocus
          />
        )}
      </Field>

      <div>
        <p className="text-sm font-medium text-ink">Período</p>
        <ChoiceGroup
          className="mt-1.5"
          size="sm"
          label="Período da meta"
          value={period}
          onChange={setPeriod}
          options={GOAL_PERIODS.map((item) => ({ value: item, label: GOAL_PERIOD_LABELS[item] }))}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid} loading={submit.running}>
          Criar meta
        </Button>
      </div>
    </form>
  )
}
