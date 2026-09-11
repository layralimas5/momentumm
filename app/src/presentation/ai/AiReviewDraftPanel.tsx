import { useEffect, useState } from 'react'
import type { AiReviewDraft } from '@/domain/ai/ai-service'
import { weekRangeLabel, type WeekReview } from '@/domain/entities/review'
import {
  MAX_PRIORITIES,
  MAX_REVIEW_ANSWER,
  type WeeklyReview,
  type WeeklyReviewDraft,
} from '@/domain/entities/weekly-review'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { Panel, PanelHeader } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { AiErrorNote } from './AiErrorNote'
import { AiQuotaNote, AiSkeleton, AiSource } from './AiBits'
import type { AiController } from './use-ai'

interface AiReviewDraftPanelProps {
  readonly ai: AiController
  readonly stored: WeeklyReview
  readonly computed: WeekReview
  readonly onSave: (draft: WeeklyReviewDraft) => Promise<void>
  /** Chamado depois de gravar: a página volta pro primeiro passo escrito. */
  readonly onApplied?: () => void
}

const FIELDS = [
  { key: 'achievements', label: 'Conquistas' },
  { key: 'difficulties', label: 'Dificuldades' },
  { key: 'learnings', label: 'Aprendizados' },
  { key: 'adjustments', label: 'Ajustes' },
] as const

type FieldKey = (typeof FIELDS)[number]['key']

/**
 * "Preparar minha revisão", a porta da IA no Review semanal.
 *
 * A IA escreve o rascunho das quatro respostas e das prioridades a partir da
 * execução, das pendências e dos hábitos da semana — na primeira pessoa,
 * como se fosse a pessoa contando. Ela lê, corrige campo a campo e só então
 * grava. O que ela já tinha escrito é preservado no pedido e continua
 * editável aqui; nada sobrescreve sem passar pelos olhos dela.
 */
export function AiReviewDraftPanel({ ai, stored, computed, onSave, onApplied }: AiReviewDraftPanelProps) {
  const call = ai.draftReview
  const draft = call.result
  const [answers, setAnswers] = useState<Record<FieldKey, string>>({
    achievements: '',
    difficulties: '',
    learnings: '',
    adjustments: '',
  })
  const [priorities, setPriorities] = useState<string[]>([])

  useEffect(() => {
    if (!draft) return
    setAnswers({
      achievements: draft.achievements,
      difficulties: draft.difficulties,
      learnings: draft.learnings,
      adjustments: draft.adjustments,
    })
    setPriorities([...draft.priorities])
  }, [draft])

  const ask = () =>
    void call.run({
      weekLabel: weekRangeLabel(computed.start, computed.end),
      executionRate: computed.execution.rate,
      habitsDone: computed.execution.habitsDone,
      habitsPlanned: computed.execution.habitsPlanned,
      tasksDone: computed.execution.tasksDone,
      tasksPlanned: computed.execution.tasksPlanned,
      activeDays: computed.activeDays,
      focusMinutes: computed.focusMinutes,
      written: {
        achievements: stored.achievements,
        difficulties: stored.difficulties,
        learnings: stored.learnings,
        adjustments: stored.adjustments,
      },
    })

  const save = useAsyncAction(async () => {
    await onSave({
      ...answers,
      priorities: priorities.map((item) => item.trim()).filter(Boolean),
    })
    call.reset()
    onApplied?.()
  })

  return (
    <Panel tone="brand">
      <PanelHeader
        title="Preparar minha revisão"
        icon="ia"
        hint="A IA escreve o rascunho das respostas a partir da execução, das pendências e dos hábitos da semana. Você corrige e confirma."
        action={
          draft ? null : (
            <Button size="sm" loading={call.loading} disabled={!computed.ready} onClick={ask}>
              <Icon name="ia" className="size-4" />
              Preparar
            </Button>
          )
        }
      />

      {!computed.ready && !draft ? (
        <p className="mt-3 text-sm text-ink-muted">
          Essa semana ainda não tem registro suficiente pra IA ler. Responder à mão continua valendo.
        </p>
      ) : null}

      {call.error ? <AiErrorNote className="mt-4" message={call.error} code={call.errorCode} /> : null}
      {call.loading ? <AiSkeleton className="mt-4" lines={6} /> : null}

      {draft && !call.loading ? (
        <div className="mt-4 flex flex-col gap-4">
          <Basis draft={draft} />

          {FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{field.label}</span>
              <textarea
                value={answers[field.key]}
                rows={3}
                maxLength={MAX_REVIEW_ANSWER}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [field.key]: event.target.value }))
                }
                className="w-full resize-y rounded-xl border border-line bg-surface-hi px-3.5 py-3 text-sm text-ink transition-colors focus:border-brand"
              />
            </label>
          ))}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Prioridades da próxima semana
            </span>
            {priorities.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="tabular w-4 text-xs text-ink-faint">{index + 1}.</span>
                <input
                  aria-label={`Prioridade ${index + 1}`}
                  value={item}
                  onChange={(event) =>
                    setPriorities((current) =>
                      current.map((entry, position) => (position === index ? event.target.value : entry)),
                    )
                  }
                  className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface-hi px-3 text-sm text-ink transition-colors focus:border-brand"
                />
                <button
                  type="button"
                  aria-label={`Remover prioridade ${index + 1}`}
                  onClick={() => setPriorities((current) => current.filter((_, position) => position !== index))}
                  className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-hi hover:text-danger"
                >
                  <Icon name="fechar" className="size-4" />
                </button>
              </div>
            ))}
            {priorities.length < MAX_PRIORITIES ? (
              <button
                type="button"
                onClick={() => setPriorities((current) => [...current, ''])}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-hi hover:text-ink"
              >
                <Icon name="mais" className="size-3.5" />
                Adicionar prioridade
              </button>
            ) : null}
          </div>

          {save.error ? <ErrorNote message={save.error} /> : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button size="sm" loading={save.running} onClick={() => void save.run()}>
              <Icon name="check" className="size-4" />
              Usar essas respostas
            </Button>
            <Button size="sm" variant="ghost" onClick={call.reset}>
              Descartar
            </Button>
            <Button size="sm" variant="ghost" loading={call.loading} onClick={ask}>
              Preparar de novo
            </Button>
            <span className="text-xs text-ink-faint">Nada é gravado antes de você confirmar.</span>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3">
        <AiSource>
          Lido da execução, das pendências, dos hábitos e do que você já escreveu nesta semana.
        </AiSource>
        <AiQuotaNote quota={ai.quota} simulated={ai.simulated} />
      </div>
    </Panel>
  )
}

function Basis({ draft }: { readonly draft: AiReviewDraft }) {
  return (
    <p className="flex gap-2 rounded-lg bg-surface/60 px-3.5 py-2.5 text-xs text-ink-muted">
      <Icon name="progresso" className="mt-px size-3.5 shrink-0 text-ink-faint" />
      <span>
        <span className="text-ink-faint">Base: </span>
        {draft.basis}
      </span>
    </p>
  )
}
