import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import type { PlanDraft } from '@/domain/entities/plan-builder'
import { Button } from '@/presentation/components/ui/Button'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useJourneyDraft } from '@/presentation/planner/use-journey-draft'
import { AxisPicker } from './AxisPicker'
import { CombinedPlanPreview } from './CombinedPlanPreview'
import { ObjectiveFields } from './ObjectiveFields'
import { TimeBudgetFields } from './TimeBudgetFields'

interface ObjectiveDialogProps {
  readonly open: boolean
  readonly today: DayKey
  /** Áreas que já têm objetivo ativo: uma por eixo é regra de domínio. */
  readonly takenAxes: readonly ActivityTypeSlug[]
  readonly onClose: () => void
  readonly onSubmit: (plans: readonly PlanDraft[]) => Promise<void>
}

/**
 * Objetivo novo fora do onboarding.
 *
 * As perguntas e o plano são exatamente os mesmos — o que muda é o formato:
 * aqui tudo cabe numa rolagem só, porque quem já usa o app não precisa ser
 * conduzido passo a passo. Um objetivo por vez: quem quer três abre três
 * vezes, e a cada uma vê o plano inteiro antes de confirmar.
 */
export function ObjectiveDialog({
  open,
  today,
  takenAxes,
  onClose,
  onSubmit,
}: ObjectiveDialogProps) {
  const draft = useJourneyDraft(today, { takenAxes, max: 1 })
  const entry = draft.entries[0]

  const submit = useAsyncAction(async () => {
    await onSubmit(draft.combined.plans)
    onClose()
  })

  const allTaken = !entry || takenAxes.includes(entry.axis)

  return (
    <Dialog
      open={open}
      title="Novo objetivo"
      description="Uma coisa pra mudar, com prazo. O plano sai daqui pronto pra virar hábito e ação."
      size="lg"
      onClose={onClose}
    >
      {allTaken ? (
        <EmptyState
          title="Todas as áreas já têm objetivo"
          description="Um objetivo ativo por área mantém o progresso claro. Fecha ou arquiva um deles pra abrir espaço."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Área</p>
            <AxisPicker
              selected={[entry.axis]}
              taken={takenAxes}
              canAddMore={false}
              onAdd={(axis) => draft.updateObjective(entry.axis, { axis })}
              onRemove={() => undefined}
            />
          </div>

          <ObjectiveFields
            entry={entry}
            onChange={(changes) => draft.updateObjective(entry.axis, changes)}
            onRemove={null}
          />

          <div className="border-t border-line pt-5">
            <TimeBudgetFields
              minutesPerDay={draft.minutesPerDay}
              daysPerWeek={draft.daysPerWeek}
              objectiveCount={1}
              onMinutesChange={draft.setMinutesPerDay}
              onDaysChange={draft.setDaysPerWeek}
            />
          </div>

          <div className="border-t border-line pt-5">
            <CombinedPlanPreview
              combined={draft.combined}
              today={today}
              onUseSuggestedDeadline={(_axis, days) => draft.updateObjective(entry.axis, { days })}
              onUseFittingTarget={(_axis, target) =>
                draft.updateObjective(entry.axis, { target: String(target) })
              }
            />
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
      )}
    </Dialog>
  )
}
