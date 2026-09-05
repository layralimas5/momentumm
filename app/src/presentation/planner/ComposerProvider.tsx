import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { DayKey } from '@/domain/entities/day'
import type { Habit } from '@/domain/entities/habit'
import { isRunning } from '@/domain/entities/objective'
import type { Task } from '@/domain/entities/task'
import {
  Composer,
  type ComposerKind,
  type GoalDraft,
  type HabitDraft,
  type TaskDraft,
} from '@/presentation/components/dashboard/Composer'
import { ObjectiveDialog } from '@/presentation/components/dashboard/ObjectiveDialog'
import { usePlanner } from './use-planner'

interface OpenOptions {
  readonly editing?: Task | null
  readonly editingHabit?: Habit | null
  readonly presetGoalId?: string | null
  readonly presetObjectiveId?: string | null
  readonly presetDay?: DayKey | null
}

/**
 * O objetivo não entra no `Composer` porque não é um formulário: é uma
 * entrevista curta que termina num plano gerado. Forçá-lo no mesmo diálogo das
 * ações transformaria os dois numa coisa morna.
 */
export type ComposerTarget = ComposerKind | 'objetivo'

interface ComposerControls {
  open(kind: ComposerTarget, options?: OpenOptions): void
  close(): void
}

const ComposerContext = createContext<ComposerControls | null>(null)

/**
 * O criador de ações, hábitos e metas fica acima das páginas porque o botão
 * "Adicionar" do header e os cards do dashboard abrem o mesmo formulário. Dois
 * formulários iguais em lugares diferentes seria o começo da divergência.
 */
export function ComposerProvider({ children }: { children: ReactNode }) {
  const planner = usePlanner()
  const [kind, setKind] = useState<ComposerKind>('acao')
  const [open, setOpen] = useState(false)
  const [objectiveOpen, setObjectiveOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [presetGoalId, setPresetGoalId] = useState<string | null>(null)
  const [presetObjectiveId, setPresetObjectiveId] = useState<string | null>(null)
  const [presetDay, setPresetDay] = useState<DayKey | null>(null)

  const controls = useMemo<ComposerControls>(
    () => ({
      open(nextKind, options) {
        if (nextKind === 'objetivo') {
          setObjectiveOpen(true)
          return
        }
        setKind(nextKind)
        setEditing(options?.editing ?? null)
        setEditingHabit(options?.editingHabit ?? null)
        setPresetGoalId(options?.presetGoalId ?? null)
        setPresetObjectiveId(options?.presetObjectiveId ?? null)
        setPresetDay(options?.presetDay ?? null)
        setOpen(true)
      },
      close() {
        setOpen(false)
        setObjectiveOpen(false)
      },
    }),
    [],
  )

  const submitTask = useCallback(
    async (draft: TaskDraft, editingId: string | null) => {
      if (editingId) {
        await planner.updateTask(editingId, draft)
        return
      }
      await planner.createTask(draft)
    },
    [planner],
  )

  const submitHabit = useCallback(
    async (draft: HabitDraft, editingId: string | null) => {
      if (editingId) {
        await planner.updateHabit(editingId, draft)
        return
      }
      await planner.createHabit(draft)
    },
    [planner],
  )

  const submitGoal = useCallback(
    async (draft: GoalDraft) => {
      await planner.createGoal(draft)
    },
    [planner],
  )

  // Só objetivo em andamento entra no seletor. Pendurar uma ação nova num
  // objetivo pausado ou concluído cria trabalho que não vai aparecer no dia.
  const linkable = planner.objectives.filter(isRunning)

  return (
    <ComposerContext.Provider value={controls}>
      {children}
      <Composer
        open={open}
        kind={kind}
        axes={planner.axes}
        today={planner.today}
        goals={planner.goals}
        objectives={linkable}
        editing={editing}
        editingHabit={editingHabit}
        presetGoalId={presetGoalId}
        presetObjectiveId={presetObjectiveId}
        presetDay={presetDay}
        onClose={controls.close}
        onSubmitTask={submitTask}
        onSubmitHabit={submitHabit}
        onSubmitGoal={submitGoal}
      />
      <ObjectiveDialog
        open={objectiveOpen}
        today={planner.today}
        takenAxes={planner.objectives.map((objective) => objective.axis)}
        onClose={() => setObjectiveOpen(false)}
        onSubmit={planner.applyPlan}
      />
    </ComposerContext.Provider>
  )
}

export function useComposer(): ComposerControls {
  const controls = useContext(ComposerContext)
  if (!controls) {
    throw new Error('useComposer precisa estar dentro de <ComposerProvider>.')
  }
  return controls
}
