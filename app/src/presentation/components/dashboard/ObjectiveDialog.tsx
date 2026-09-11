import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import type { PlanDraft } from '@/domain/entities/plan-builder'
import { Button } from '@/presentation/components/ui/Button'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useJourneyDraft } from '@/presentation/planner/use-journey-draft'
import { usePlanner } from '@/presentation/planner/use-planner'
import { AxisPicker } from './AxisPicker'
import { CombinedPlanPreview } from './CombinedPlanPreview'
import { UpgradeHint } from './UpgradeHint'
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
  return (
    <Dialog
      open={open}
      title="Novo objetivo"
      description="Uma coisa pra mudar, com prazo. O plano sai daqui pronto pra virar hábito e ação."
      size="lg"
      onClose={onClose}
    >
      {/*
        O formulário só existe enquanto o diálogo está aberto. Mantido montado,
        ele guardaria o rascunho da primeira abertura — e abriria apontando pra
        uma área que ganhou objetivo no meio do caminho.
      */}
      {open ? (
        <ObjectiveForm today={today} takenAxes={takenAxes} onClose={onClose} onSubmit={onSubmit} />
      ) : null}
    </Dialog>
  )
}

function ObjectiveForm({ today, takenAxes, onClose, onSubmit }: Omit<ObjectiveDialogProps, 'open'>) {
  const planner = usePlanner()
  const draft = useJourneyDraft(today, { axes: planner.axes, takenAxes, max: 1 })
  const entry = draft.entries[0]

  const submit = useAsyncAction(async () => {
    await onSubmit(draft.combined.plans)
    onClose()
  })

  if (!entry) {
    return (
      <EmptyState
        title="Nenhuma área disponível"
        description="Cria uma área nova ou arquiva um objetivo pra abrir espaço."
      />
    )
  }

  const axisTaken = takenAxes.includes(entry.axis)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Área</p>
        <AxisPicker
          axes={planner.axes}
          selected={[entry.axis]}
          taken={takenAxes}
          canAddMore
          onAdd={draft.addObjective}
          onRemove={() => undefined}
          onCreateAxis={async (label) => (await planner.createAxis(label))?.slug ?? null}
        />
      </div>

      {axisTaken ? (
        <p
          role="status"
          className="rounded-card border border-flame/30 bg-flame-dim/40 px-4 py-3 text-sm text-ink"
        >
          Essa área já tem um objetivo ativo. Escolhe outra, ou cria uma em “Outra área”.
        </p>
      ) : null}

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

      {/* Dito antes de gravar: a prévia mostra três etapas, e no gratuito só
          um objetivo carrega plano. Descobrir isso depois do clique seria a
          tela prometendo um caminho que o app não guardou. */}
      {planner.usage.plans.reached ? (
        <UpgradeHint message="Esse objetivo nasce sem etapas: o plano gratuito guarda um plano ativo por vez. O progresso dele vai medir o volume registrado." />
      ) : null}

      <div aria-live="polite" className="min-h-5">
        {submit.error ? <p className="text-sm text-danger">{submit.error}</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => void submit.run()} loading={submit.running} disabled={axisTaken}>
          <Icon name="check" className="size-4" />
          {planner.usage.plans.reached ? 'Criar objetivo' : 'Criar objetivo e plano'}
        </Button>
      </div>
    </div>
  )
}
