import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Task } from '@/domain/entities/task'
import {
  Composer,
  type ComposerKind,
  type GoalDraft,
  type HabitDraft,
  type TaskDraft,
} from '@/presentation/components/dashboard/Composer'
import { usePlanner } from './use-planner'

interface OpenOptions {
  readonly editing?: Task | null
  readonly presetGoalId?: string | null
}

interface ComposerControls {
  open(kind: ComposerKind, options?: OpenOptions): void
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
  const [editing, setEditing] = useState<Task | null>(null)
  const [presetGoalId, setPresetGoalId] = useState<string | null>(null)

  const controls = useMemo<ComposerControls>(
    () => ({
      open(nextKind, options) {
        setKind(nextKind)
        setEditing(options?.editing ?? null)
        setPresetGoalId(options?.presetGoalId ?? null)
        setOpen(true)
      },
      close() {
        setOpen(false)
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
    async (draft: HabitDraft) => {
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

  return (
    <ComposerContext.Provider value={controls}>
      {children}
      <Composer
        open={open}
        kind={kind}
        today={planner.today}
        goals={planner.goals}
        editing={editing}
        presetGoalId={presetGoalId}
        onClose={controls.close}
        onSubmitTask={submitTask}
        onSubmitHabit={submitHabit}
        onSubmitGoal={submitGoal}
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
