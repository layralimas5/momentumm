import { useState } from 'react'
import { activityType, type ActivityType, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import { addDays } from '@/domain/entities/day'
import { GOAL_PERIODS, GOAL_PERIOD_LABELS, type Goal, type GoalPeriod } from '@/domain/entities/goal'
import {
  DAY_PARTS,
  DAY_PART_LABELS,
  HABIT_FREQUENCIES,
  HABIT_FREQUENCY_LABELS,
  HABIT_ICONS,
  MAX_HABIT_DESCRIPTION,
  type DayPart,
  type Habit,
  type HabitFrequency,
  type HabitIcon,
} from '@/domain/entities/habit'
import type { Objective } from '@/domain/entities/objective'
import { stagesOfObjective, type PlanStage } from '@/domain/entities/plan-stage'
import { PRIORITIES, PRIORITY_LABELS, type Priority } from '@/domain/entities/priority'
import {
  MAX_MINIMAL_VERSION,
  MAX_TASK_DESCRIPTION,
  MAX_TASK_TITLE,
  MAX_TASK_WEIGHT,
  TASK_EFFORTS,
  TASK_EFFORT_LABELS,
  type Task,
  type TaskEffort,
} from '@/domain/entities/task'
import { parseDayKey } from '@/domain/entities/day'
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
  readonly description: string | null
  readonly goalId: string | null
  readonly objectiveId: string | null
  readonly stageId: string | null
  readonly weight: number
  readonly isRequired: boolean
  readonly axis: ActivityTypeSlug | null
  readonly estimatedMin: number
  readonly effort: TaskEffort
  readonly priority: Priority
  readonly minimalVersion: string | null
  readonly day: DayKey
  readonly timeOfDay: string | null
  readonly isMainPriority: boolean
}

export interface HabitDraft {
  readonly name: string
  readonly description: string | null
  readonly icon: HabitIcon
  readonly axis: ActivityTypeSlug
  readonly objectiveId: string | null
  readonly stageId: string | null
  readonly priority: Priority
  readonly frequency: HabitFrequency
  readonly dayPart: DayPart
  readonly timeOfDay: string | null
  readonly weekdays: readonly number[]
  readonly timesPerWeek: number
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
  /** Objetivos ativos: é o vínculo que dá sentido à ação e ao hábito. */
  readonly objectives: readonly Objective[]
  /** Preenchido quando o diálogo está editando uma ação existente. */
  readonly editing?: Task | null
  /** Preenchido quando o diálogo está editando um hábito existente. */
  readonly editingHabit?: Habit | null
  /** Meta já escolhida quando a ação nasce de dentro de uma meta. */
  readonly presetGoalId?: string | null
  /** Objetivo já escolhido quando a ação nasce de dentro de um objetivo. */
  readonly presetObjectiveId?: string | null
  /** Etapa já escolhida quando a ação nasce de dentro de uma etapa. */
  readonly presetStageId?: string | null
  /** Todas as etapas da conta: o seletor filtra pelas do objetivo escolhido. */
  readonly stages: readonly PlanStage[]
  readonly presetDay?: DayKey | null
  readonly onClose: () => void
  readonly onSubmitTask: (draft: TaskDraft, editingId: string | null) => Promise<void>
  readonly onSubmitHabit: (draft: HabitDraft, editingId: string | null) => Promise<void>
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
  const { open, kind, onClose, editing, editingHabit } = props
  const copy = TITLES[kind]

  const title = editing ? 'Editar ação' : editingHabit ? 'Editar hábito' : copy.title

  return (
    <Dialog
      open={open}
      size="lg"
      title={title}
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
  objectives,
  stages,
  editing,
  presetGoalId,
  presetObjectiveId,
  presetStageId,
  presetDay,
  onSubmitTask,
  onClose,
}: ComposerProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [goalId, setGoalId] = useState(editing?.goalId ?? presetGoalId ?? '')
  const [objectiveId, setObjectiveId] = useState(editing?.objectiveId ?? presetObjectiveId ?? '')
  const [stageId, setStageId] = useState(editing?.stageId ?? presetStageId ?? '')
  const [weight, setWeight] = useState(String(editing?.weight ?? 1))
  const [isRequired, setIsRequired] = useState(editing?.isRequired ?? true)
  const [axis, setAxis] = useState<ActivityTypeSlug | ''>(editing?.axis ?? '')
  const [estimatedMin, setEstimatedMin] = useState(String(editing?.estimatedMin ?? 25))
  const [effort, setEffort] = useState<TaskEffort>(editing?.effort ?? 'medio')
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? 'media')
  const [minimalVersion, setMinimalVersion] = useState(editing?.minimalVersion ?? '')
  // Data livre em vez de "hoje ou amanhã": o plano distribui ações ao longo de
  // semanas, e dois botões obrigariam a criar tudo pra hoje e remarcar depois,
  // uma por uma.
  const [day, setDay] = useState<string>(editing?.day ?? presetDay ?? today)
  const [timeOfDay, setTimeOfDay] = useState(editing?.timeOfDay ?? '')
  const [isMain, setIsMain] = useState(editing?.isMainPriority ?? false)

  // Escolher o objetivo já resolve a área: são a mesma informação, e deixar as
  // duas soltas permite uma ação de leitura pendurada num objetivo de treino.
  const chosenObjective = objectives.find((item) => item.id === objectiveId)
  const effectiveAxis = chosenObjective?.axis ?? (axis || null)

  // As etapas mudam com o objetivo, e a escolhida só vale se for dele: uma ação
  // numa etapa de outro objetivo faz o progresso dos dois mentir ao mesmo tempo.
  const stageOptions = objectiveId ? stagesOfObjective(stages, objectiveId) : []
  const effectiveStageId = stageOptions.some((stage) => stage.id === stageId) ? stageId : ''

  const submit = useAsyncAction(async () => {
    await onSubmitTask(
      {
        title,
        description: description.trim() || null,
        goalId: goalId || null,
        objectiveId: objectiveId || null,
        stageId: effectiveStageId || null,
        weight: Math.min(MAX_TASK_WEIGHT, Math.max(1, Number(weight) || 1)),
        isRequired,
        axis: effectiveAxis,
        estimatedMin: Number(estimatedMin),
        effort,
        priority,
        minimalVersion: minimalVersion.trim() || null,
        day: parseDayKey(day),
        timeOfDay: timeOfDay || null,
        isMainPriority: isMain,
      },
      editing?.id ?? null,
    )
    onClose()
  })

  const valid = title.trim().length >= 2 && Number(estimatedMin) > 0 && day.length === 10

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

      <Field label="Detalhes" hint="Opcional.">
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            value={description}
            maxLength={MAX_TASK_DESCRIPTION}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="O que exatamente precisa sair daqui"
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

      <Field
        label="Objetivo"
        hint="É isso que faz a ação aparecer no dia dizendo pra que ela serve."
      >
        {(id, describedBy) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={objectiveId}
            onChange={(event) => setObjectiveId(event.target.value)}
          >
            <option value="">Sem objetivo (vai pra caixa de entrada)</option>
            {objectives.map((objective) => (
              <option key={objective.id} value={objective.id}>
                {objective.title}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        label="Etapa do plano"
        hint={
          objectiveId
            ? stageOptions.length === 0
              ? 'Esse objetivo ainda não tem etapas. Sem etapa a ação não conta pro progresso.'
              : 'É a etapa que a conclusão dessa ação vai empurrar.'
            : 'Escolhe um objetivo primeiro.'
        }
      >
        {(id, describedBy) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={effectiveStageId}
            disabled={stageOptions.length === 0}
            onChange={(event) => setStageId(event.target.value)}
          >
            <option value="">Sem etapa</option>
            {stageOptions.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.title} ({stage.weight}%)
              </option>
            ))}
          </Select>
        )}
      </Field>

      {effectiveStageId ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Peso dentro da etapa"
            hint="Ações de peso igual dividem a etapa por igual."
          >
            {(id, describedBy) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_TASK_WEIGHT}
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
            )}
          </Field>

          <label className="flex cursor-pointer items-start gap-3 self-end rounded-xl border border-line bg-surface-hi/50 px-3.5 py-3">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(event) => setIsRequired(event.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-brand)]"
            />
            <span className="text-sm">
              <span className="font-medium text-ink">Obrigatória pra etapa fechar</span>
              <span className="mt-0.5 block text-xs text-ink-faint">
                Desmarcada, ela soma progresso mas não segura a conclusão da etapa.
              </span>
            </span>
          </label>
        </div>
      ) : null}

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

        <Field
          label="Área"
          hint={chosenObjective ? 'Definida pelo objetivo escolhido.' : undefined}
        >
          {(id, describedBy) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={chosenObjective?.axis ?? axis}
              disabled={Boolean(chosenObjective)}
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

        <Field label="Dia">
          {(id) => (
            <TextInput
              id={id}
              type="date"
              value={day}
              onChange={(event) => setDay(event.target.value)}
            />
          )}
        </Field>

        <Field label="Horário" hint="Opcional.">
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="time"
              value={timeOfDay}
              onChange={(event) => setTimeOfDay(event.target.value)}
            />
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

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Prioridade</p>
          <ChoiceGroup
            className="mt-1.5"
            size="sm"
            label="Prioridade da ação"
            value={priority}
            onChange={setPriority}
            options={PRIORITIES.map((item) => ({ value: item, label: PRIORITY_LABELS[item] }))}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Hoje', day: today },
            { label: 'Amanhã', day: addDays(today, 1) },
            { label: 'Em uma semana', day: addDays(today, 7) },
          ].map((shortcut) => (
            <button
              key={shortcut.label}
              type="button"
              onClick={() => setDay(shortcut.day)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-hi hover:text-ink"
            >
              {shortcut.label}
            </button>
          ))}
        </div>
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

function HabitForm({
  axes,
  objectives,
  stages,
  editingHabit,
  presetObjectiveId,
  presetStageId,
  onSubmitHabit,
  onClose,
}: ComposerProps) {
  const [name, setName] = useState(editingHabit?.name ?? '')
  const [description, setDescription] = useState(editingHabit?.description ?? '')
  const [icon, setIcon] = useState<HabitIcon>(editingHabit?.icon ?? 'livro')
  const [axis, setAxis] = useState<ActivityTypeSlug>(editingHabit?.axis ?? 'leitura')
  const [objectiveId, setObjectiveId] = useState(
    editingHabit?.objectiveId ?? presetObjectiveId ?? '',
  )
  const [stageId, setStageId] = useState(editingHabit?.stageId ?? presetStageId ?? '')
  const [priority, setPriority] = useState<Priority>(editingHabit?.priority ?? 'media')
  const [frequency, setFrequency] = useState<HabitFrequency>(editingHabit?.frequency ?? 'diario')
  const [dayPart, setDayPart] = useState<DayPart>(editingHabit?.dayPart ?? 'qualquer')
  const [timeOfDay, setTimeOfDay] = useState(editingHabit?.timeOfDay ?? '')
  const [weekdays, setWeekdays] = useState<number[]>([...(editingHabit?.weekdays ?? [1, 2, 3, 4, 5])])
  const [timesPerWeek, setTimesPerWeek] = useState(String(editingHabit?.timesPerWeek ?? 3))
  const [target, setTarget] = useState(String(editingHabit?.target ?? 20))

  const chosenObjective = objectives.find((item) => item.id === objectiveId)
  const effectiveAxis = chosenObjective?.axis ?? axis

  const stageOptions = objectiveId ? stagesOfObjective(stages, objectiveId) : []
  const effectiveStageId = stageOptions.some((stage) => stage.id === stageId) ? stageId : ''

  const submit = useAsyncAction(async () => {
    const targetValue = Number(target)
    await onSubmitHabit(
      {
        name,
        description: description.trim() || null,
        icon,
        axis: effectiveAxis,
        objectiveId: objectiveId || null,
        stageId: effectiveStageId || null,
        priority,
        frequency,
        dayPart,
        timeOfDay: timeOfDay || null,
        weekdays: frequency === 'dias-semana' ? weekdays : [],
        timesPerWeek: frequency === 'vezes-semana' ? Number(timesPerWeek) : 7,
        target: targetValue,
        minimalTarget:
          editingHabit && editingHabit.target === targetValue
            ? editingHabit.minimalTarget
            : Math.max(1, Math.round(targetValue / 3)),
      },
      editingHabit?.id ?? null,
    )
    onClose()
  })

  const unit = activityType(effectiveAxis).unitLabel.many
  const valid =
    name.trim().length >= 2 &&
    Number(target) > 0 &&
    (frequency !== 'dias-semana' || weekdays.length > 0) &&
    (frequency !== 'vezes-semana' || (Number(timesPerWeek) >= 1 && Number(timesPerWeek) <= 7))

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

      <Field label="Detalhes" hint="Opcional.">
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            value={description}
            maxLength={MAX_HABIT_DESCRIPTION}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Vinte páginas, sem celular na mesa"
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

      <Field label="Objetivo" hint="O hábito é o que carrega o volume de um objetivo.">
        {(id, describedBy) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={objectiveId}
            onChange={(event) => setObjectiveId(event.target.value)}
          >
            <option value="">Sem objetivo (hábito solto)</option>
            {objectives.map((objective) => (
              <option key={objective.id} value={objective.id}>
                {objective.title}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {/*
        A etapa do hábito é opcional mesmo com objetivo escolhido, e isso é
        deliberado: "desenvolver uma hora por dia" atravessa o plano inteiro.
        Obrigar uma etapa faria a pessoa recriar o mesmo hábito a cada fase.
      */}
      {stageOptions.length > 0 ? (
        <Field
          label="Etapa que ele sustenta"
          hint="Opcional. Hábito que atravessa o plano inteiro não precisa de etapa."
        >
          {(id, describedBy) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={effectiveStageId}
              onChange={(event) => setStageId(event.target.value)}
            >
              <option value="">O objetivo inteiro</option>
              {stageOptions.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Área"
          hint={chosenObjective ? 'Definida pelo objetivo escolhido.' : undefined}
        >
          {(id, describedBy) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={effectiveAxis}
              disabled={Boolean(chosenObjective)}
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

      <div className="grid gap-4 sm:grid-cols-2">
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

        <Field label="Horário" hint="Opcional. É lembrete, não cobrança.">
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="time"
              value={timeOfDay}
              onChange={(event) => setTimeOfDay(event.target.value)}
            />
          )}
        </Field>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Frequência</p>
        <ChoiceGroup
          className="mt-1.5"
          size="sm"
          label="Frequência"
          value={frequency}
          onChange={setFrequency}
          options={HABIT_FREQUENCIES.map((item) => ({
            value: item,
            label: HABIT_FREQUENCY_LABELS[item],
          }))}
        />

        {frequency === 'dias-semana' ? (
          <div role="group" aria-label="Dias da semana" className="mt-2.5 flex flex-wrap gap-1.5">
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
        ) : null}

        {frequency === 'vezes-semana' ? (
          <div className="mt-2.5">
            <ChoiceGroup
              size="sm"
              label="Vezes por semana"
              value={timesPerWeek}
              onChange={setTimesPerWeek}
              options={['1', '2', '3', '4', '5', '6'].map((item) => ({
                value: item,
                label: `${item}x`,
              }))}
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              Sem dia fixo: você escolhe quando, e a cota vale pela semana inteira.
            </p>
          </div>
        ) : null}
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Prioridade</p>
        <ChoiceGroup
          className="mt-1.5"
          size="sm"
          label="Prioridade do hábito"
          value={priority}
          onChange={setPriority}
          options={PRIORITIES.map((item) => ({ value: item, label: PRIORITY_LABELS[item] }))}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid} loading={submit.running}>
          {editingHabit ? 'Salvar alterações' : 'Criar hábito'}
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
