import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AiPlanSuggestion, AiTaskSuggestion } from '@/domain/ai/ai-service'
import { activityType } from '@/domain/entities/activity-type'
import { formatDayLabel, parseDayKey } from '@/domain/entities/day'
import { deadlineFrom, MAX_OBJECTIVE_TITLE } from '@/domain/entities/objective'
import { Button } from '@/presentation/components/ui/Button'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, Tag } from '@/presentation/components/ui/Surface'
import { useAi, type PlanRequestDraft } from '@/presentation/ai/use-ai'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { PageHeader } from './PageHeader'

type Mode = 'plano' | 'leitura'

/**
 * Momentumm AI.
 *
 * Duas funções, sem chat. Chat convida a conversar e o produto não precisa de
 * conversa: precisa de um plano que vira dado e de uma leitura que vira ajuste.
 *
 * O plano NUNCA é salvo direto. A prévia é editável e a pessoa confirma — é
 * ela que responde pelo próprio calendário, e um plano gravado sem revisão é a
 * forma mais rápida de encher a semana de coisa que ninguém vai fazer.
 */
export function AiPage() {
  const ai = useAi()
  const [mode, setMode] = useState<Mode>('plano')

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Momentumm AI"
        description="A ferramenta que transforma um objetivo em plano e lê o teu progresso. Ela não é o produto: o produto é o ciclo que continua rodando depois que o plano existe."
      />

      {ai.simulated ? (
        <p
          role="note"
          className="flex items-start gap-2.5 rounded-lg border border-flame/30 bg-flame-dim/40 px-3.5 py-3 text-sm text-ink-muted"
        >
          <Icon name="raio" className="mt-0.5 size-4 shrink-0 text-flame" />
          <span className="text-pretty">
            <strong className="font-medium text-ink">Respostas simuladas.</strong> A integração com
            o modelo de verdade ainda não está ligada: o que aparece aqui é calculado por regras
            fixas em cima dos teus dados reais, com o mesmo formato que a IA vai devolver. Nada
            aqui foi escrito por um modelo.
          </span>
        </p>
      ) : null}

      <div role="tablist" aria-label="Função da IA" className="flex w-fit gap-1 rounded-xl border border-line bg-surface p-1">
        {(['plano', 'leitura'] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => setMode(item)}
            className={cn(
              'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
              mode === item ? 'bg-surface-top text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {item === 'plano' ? 'Objetivo em plano' : 'Ler meu progresso'}
          </button>
        ))}
      </div>

      {mode === 'plano' ? <PlanBuilder /> : <ProgressReader />}
    </div>
  )
}

function PlanBuilder() {
  const planner = usePlanner()
  const ai = useAi()
  const navigate = useNavigate()

  const [draft, setDraft] = useState<PlanRequestDraft>({
    title: '',
    axis: planner.axes[0]?.slug ?? 'leitura',
    target: 300,
    days: 60,
    minutesPerDay: 30,
    motive: '',
  })

  const suggestion = ai.buildPlan.result

  const ask = (event: FormEvent) => {
    event.preventDefault()
    void ai.buildPlan.run(draft)
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <Panel>
        <PanelHeader title="O objetivo" icon="objetivo" />

        <form onSubmit={ask} className="mt-4 flex flex-col gap-4">
          <Field label="O que você quer conquistar">
            {(id) => (
              <TextInput
                id={id}
                value={draft.title}
                maxLength={MAX_OBJECTIVE_TITLE}
                required
                placeholder="Ler 6 livros até o fim do trimestre"
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            )}
          </Field>

          <Field label="Área">
            {(id) => (
              <Select
                id={id}
                value={draft.axis}
                onChange={(event) => setDraft({ ...draft, axis: event.target.value })}
              >
                {planner.axes.map((axis) => (
                  <option key={axis.slug} value={axis.slug}>
                    {axis.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Alvo (${activityType(draft.axis).unitLabel.many})`}>
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={1}
                  value={String(draft.target)}
                  onChange={(event) => setDraft({ ...draft, target: Number(event.target.value) })}
                />
              )}
            </Field>

            <Field label="Minutos por dia" hint="É teto, não meta.">
              {(id, describedBy) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  type="number"
                  min={5}
                  value={String(draft.minutesPerDay)}
                  onChange={(event) =>
                    setDraft({ ...draft, minutesPerDay: Number(event.target.value) })
                  }
                />
              )}
            </Field>
          </div>

          <div>
            <p className="text-sm font-medium text-ink">Prazo</p>
            <ChoiceGroup
              className="mt-1.5"
              size="sm"
              label="Prazo do objetivo"
              value={draft.days}
              onChange={(days) => setDraft({ ...draft, days })}
              options={[
                { value: 30, label: '30 dias' },
                { value: 60, label: '2 meses' },
                { value: 90, label: '3 meses' },
                { value: 180, label: '6 meses' },
              ]}
            />
          </div>

          <Field label="Por que isso importa" hint="Opcional.">
            {(id, describedBy) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                value={draft.motive}
                onChange={(event) => setDraft({ ...draft, motive: event.target.value })}
              />
            )}
          </Field>

          {ai.buildPlan.error ? <ErrorNote message={ai.buildPlan.error} /> : null}

          <Button type="submit" loading={ai.buildPlan.loading} disabled={draft.title.trim().length < 3}>
            <Icon name="ia" className="size-4" />
            Montar o plano
          </Button>
        </form>
      </Panel>

      {ai.buildPlan.loading ? (
        <PlanSkeleton />
      ) : suggestion ? (
        <PlanPreview
          draft={draft}
          suggestion={suggestion}
          onSaved={() => navigate('/app/objetivos')}
        />
      ) : (
        <Panel className="grid place-items-center text-center">
          <div className="max-w-sm py-10">
            <Icon name="ia" className="mx-auto size-8 text-ink-faint" />
            <p className="mt-3 text-sm font-medium text-ink">A prévia aparece aqui</p>
            <p className="mt-1 text-sm text-ink-muted">
              Você vai poder editar, remover e adicionar ações antes de salvar. Nada é gravado sem
              a tua confirmação.
            </p>
          </div>
        </Panel>
      )}
    </div>
  )
}

/**
 * A prévia editável.
 *
 * As ações vêm em estado local justamente pra poder mexer: mudar título, mudar
 * data ou tirar da lista antes de qualquer escrita. Salvar cria objetivo,
 * hábitos e ações numa operação só, pelo mesmo caminho do onboarding.
 */
function PlanPreview({
  draft,
  suggestion,
  onSaved,
}: {
  readonly draft: PlanRequestDraft
  readonly suggestion: AiPlanSuggestion
  readonly onSaved: () => void
}) {
  const planner = usePlanner()
  const [tasks, setTasks] = useState<AiTaskSuggestion[]>([...suggestion.tasks])
  const [keepHabits, setKeepHabits] = useState(true)

  const axis = activityType(draft.axis)

  const save = useAsyncAction(async () => {
    const objective = await planner.createObjective({
      title: draft.title,
      axis: draft.axis,
      target: draft.target,
      startedOn: planner.today,
      deadline: deadlineFrom(planner.today, draft.days),
      motive: draft.motive.trim() || null,
    })

    if (!objective) return

    /*
      As etapas da prévia viram etapas de verdade ANTES das ações: é o vínculo
      que faz o objetivo nascer com plano em vez de com uma lista. Sem peso
      declarado, o provider redistribui pra somar 100 — a mesma regra do plano
      montado na mão.
    */
    const stageIds: (string | null)[] = []
    for (const [index, step] of suggestion.steps.entries()) {
      const stage = await planner.createStage({
        objectiveId: objective.id,
        title: step,
        order: index,
      })
      stageIds.push(stage?.id ?? null)
    }

    if (keepHabits) {
      for (const habit of suggestion.habits) {
        await planner.createHabit({
          name: habit.name,
          icon: habit.icon,
          axis: draft.axis,
          objectiveId: objective.id,
          frequency: habit.frequency,
          weekdays: habit.weekdays,
          timesPerWeek: habit.timesPerWeek,
          dayPart: habit.dayPart,
          target: habit.target,
          minimalTarget: habit.minimalTarget,
        })
      }
    }

    let order = 0
    for (const task of tasks) {
      await planner.createTask({
        title: task.title,
        description: task.description,
        objectiveId: objective.id,
        stageId: task.stepIndex === null ? null : (stageIds[task.stepIndex] ?? null),
        axis: draft.axis,
        estimatedMin: task.estimatedMin,
        effort: task.effort,
        priority: task.priority,
        minimalVersion: task.minimalVersion,
        day: task.day,
        order: order++,
      })
    }

    onSaved()
  })

  return (
    <Panel>
      <PanelHeader title="Prévia do plano" icon="plano" hint={suggestion.reasoning} />

      {suggestion.warnings.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {suggestion.warnings.map((warning) => (
            <li
              key={warning}
              className="flex gap-2.5 rounded-lg border border-flame/30 bg-flame-dim/40 px-3 py-2 text-sm text-ink-muted"
            >
              <Icon name="raio" className="mt-0.5 size-4 shrink-0 text-flame" />
              <span className="text-pretty">{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="mt-5">
        <h3 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">Etapas</h3>
        <p className="mt-1 text-xs text-ink-faint">
          Viram as etapas do plano ao salvar, com peso distribuído igualmente. Cada ação abaixo
          já nasce dentro da sua.
        </p>
        <ol className="mt-2 flex flex-col gap-1.5">
          {suggestion.steps.map((step, index) => (
            <li key={step} className="flex gap-2.5 text-sm text-ink-muted">
              <span className="tabular text-ink-faint">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-5 border-t border-line pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
            Hábitos de apoio
          </h3>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={keepHabits}
              onChange={(event) => setKeepHabits(event.target.checked)}
              className="size-4 accent-[var(--color-brand)]"
            />
            Criar junto
          </label>
        </div>

        <ul className="mt-2 flex flex-col gap-2">
          {suggestion.habits.map((habit) => (
            <li key={habit.name} className={cn('text-sm', keepHabits ? 'text-ink-muted' : 'text-ink-faint line-through')}>
              <span className="text-ink">{habit.name}</span> · {habit.target}{' '}
              {axis.unitLabel.many}
              <span className="mt-0.5 block text-xs text-ink-faint">{habit.rationale}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5 border-t border-line pt-5">
        <h3 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
          Ações ({tasks.length})
        </h3>

        <ul className="mt-2 flex flex-col divide-y divide-line">
          {tasks.map((task, index) => (
            <li key={`${task.title}-${index}`} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <input
                  aria-label={`Título da ação ${index + 1}`}
                  value={task.title}
                  onChange={(event) =>
                    setTasks((current) =>
                      current.map((item, position) =>
                        position === index ? { ...item, title: event.target.value } : item,
                      ),
                    )
                  }
                  className="w-full rounded-md bg-transparent text-sm text-ink transition-colors hover:bg-surface-hi focus:bg-surface-hi"
                />
                <p className="mt-0.5 truncate text-xs text-ink-faint">
                  {formatDayLabel(task.day, planner.today)} · {task.estimatedMin} min
                  {task.stepIndex !== null && suggestion.steps[task.stepIndex]
                    ? ` · Etapa: ${suggestion.steps[task.stepIndex]}`
                    : ''}
                </p>
              </div>

              <input
                type="date"
                aria-label={`Data da ação ${index + 1}`}
                value={task.day}
                onChange={(event) =>
                  setTasks((current) =>
                    current.map((item, position) =>
                      position === index
                        ? { ...item, day: parseDayKey(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="h-9 shrink-0 rounded-lg border border-line bg-surface-hi px-2 text-xs text-ink-muted"
              />

              <button
                type="button"
                onClick={() => setTasks((current) => current.filter((_, position) => position !== index))}
                aria-label={`Remover ${task.title}`}
                className="shrink-0 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-hi hover:text-danger"
              >
                <Icon name="fechar" className="size-4" />
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() =>
            setTasks((current) => [
              ...current,
              {
                title: 'Nova ação',
                description: null,
                day: planner.today,
                estimatedMin: 25,
                effort: 'medio',
                priority: 'media',
                minimalVersion: null,
                order: current.length,
                // Entra na última etapa: ação escrita no fim da prévia é o
                // fecho do caminho, e ação sem etapa não empurraria nada.
                stepIndex: suggestion.steps.length > 0 ? suggestion.steps.length - 1 : null,
              },
            ])
          }
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-ink-muted transition-colors hover:border-line-hi hover:text-ink"
        >
          <Icon name="mais" className="size-4" />
          Adicionar ação
        </button>
      </section>

      {save.error ? <ErrorNote message={save.error} /> : null}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button loading={save.running} onClick={() => void save.run()}>
          <Icon name="check" className="size-4" />
          Salvar o plano
        </Button>
        <Tag>
          {tasks.length} {tasks.length === 1 ? 'ação' : 'ações'}
          {keepHabits && suggestion.habits.length > 0
            ? ` · ${suggestion.habits.length} ${suggestion.habits.length === 1 ? 'hábito' : 'hábitos'}`
            : ''}
        </Tag>
      </div>
    </Panel>
  )
}

function ProgressReader() {
  const ai = useAi()
  const reading = ai.readProgress.result

  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <PanelHeader
          title="Leitura do progresso"
          icon="ia"
          hint="Olha os teus últimos 7 dias, os objetivos parados e o que está planejado pra hoje."
        />

        {ai.readProgress.error ? (
          <div className="mt-4">
            <ErrorNote message={ai.readProgress.error} />
          </div>
        ) : null}

        <Button
          className="mt-4"
          loading={ai.readProgress.loading}
          onClick={() => void ai.readProgress.run()}
        >
          <Icon name="raio" className="size-4" />
          {reading ? 'Ler de novo' : 'Ler meu progresso'}
        </Button>
      </Panel>

      {ai.readProgress.loading ? <PlanSkeleton /> : null}

      {reading && !ai.readProgress.loading ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel tone="brand" className="xl:col-span-2">
            <p className="text-pretty text-base text-ink">{reading.summary}</p>
            <p className="mt-4 rounded-lg bg-surface/60 px-3.5 py-3 text-sm text-ink-muted">
              <span className="text-ink-faint">Próxima ação: </span>
              {reading.nextAction}
            </p>
          </Panel>

          <ReadingBlock title="Padrões" icon="progresso" items={reading.patterns} />
          <ReadingBlock title="Gargalos" icon="cadeado" items={reading.bottlenecks} />
          <ReadingBlock title="Objetivos parados" icon="pausa" items={reading.stalled} />
          <ReadingBlock title="Ajustes sugeridos" icon="editar" items={reading.adjustments} />

          {reading.overload ? (
            <Panel className="xl:col-span-2">
              <PanelHeader title="Sinal de sobrecarga" icon="sino" />
              <p className="mt-3 text-sm text-ink-muted">{reading.overload}</p>
            </Panel>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ReadingBlock({
  title,
  icon,
  items,
}: {
  readonly title: string
  readonly icon: 'progresso' | 'cadeado' | 'pausa' | 'editar'
  readonly items: readonly string[]
}) {
  if (items.length === 0) return null

  return (
    <Panel>
      <PanelHeader title={title} icon={icon} />
      <ul className="mt-3 flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item} className="text-pretty text-sm text-ink-muted">
            {item}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function PlanSkeleton() {
  return (
    <Panel>
      <div role="status" aria-live="polite" className="flex flex-col gap-3">
        <span className="sr-only">Pensando</span>
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            aria-hidden="true"
            className="h-4 animate-pulse rounded bg-surface-top"
            style={{ width: `${100 - index * 12}%` }}
          />
        ))}
      </div>
    </Panel>
  )
}
