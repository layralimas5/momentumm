import { ACTIVITY_TYPE_LIST, activityType, formatUnit } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import {
  DEADLINE_PRESETS,
  MAX_OBJECTIVE_MOTIVE,
  MAX_OBJECTIVE_TITLE,
} from '@/domain/entities/objective'
import type { PlanDraft } from '@/domain/entities/plan-builder'
import { Button } from '@/presentation/components/ui/Button'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { FREQUENCY_OPTIONS, useObjectiveDraft } from '@/presentation/planner/use-objective-draft'
import { cn } from '@/shared/lib/cn'
import { PlanPreview } from './PlanPreview'

interface ObjectiveDialogProps {
  readonly open: boolean
  readonly today: DayKey
  readonly onClose: () => void
  readonly onSubmit: (plan: PlanDraft) => Promise<void>
}

/**
 * Objetivo novo fora do onboarding.
 *
 * As perguntas e o plano são exatamente os mesmos — o que muda é o formato: aqui
 * tudo cabe numa rolagem só, porque quem já usa o app não precisa ser conduzido
 * passo a passo. O plano continua embaixo, sempre visível, recalculando junto
 * com as respostas.
 */
export function ObjectiveDialog({ open, today, onClose, onSubmit }: ObjectiveDialogProps) {
  const draft = useObjectiveDraft(today)
  const type = activityType(draft.axis)

  const submit = useAsyncAction(async () => {
    await onSubmit(draft.plan)
    onClose()
  })

  return (
    <Dialog
      open={open}
      title="Novo objetivo"
      description="Uma coisa pra mudar, com prazo. O plano sai daqui pronto pra virar hábito e ação."
      size="lg"
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Área</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ACTIVITY_TYPE_LIST.map((item) => (
              <button
                key={item.slug}
                type="button"
                aria-pressed={item.slug === draft.axis}
                onClick={() => draft.setAxis(item.slug)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                  item.slug === draft.axis
                    ? 'border-brand bg-brand-dim/50'
                    : 'border-line bg-surface/60 hover:border-line-hi',
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: item.colorToken }}
                />
                <span className="text-sm font-medium text-ink">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Objetivo">
          {(id) => (
            <TextInput
              id={id}
              maxLength={MAX_OBJECTIVE_TITLE}
              value={draft.title}
              onChange={(event) => draft.setTitle(event.target.value)}
              placeholder={draft.suggestedTitle}
            />
          )}
        </Field>

        <Field label="Por que isso importa" hint="Opcional, e é o que segura num dia ruim.">
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              maxLength={MAX_OBJECTIVE_MOTIVE}
              value={draft.motive}
              onChange={(event) => draft.setMotive(event.target.value)}
              placeholder="Quero voltar a terminar o que começo."
            />
          )}
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Prazo</p>
          <ChoiceGroup
            label="Prazo do objetivo"
            size="sm"
            value={draft.days}
            onChange={draft.setDays}
            options={DEADLINE_PRESETS.map((preset) => ({
              value: preset.days,
              label: preset.label,
            }))}
          />
        </div>

        <Field
          label={`Alvo total em ${type.unitLabel.many}`}
          hint={`Sugestão pra esse prazo: ${formatUnit(type, draft.suggested)}.`}
        >
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="number"
              inputMode="numeric"
              min={1}
              value={draft.target}
              onChange={(event) => draft.setTarget(event.target.value)}
              placeholder={String(draft.suggested)}
            />
          )}
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Dias por semana</p>
          <ChoiceGroup
            label="Dias por semana"
            size="sm"
            value={draft.daysPerWeek}
            onChange={draft.setDaysPerWeek}
            options={FREQUENCY_OPTIONS.map((value) => ({
              value,
              label: value === 7 ? 'Todo dia' : `${value}x`,
            }))}
          />
        </div>

        <div className="border-t border-line pt-5">
          <PlanPreview plan={draft.plan} today={today} onUseSuggestedDeadline={draft.setDays} />
        </div>

        <div aria-live="polite" className="min-h-5">
          {submit.error ? <p className="text-sm text-danger">{submit.error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit.run()} loading={submit.running}>
            <Icon name="check" className="size-4" />
            Criar objetivo e plano
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
