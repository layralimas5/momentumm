import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, formatDayLabel } from '@/domain/entities/day'
import { habitConsistency } from '@/domain/entities/habit'
import { isPending, type Task } from '@/domain/entities/task'
import {
  percent,
  reviewWeek,
  weekRangeLabel,
  type ReviewInput,
  type WeekReview,
} from '@/domain/entities/review'
import {
  emptyReview,
  isComplete,
  MAX_PRIORITIES,
  MAX_REVIEW_ANSWER,
  REVIEW_STEPS,
  REVIEW_STEP_META,
  reviewProgress,
  reviewWeekStart,
  weekLabel,
  type ReviewStep,
  type WeeklyReview,
} from '@/domain/entities/weekly-review'
import { ObjectiveLink } from '@/presentation/components/shared/Meta'
import { Button, buttonClass } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { weeklyReviewEvent } from '@/domain/share/journey-event-builders'
import { AiErrorNote } from '@/presentation/ai/AiErrorNote'
import { useAi } from '@/presentation/ai/use-ai'
import { AiError, type AiErrorCode } from '@/domain/ai/ai-error'
import { toUserMessage } from '@/shared/errors'
import { useAuth } from '@/presentation/auth/use-auth'
import { ShareButton } from '@/presentation/share/ShareButton'
import { useDashboard } from '@/presentation/planner/use-dashboard'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { PageHeader } from './PageHeader'

/**
 * Review semanal.
 *
 * É um fluxo guiado, não um formulário. A diferença é prática: o formulário
 * mostra oito campos vazios de uma vez e a pessoa fecha a aba; o fluxo mostra
 * uma pergunta por vez e salva cada resposta na hora, então parar no meio é um
 * caso previsto e não uma perda.
 *
 * Os passos que o app escreve sozinho vêm intercalados de propósito — a pessoa
 * lê o dado antes de responder a pergunta que depende dele.
 */
export function ReviewPage() {
  const { user } = useAuth()
  const planner = usePlanner()
  const dashboard = useDashboard()

  const weekStart = reviewWeekStart(planner.today)

  const stored = useMemo(
    () =>
      planner.weeklyReviews.find((item) => item.weekStart === weekStart) ??
      emptyReview('local', weekStart, 'local'),
    [planner.weeklyReviews, weekStart],
  )

  /**
   * A leitura calculada da MESMA semana que o review escrito guarda.
   *
   * `reviewWeek` mede sete dias terminando no `today` que recebe. Passar o
   * domingo da semana revisada faz a janela cair exatamente sobre a semana de
   * calendário — com `weeksAgo: 1` ela viraria uma janela móvel e o cabeçalho
   * diria "24 a 30" enquanto os números seriam de "23 a 29".
   */
  const computed = useMemo<WeekReview>(() => {
    const input: ReviewInput = {
      activities: planner.activities,
      habits: planner.habits,
      habitLogs: planner.habitLogs,
      tasks: planner.tasks,
      checkIns: planner.checkIns,
      objectives: planner.objectiveProgress,
      today: addDays(weekStart, 6),
    }
    return reviewWeek(input)
  }, [planner, weekStart])

  const [step, setStep] = useState<ReviewStep>(stored.lastStep)
  const [showHistory, setShowHistory] = useState(false)

  const index = REVIEW_STEPS.indexOf(step)
  const meta = REVIEW_STEP_META[index]

  const save = useCallback(
    async (patch: Parameters<typeof planner.saveWeeklyReview>[1]) => {
      await planner.saveWeeklyReview(weekStart, patch)
    },
    [planner, weekStart],
  )

  const goTo = useCallback(
    (next: ReviewStep) => {
      setStep(next)
      void save({ lastStep: next })
    },
    [save],
  )

  if (showHistory) {
    return (
      <ReviewHistory
        reviews={planner.weeklyReviews}
        onBack={() => setShowHistory(false)}
      />
    )
  }

  if (!meta) return null

  const done = isComplete(stored)
  const filled = reviewProgress(stored)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Review semanal"
        description={`A semana de ${weekLabel(weekStart)}. Rápido: uma pergunta por vez, e o que você escreve fica salvo na hora.`}
        action={
          planner.weeklyReviews.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => setShowHistory(true)}>
              <Icon name="calendario" className="size-4" />
              Reviews anteriores
            </Button>
          ) : undefined
        }
      />

      {planner.error ? <ErrorNote message={planner.error} /> : null}

      {done ? (
        <p className="flex items-center gap-2.5 rounded-lg border border-positive/30 bg-positive/10 px-3.5 py-3 text-sm text-ink-muted">
          <Icon name="check" className="size-4 shrink-0 text-positive" />
          Review dessa semana concluído. Dá pra continuar editando à vontade.
        </p>
      ) : null}

      {/*
        Semana sem registro suficiente: o formulário continua aberto (dá pra
        escrever o que aconteceu fora do app), mas a tela diz em voz alta que
        os números abaixo estão vazios por falta de dado, e aponta a saída. Sem
        isso, 0% em quatro caixas parece bug, não conta nova.
      */}
      {!done && !computed.ready ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-muted">
            <span className="font-medium text-ink">Essa semana ainda não tem registro. </span>
            O review lê o que você marcou em Hoje: sem isso os números ficam em zero e a leitura
            não escreve nada. Responder à mão continua valendo.
          </p>
          <Link to="/app" className={buttonClass({ variant: 'secondary', size: 'sm', className: 'shrink-0' })}>
            <Icon name="hoje" className="size-4" />
            Registrar o dia
          </Link>
        </div>
      ) : null}

      <Stepper current={index} filled={filled} onSelect={goTo} />

      <Panel>
        <PanelHeader
          title={meta.title}
          hint={meta.question}
          action={
            <span className="tabular text-xs text-ink-faint">
              {index + 1}/{REVIEW_STEPS.length}
            </span>
          }
        />

        <div className="mt-5">
          {step === 'resumo' ? <SummaryStep review={computed} /> : null}
          {step === 'pendencias' ? <PendingStep /> : null}
          {step === 'habitos' ? <HabitsStep /> : null}

          {step === 'conquistas' ? (
            <AnswerField
              label="Conquistas"
              placeholder={meta.placeholder}
              value={stored.achievements ?? ''}
              onSave={(value) => void save({ achievements: value })}
            />
          ) : null}
          {step === 'dificuldades' ? (
            <AnswerField
              label="Dificuldades"
              placeholder={meta.placeholder}
              value={stored.difficulties ?? ''}
              onSave={(value) => void save({ difficulties: value })}
            />
          ) : null}
          {step === 'aprendizados' ? (
            <AnswerField
              label="Aprendizados"
              placeholder={meta.placeholder}
              value={stored.learnings ?? ''}
              onSave={(value) => void save({ learnings: value })}
            />
          ) : null}
          {step === 'ajustes' ? (
            <>
              <AnswerField
                label="Ajustes"
                placeholder={meta.placeholder}
                value={stored.adjustments ?? ''}
                onSave={(value) => void save({ adjustments: value })}
              />
              <div className="mt-5 rounded-lg border border-line bg-surface-hi px-3.5 py-3">
                <p className="text-sm text-ink-muted">
                  <span className="text-ink-faint">O app sugere: </span>
                  {computed.recommendation.title}
                </p>
                <p className="mt-1 text-xs text-ink-faint">{computed.recommendation.detail}</p>
              </div>
            </>
          ) : null}
          {step === 'prioridades' ? (
            <PrioritiesStep
              values={stored.priorities}
              onSave={(priorities) => void save({ priorities })}
            />
          ) : null}
        </div>

        {step === 'prioridades' ? (
          <AiSummary review={stored} computed={computed} onSave={save} />
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <Button
            variant="ghost"
            disabled={index === 0}
            onClick={() => {
              const previous = REVIEW_STEPS[index - 1]
              if (previous) goTo(previous)
            }}
          >
            <Icon name="setaEsq" className="size-4" />
            Voltar
          </Button>

          {index === REVIEW_STEPS.length - 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              {/* O card da semana só aparece depois que a semana foi fechada:
                  compartilhar um resumo pela metade seria contar uma história
                  que a pessoa ainda não terminou de ler. */}
              {done && user ? (
                <ShareButton
                  label="Compartilhar semana"
                  size="md"
                  build={() =>
                    weeklyReviewEvent({
                      userId: user.id,
                      weekStart,
                      weekEnd: addDays(weekStart, 6),
                      executionRate: computed.execution.rate,
                      habitsDone: computed.execution.habitsDone,
                      // A semana também tem o que foi feito: ações fechadas e
                      // dias com movimento. Eram números que a tela mostrava e
                      // o card resumia a um percentual.
                      tasksDone: computed.execution.tasksDone,
                      activeDays: computed.activeDays,
                      focusMinutes: computed.focusMinutes,
                      momentum: dashboard.momentum,
                    })
                  }
                />
              ) : null}
              <Button onClick={() => void save({ completedAt: new Date() })}>
                <Icon name="check" className="size-4" />
                {done ? 'Salvar de novo' : 'Concluir review'}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => {
                const next = REVIEW_STEPS[index + 1]
                if (next) goTo(next)
              }}
            >
              Próximo
              <Icon name="seta" className="size-4" />
            </Button>
          )}
        </div>
      </Panel>
    </div>
  )
}

function Stepper({
  current,
  filled,
  onSelect,
}: {
  readonly current: number
  readonly filled: number
  readonly onSelect: (step: ReviewStep) => void
}) {
  return (
    <div>
      <ol className="flex flex-wrap gap-1.5">
        {REVIEW_STEP_META.map((meta, index) => (
          <li key={meta.key}>
            <button
              type="button"
              aria-current={index === current ? 'step' : undefined}
              onClick={() => onSelect(meta.key)}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                index === current
                  ? 'border-brand bg-brand-dim/60 text-ink'
                  : index < current
                    ? 'border-line bg-surface-hi text-ink-muted'
                    : 'border-line text-ink-faint hover:text-ink-muted',
              )}
            >
              {meta.title}
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar className="flex-1" value={filled} label="Progresso do review" />
        <span className="tabular shrink-0 text-xs text-ink-faint">
          {Math.round(filled * 100)}% respondido
        </span>
      </div>
    </div>
  )
}

function SummaryStep({ review }: { readonly review: WeekReview }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-pretty text-base text-ink">{review.headline}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Execução" value={percent(review.execution.rate)} />
        <Figure label="Dias ativos" value={`${review.activeDays}/7`} />
        <Figure
          label="Hábitos"
          value={`${review.execution.habitsDone}/${review.execution.habitsPlanned}`}
        />
        <Figure
          label="Ações"
          value={`${review.execution.tasksDone}/${review.execution.tasksPlanned}`}
        />
      </div>

      <p className="text-xs text-ink-faint">
        Semana de {weekRangeLabel(review.start, review.end)}
      </p>

      {review.gained.length > 0 ? (
        <section>
          <h4 className="text-sm font-semibold text-ink">Onde evoluiu</h4>
          <ul className="mt-2 flex flex-col gap-2">
            {review.gained.map((point) => (
              <li key={point.id} className="text-sm text-ink-muted">
                <span className="text-ink">{point.title}.</span> {point.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {review.lost.length > 0 ? (
        <section>
          <h4 className="text-sm font-semibold text-ink">Onde o ritmo caiu</h4>
          <ul className="mt-2 flex flex-col gap-2">
            {review.lost.map((point) => (
              <li key={point.id} className="text-sm text-ink-muted">
                <span className="text-ink">{point.title}.</span> {point.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

/**
 * As ações que não saíram, com a saída na mesma linha.
 *
 * Listar pendência sem oferecer o que fazer com ela transforma o review em
 * cobrança. Aqui cada linha remarca pra hoje ou cancela — as duas decisões
 * honestas.
 */
function PendingStep() {
  const planner = usePlanner()

  const weekStart = addDays(planner.today, -13)
  const weekEnd = addDays(planner.today, -7)

  const pending = planner.tasks.filter(
    (task) => isPending(task) && task.day >= weekStart && task.day <= weekEnd,
  )

  if (pending.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Nada ficou pendente da semana passada. Isso é resultado, não sorte.
      </p>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-line">
      {pending.map((task) => (
        <PendingRow key={task.id} task={task} />
      ))}
    </ul>
  )
}

function PendingRow({ task }: { readonly task: Task }) {
  const planner = usePlanner()
  const objective = planner.objectives.find((item) => item.id === task.objectiveId)

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{task.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-faint">
          <span>Era pra {formatDayLabel(task.day, planner.today)}</span>
          <ObjectiveLink objective={objective} />
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void planner.updateTask(task.id, { day: planner.today })}
        >
          Trazer pra hoje
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            void planner.updateTask(task.id, { status: 'cancelada', isMainPriority: false })
          }
        >
          Cancelar
        </Button>
      </div>
    </li>
  )
}

function HabitsStep() {
  const planner = usePlanner()
  const start = addDays(planner.today, -13)
  const end = addDays(planner.today, -7)

  const rows = planner.habits
    .filter((habit) => habit.archivedAt === null)
    .map((habit) => ({ habit, consistency: habitConsistency(habit, planner.habitLogs, start, end) }))
    .filter((row) => row.consistency.expected > 0)

  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Nenhum hábito estava programado nessa semana.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-4">
      {rows.map(({ habit, consistency }) => (
        <li key={habit.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-ink">{habit.name}</span>
            <span className="tabular shrink-0 text-sm text-ink-muted">
              {consistency.done}/{consistency.expected}
            </span>
          </div>
          <ProgressBar value={consistency.rate} label={`Constância de ${habit.name}`} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Campo de resposta com salvamento no blur.
 *
 * Salvar a cada tecla mandaria uma escrita por caractere; salvar só no fim
 * perderia tudo quem fechasse a aba. O blur é o meio termo que cobre os dois.
 */
function AnswerField({
  label,
  placeholder,
  value,
  onSave,
}: {
  readonly label: string
  readonly placeholder: string
  readonly value: string
  readonly onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)

  return (
    <label className="flex flex-col gap-2">
      <span className="sr-only">{label}</span>
      <textarea
        value={draft}
        rows={4}
        maxLength={MAX_REVIEW_ANSWER}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== value) onSave(draft)
        }}
        className="w-full resize-y rounded-xl border border-line bg-surface-hi px-3.5 py-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-brand"
      />
      <span className="tabular text-right text-xs text-ink-faint">
        {draft.length}/{MAX_REVIEW_ANSWER}
      </span>
    </label>
  )
}

function PrioritiesStep({
  values,
  onSave,
}: {
  readonly values: readonly string[]
  readonly onSave: (values: readonly string[]) => void
}) {
  const [draft, setDraft] = useState<string[]>(() => {
    const filled = [...values]
    while (filled.length < MAX_PRIORITIES) filled.push('')
    return filled
  })

  const commit = (next: string[]) => {
    setDraft(next)
    onSave(next.filter((item) => item.trim().length > 0))
  }

  return (
    <div className="flex flex-col gap-3">
      {draft.map((item, index) => (
        <label key={index} className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="tabular grid size-8 shrink-0 place-items-center rounded-lg border border-line text-sm text-ink-faint"
          >
            {index + 1}
          </span>
          <span className="sr-only">Prioridade {index + 1}</span>
          <input
            value={item}
            placeholder={index === 0 ? 'A coisa mais importante da semana' : 'Opcional'}
            onChange={(event) =>
              setDraft(draft.map((entry, position) => (position === index ? event.target.value : entry)))
            }
            onBlur={() => commit(draft)}
            className="h-11 w-full rounded-xl border border-line bg-surface-hi px-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-brand"
          />
        </label>
      ))}
      <p className="text-xs text-ink-faint">
        Três no máximo. Uma semana com sete prioridades não tem nenhuma.
      </p>
    </div>
  )
}

function AiSummary({
  review,
  computed,
  onSave,
}: {
  readonly review: WeeklyReview
  readonly computed: WeekReview
  readonly onSave: (patch: { aiSummary: string }) => Promise<void>
}) {
  const ai = useAi()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ message: string; code: AiErrorCode | null } | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const summary = await ai.summarizeReview({
        weekLabel: weekRangeLabel(computed.start, computed.end),
        executionRate: computed.execution.rate,
        habitsDone: computed.execution.habitsDone,
        activeDays: computed.activeDays,
        achievements: review.achievements,
        difficulties: review.difficulties,
        learnings: review.learnings,
      })
      await onSave({ aiSummary: summary })
    } catch (cause) {
      setError({
        message: toUserMessage(cause),
        code: cause instanceof AiError ? cause.code : null,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-6 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-ink">Síntese da semana</h4>
        <Button size="sm" variant="secondary" loading={loading} onClick={() => void generate()}>
          <Icon name="ia" className="size-4" />
          {review.aiSummary ? 'Gerar de novo' : 'Gerar com o Momentumm AI'}
        </Button>
      </div>

      {error ? <AiErrorNote className="mt-3" message={error.message} code={error.code} /> : null}

      {review.aiSummary ? (
        <p className="mt-3 text-pretty rounded-lg bg-surface-hi px-3.5 py-3 text-sm text-ink-muted">
          {review.aiSummary}
        </p>
      ) : (
        <p className="mt-2 text-xs text-ink-faint">
          Junta o que você escreveu com os números da semana numa frase só.
        </p>
      )}

      {ai.simulated && review.aiSummary ? (
        <p className="mt-2 text-xs text-flame">Texto simulado: a IA de verdade ainda não está ligada.</p>
      ) : null}
    </section>
  )
}

function ReviewHistory({
  reviews,
  onBack,
}: {
  readonly reviews: readonly WeeklyReview[]
  readonly onBack: () => void
}) {
  const sorted = [...reviews].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-ink-faint transition-colors hover:text-ink-muted"
      >
        <Icon name="setaEsq" className="size-4" />
        Voltar pro review da semana
      </button>

      <PageHeader
        title="Reviews anteriores"
        description="O que você escreveu nas semanas passadas. É aqui que dá pra ver se o ajuste da semana passada pegou."
      />

      {sorted.length === 0 ? (
        <EmptyState
          title="Nenhum review ainda"
          description="O primeiro review fica guardado aqui assim que você responder."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {sorted.map((review) => (
            <li key={review.id}>
              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink">{weekLabel(review.weekStart)}</h3>
                  <Tag tone={isComplete(review) ? 'positive' : 'neutral'}>
                    {isComplete(review) ? 'Concluído' : 'Incompleto'}
                  </Tag>
                </div>

                <dl className="mt-4 flex flex-col gap-3 text-sm">
                  <Entry label="Conquistas" value={review.achievements} />
                  <Entry label="Dificuldades" value={review.difficulties} />
                  <Entry label="Aprendizados" value={review.learnings} />
                  <Entry label="Ajustes" value={review.adjustments} />
                </dl>

                {review.priorities.length > 0 ? (
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="text-xs text-ink-faint">Prioridades da semana seguinte</p>
                    <ol className="mt-1.5 flex flex-col gap-1">
                      {review.priorities.map((item, index) => (
                        <li key={item} className="text-sm text-ink-muted">
                          {index + 1}. {item}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/app/progresso"
        className="inline-flex items-center gap-1.5 text-sm text-brand-ink transition-colors hover:text-brand-hi"
      >
        Ver a evolução em números
        <Icon name="seta" className="size-4" />
      </Link>
    </div>
  )
}

function Entry({ label, value }: { readonly label: string; readonly value: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-pretty text-ink-muted">{value}</dd>
    </div>
  )
}

function Figure({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-hi px-3 py-2.5">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="tabular mt-0.5 text-lg font-semibold text-ink">{value}</p>
    </div>
  )
}
