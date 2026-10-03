import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AgendaItem } from '@/domain/entities/day-agenda'
import type { RoutineItem, RoutineRecurrence } from '@/domain/entities/routine-item'
import { InsightCard } from '@/presentation/components/ds/InsightCard'
import { DashboardSkeleton } from '@/presentation/components/dashboard/DashboardSkeleton'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { AddSheet } from '@/presentation/layouts/AddSheet'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { useDayControls } from '@/presentation/planner/use-day-controls'
import { usePlanner } from '@/presentation/planner/use-planner'
import { EnergyAdjustCard, RoutineHero, RoutineTimeline, WeeklyRoutineCard } from '@/presentation/routine/RoutineCards'
import { RoutineItemDialog } from '@/presentation/routine/RoutineItemDialog'
import { readRoutinePrefill, type RoutinePrefill } from '@/presentation/routine/routine-prefill'
import { useDayToggle } from '@/presentation/today/day-items'

/**
 * Rotina: o dia como protocolo. O quanto já saiu (anel), a saída pra dia
 * pesado (energia e retomada), a leitura do ritmo (insight) e a linha do
 * tempo inteira. A rotina semanal, que se mexe pouco, fica recolhida no fim.
 */
export function RoutinePage() {
  const planner = usePlanner()
  const composer = useComposer()
  const day = useDayControls()
  const { view } = day
  const { busyKey, toggleAgenda } = useDayToggle()
  const [params, setParams] = useSearchParams()

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<RoutineItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [removing, setRemoving] = useState<RoutineItem | null>(null)
  const [presetRecurrence, setPresetRecurrence] = useState<RoutineRecurrence | null>(null)
  const [presetFromPlan, setPresetFromPlan] = useState<RoutinePrefill | null>(null)

  /*
    `?novo=1` abre o formulário (vem do "Adicionar"); `?editar=<id>` abre um
    item. Os dois são consumidos na hora: voltar pelo histórico não reabre nada.
  */
  useEffect(() => {
    if (params.get('novo') === '1') {
      setEditing(null)
      setPresetRecurrence(params.get('tipo') === 'compromisso' ? 'unica' : null)
      setPresetFromPlan(readRoutinePrefill(params))
      setDialogOpen(true)
      setParams({}, { replace: true })
      return
    }

    const target = params.get('editar')
    if (!target) return
    const item = planner.routineItems.find((entry) => entry.id === target)
    if (item) {
      setEditing(item)
      setPresetRecurrence(null)
      setPresetFromPlan(null)
      setDialogOpen(true)
    }
    setParams({}, { replace: true })
  }, [params, setParams, planner.routineItems])

  if (planner.loading) return <DashboardSkeleton mobile />

  const openItem = (item: AgendaItem) => {
    if (item.task) composer.open('acao', { editing: item.task })
    else if (item.habitState) composer.open('habito', { editingHabit: item.habitState.habit })
    else if (item.routineState) {
      setEditing(item.routineState.item)
      setDialogOpen(true)
    }
  }

  const openBlocks = view.agenda.items.filter((item) => !item.done && !item.skipped).length
  const dateLabel = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })

  return (
    <div className="flex flex-col gap-4 pb-2">
      {planner.error ? <ErrorNote message={planner.error} onRetry={() => void planner.reload()} /> : null}

      <RoutineHero agenda={view.agenda} />

      <EnergyAdjustCard
        aiEnabled={day.aiEnabled}
        lowEnergy={day.lowEnergy}
        openBlocks={openBlocks}
        recovery={day.recovery.state}
        onLowEnergy={() => void day.startLowEnergy()}
        onUndoLowEnergy={() => void day.endLowEnergy()}
        onChooseRecovery={day.chooseRecoveryStep}
        onAiRecovery={day.openAiRecovery}
      />

      {view.insight ? (
        <InsightCard
          label="Insight preditivo"
          tag="Oportunidade"
          message={view.insight.recommendation}
          detail={view.insight.reason}
          actionLabel={view.insight.actionLabel}
          onAction={() => {
            if (view.insight) void day.applyInsight(view.insight)
          }}
          onDismiss={() => {
            if (view.insight) view.dismissInsight(view.insight.id)
          }}
        />
      ) : null}

      <RoutineTimeline
        agenda={view.agenda}
        busyKey={busyKey}
        onToggle={(item) => void toggleAgenda(item)}
        onOpen={openItem}
        dateLabel={`Hoje · ${dateLabel}`}
      />

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="press flex min-h-14 items-center justify-center gap-2 rounded-[1.15rem] border-2 border-dashed border-brand/25 text-sm font-semibold text-brand-hi"
      >
        <Icon name="mais" className="size-5" strokeWidth={2.25} />
        Adicionar Bloco ou Conectar a Objetivo
      </button>

      <WeeklyRoutineCard
        items={planner.routineItems}
        onEdit={(item) => {
          setEditing(item)
          setDialogOpen(true)
        }}
        onRemove={setRemoving}
      />

      <AddSheet open={adding} onClose={() => setAdding(false)} />

      <RoutineItemDialog
        open={dialogOpen}
        editing={editing}
        presetDay={planner.today}
        presetRecurrence={presetRecurrence}
        presetFromPlan={presetFromPlan}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
          setPresetFromPlan(null)
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Tirar da rotina?"
        description={
          removing ? `"${removing.title}" sai dos próximos dias. O que já foi marcado continua no histórico.` : ''
        }
        confirmLabel="Tirar da rotina"
        onConfirm={async () => {
          if (removing) await planner.archiveRoutineItem(removing.id)
          setRemoving(null)
        }}
        onClose={() => setRemoving(null)}
      />

      {day.layer}
    </div>
  )
}
