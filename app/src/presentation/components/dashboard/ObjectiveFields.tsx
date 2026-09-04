import { activityType, formatUnit } from '@/domain/entities/activity-type'
import {
  DEADLINE_PRESETS,
  MAX_OBJECTIVE_MOTIVE,
  MAX_OBJECTIVE_TITLE,
} from '@/domain/entities/objective'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import type { EntryView, ObjectiveEntry } from '@/presentation/planner/use-journey-draft'

interface ObjectiveFieldsProps {
  readonly entry: EntryView
  readonly onChange: (changes: Partial<ObjectiveEntry>) => void
  /** Null quando é o único objetivo: não existe o que remover. */
  readonly onRemove: (() => void) | null
}

/**
 * Os campos de um objetivo: título, motivo, prazo e alvo.
 *
 * Um bloco só, repetido por objetivo. Quem escolhe três áreas responde as
 * mesmas quatro perguntas três vezes, no mesmo formato — variar o formulário
 * por área faria a pessoa reaprender a tela a cada bloco.
 */
export function ObjectiveFields({ entry, onChange, onRemove }: ObjectiveFieldsProps) {
  const type = activityType(entry.axis)

  return (
    <section
      aria-label={`Objetivo de ${type.label}`}
      className="rounded-card border border-line bg-surface/60 p-4"
    >
      <header className="flex items-center justify-between gap-3">
        <h4 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: type.colorToken }}
          />
          <span className="truncate">{type.label}</span>
        </h4>

        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="-mr-1 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-ink-faint transition-colors hover:text-danger active:bg-surface-top"
          >
            <Icon name="fechar" className="size-3.5" />
            Remover
          </button>
        ) : null}
      </header>

      <div className="mt-4 flex flex-col gap-4">
        <Field label="Objetivo">
          {(id) => (
            <TextInput
              id={id}
              maxLength={MAX_OBJECTIVE_TITLE}
              value={entry.title}
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder={entry.suggestedTitle}
            />
          )}
        </Field>

        <Field label="Por que isso importa" hint="Opcional, e é o que segura num dia ruim.">
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              maxLength={MAX_OBJECTIVE_MOTIVE}
              value={entry.motive}
              onChange={(event) => onChange({ motive: event.target.value })}
              placeholder="Quero voltar a terminar o que começo."
            />
          )}
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Prazo</p>
          <ChoiceGroup
            label={`Prazo do objetivo de ${type.label}`}
            size="sm"
            value={entry.days}
            onChange={(days) => onChange({ days })}
            options={DEADLINE_PRESETS.map((preset) => ({
              value: preset.days,
              label: preset.label,
            }))}
          />
        </div>

        <Field
          label={`Alvo total em ${type.unitLabel.many}`}
          hint={`Pelo tempo que você reservou, dá ${formatUnit(type, entry.suggested)} nesse prazo.`}
        >
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="number"
              inputMode="numeric"
              min={1}
              value={entry.target}
              onChange={(event) => onChange({ target: event.target.value })}
              placeholder={String(entry.suggested)}
            />
          )}
        </Field>
      </div>
    </section>
  )
}
