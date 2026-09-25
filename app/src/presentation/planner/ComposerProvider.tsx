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
import { PlanLimitDialog, type PlanLimitNotice } from '@/presentation/plan/PlanLimitDialog'
import { usePlanner } from './use-planner'

interface OpenOptions {
  readonly editing?: Task | null
  readonly editingHabit?: Habit | null
  readonly presetGoalId?: string | null
  readonly presetObjectiveId?: string | null
  /** Etapa já escolhida quando a ação nasce de dentro de uma etapa do plano. */
  readonly presetStageId?: string | null
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
  const [presetStageId, setPresetStageId] = useState<string | null>(null)
  const [presetDay, setPresetDay] = useState<DayKey | null>(null)
  const [limitNotice, setLimitNotice] = useState<PlanLimitNotice | null>(null)

  /*
    O limite é checado na porta, antes do formulário abrir. Abrir, preencher e
    só então ouvir "não cabe" é o jeito de fazer a pessoa não tentar de novo.
    Editar nunca é barrado: o que já existe continua editável em qualquer plano.
  */
  const { usage, today } = planner
  const limitFor = useCallback(
    (nextKind: ComposerTarget, options?: OpenOptions): PlanLimitNotice | null => {
      if (options?.editing || options?.editingHabit) return null
      const check =
        nextKind === 'objetivo'
          ? { feature: 'Objetivos ativos', limit: usage.objectives }
          : nextKind === 'habito'
            ? { feature: 'Hábitos ativos', limit: usage.habits }
            : nextKind === 'acao'
              ? { feature: 'Ações no dia', limit: usage.actionsOn(options?.presetDay ?? today) }
              : null
      if (!check || !check.limit.reached || !check.limit.message) return null
      return { feature: check.feature, message: check.limit.message }
    },
    [usage, today],
  )

  const controls = useMemo<ComposerControls>(
    () => ({
      open(nextKind, options) {
        const notice = limitFor(nextKind, options)
        if (notice) {
          setLimitNotice(notice)
          return
        }
        if (nextKind === 'objetivo') {
          setObjectiveOpen(true)
          return
        }
        setKind(nextKind)
        setEditing(options?.editing ?? null)
        setEditingHabit(options?.editingHabit ?? null)
        setPresetGoalId(options?.presetGoalId ?? null)
        setPresetObjectiveId(options?.presetObjectiveId ?? null)
        setPresetStageId(options?.presetStageId ?? null)
        setPresetDay(options?.presetDay ?? null)
        setOpen(true)
      },
      close() {
        setOpen(false)
        setObjectiveOpen(false)
      },
    }),
    [limitFor],
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
        presetStageId={presetStageId}
        stages={planner.planStages}
        presetDay={presetDay}
        onClose={controls.close}
        onSubmitTask={submitTask}
        onSubmitHabit={submitHabit}
        onSubmitGoal={submitGoal}
      />
      <ObjectiveDialog
        open={objectiveOpen}
        today={planner.today}
        takenAxes={planner.usage.takenAxes}
        onClose={() => setObjectiveOpen(false)}
        onSubmit={planner.applyPlan}
      />
      <PlanLimitDialog notice={limitNotice} onClose={() => setLimitNotice(null)} />
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
