import { useCallback, useState, type ReactNode } from 'react'
import { addDays } from '@/domain/entities/day'
import type { AdaptiveItem } from '@/domain/entities/adaptive-day'
import type { Insight } from '@/domain/entities/insight'
import { CAPACITY_PROFILES } from '@/domain/entities/checkin'
import type { RecoveryStep } from '@/domain/entities/recovery'
import { shrinkToMinimal, type Task } from '@/domain/entities/task'
import { AiDayDialog } from '@/presentation/ai/AiDayDialog'
import { AiRecoveryDialog } from '@/presentation/ai/AiRecoveryDialog'
import { useAi } from '@/presentation/ai/use-ai'
import { AdaptiveDayReview } from '@/presentation/components/dashboard/AdaptiveDayReview'
import { CompletionNotice } from '@/presentation/components/dashboard/CompletionNotice'
import { useAdaptiveDay, type AdaptiveDayController } from './use-adaptive-day'
import { useCompletionNotice } from './use-completion-notice'
import { useDashboard, type DashboardView } from './use-dashboard'
import { useInsightActions } from './use-insight-actions'
import { usePlanner } from './use-planner'
import { useRecovery } from './use-recovery'

/** Minutos do dia em modo sem energia: a capacidade mínima, inteira. */
const LOW_ENERGY_MIN =
  CAPACITY_PROFILES.minima.suggestedFocusMin * CAPACITY_PROFILES.minima.suggestedActions

export interface DayControls {
  readonly view: DashboardView
  readonly adaptive: AdaptiveDayController
  readonly recovery: ReturnType<typeof useRecovery>
  readonly aiEnabled: boolean
  /** O check-in de hoje já disse "sem energia". */
  readonly lowEnergy: boolean
  /** As camadas (revisão do dia, diálogos da IA, aviso de conclusão). Renderizar uma vez. */
  readonly layer: ReactNode
  startFocus(task: Task, plannedMin?: number): void
  shrinkTask(task: Task): Promise<void>
  completeTask(task: Task): Promise<void>
  postponeTask(task: Task): Promise<void>
  /** "Hoje estou sem energia": registra o estado e propõe o dia na versão mínima. */
  startLowEnergy(): Promise<void>
  /** Desfaz o modo sem energia: o dia volta ao ritmo normal. */
  endLowEnergy(): Promise<void>
  chooseRecoveryStep(step: RecoveryStep): void
  /** Aplica a sugestão do insight e o tira da tela: ele já foi resolvido. */
  applyInsight(insight: Insight): Promise<void>
  openAiDay(): void
  openAiRecovery(): void
}

/**
 * Os verbos do dia, num lugar só.
 *
 * Hoje e Rotina mostram o mesmo dia de dois ângulos e reorganizam pelos mesmos
 * caminhos: dia adaptável, modo sem energia, modo retomada e IA. Duas cópias
 * dessa lógica seriam duas contas discordando na primeira mudança de regra.
 */
export function useDayControls(): DayControls {
  const planner = usePlanner()
  const view = useDashboard()
  const adaptive = useAdaptiveDay(view)
  const recovery = useRecovery(view)
  const ai = useAi()
  const completion = useCompletionNotice(view)
  const { apply, startFocus, shrinkTask } = useInsightActions(view)
  const [aiDayOpen, setAiDayOpen] = useState(false)
  const [aiRecoveryOpen, setAiRecoveryOpen] = useState(false)

  const lowEnergy = view.checkIn?.mood === 'sem-energia'

  const completeTask = useCallback(
    async (task: Task) => {
      await planner.updateTask(task.id, { status: 'feita', completedAt: new Date() })
    },
    [planner],
  )

  const postponeTask = useCallback(
    async (task: Task) => {
      const base = task.day < planner.today ? planner.today : task.day
      await planner.updateTask(task.id, { day: addDays(base, 1), isMainPriority: false })
    },
    [planner],
  )

  const startLowEnergy = useCallback(async () => {
    await planner.saveCheckIn({
      day: planner.today,
      mood: 'sem-energia',
      energy: 1,
      focus: view.checkIn?.focus ?? 'oscilando',
      note: view.checkIn?.note ?? null,
    })
    adaptive.open({
      availableMin: LOW_ENERGY_MIN,
      intro: 'Dia de baixa energia: ficou só o essencial. O resto foi pra frente, sem quebrar a sequência.',
    })
  }, [planner, view.checkIn, adaptive])

  const endLowEnergy = useCallback(async () => {
    await planner.saveCheckIn({
      day: planner.today,
      mood: 'estavel',
      energy: 3,
      focus: view.checkIn?.focus ?? 'oscilando',
      note: view.checkIn?.note ?? null,
    })
  }, [planner, view.checkIn])

  /**
   * O passo de retomada escolhido vira a prioridade protegida do dia, e o resto
   * se reorganiza em volta dele. Nada do que ficou pra trás é somado.
   */
  const chooseRecoveryStep = useCallback(
    (step: RecoveryStep) => {
      const isTask = step.kind === 'acao'
      adaptive.open({
        availableMin: recovery.budgetFor(step),
        protectIds: [step.id],
        fromRecovery: true,
        intro: `Passo escolhido: ${step.title}. O resto do dia se reorganiza em volta dele, e nada do que ficou pra trás foi somado aqui.`,
        ...(isTask && step.fromAnotherDay ? { bringId: step.id } : {}),
        ...(isTask ? { promoteId: step.id } : {}),
        ...(isTask && step.minimal ? { minimalId: step.id } : {}),
      })
    },
    [adaptive, recovery],
  )

  const applyInsight = useCallback(
    async (insight: Insight) => {
      await apply(insight)
      view.dismissInsight(insight.id)
    },
    [apply, view],
  )

  const confirmAdaptive = useCallback(async () => {
    const fromRecovery = adaptive.request?.fromRecovery === true
    const applied = await adaptive.confirm()
    if (applied && fromRecovery) recovery.dismiss()
    return applied
  }, [adaptive, recovery])

  /** Encolher antes do cronômetro: é o tamanho escolhido que a sessão mede. */
  const startFromReview = useCallback(
    async (item: AdaptiveItem, size: 'completa' | 'minima') => {
      const applied = await confirmAdaptive()
      if (!applied) return
      const task = planner.tasks.find((candidate) => candidate.id === item.id)
      if (!task) return

      if (size === 'minima' && task.minimalVersion) {
        await shrinkTask(task)
        const smaller = shrinkToMinimal(task)
        startFocus({ ...task, ...smaller }, smaller.estimatedMin)
        return
      }
      startFocus(task, task.estimatedMin)
    },
    [confirmAdaptive, planner.tasks, shrinkTask, startFocus],
  )

  const layer = (
    <>
      <CompletionNotice notice={completion.notice} onDismiss={completion.dismiss} />
      <AdaptiveDayReview
        plan={adaptive.plan}
        intro={adaptive.request?.intro}
        applying={adaptive.applying}
        error={adaptive.error}
        onConfirm={() => void confirmAdaptive()}
        onStart={(item, size) => void startFromReview(item, size)}
        onClose={adaptive.close}
      />
      <AiDayDialog
        open={aiDayOpen}
        ai={ai}
        defaultAvailableMin={view.capacity.suggestedFocusMin * view.capacity.suggestedActions}
        plannedMin={adaptive.load.minutes}
        onClose={() => setAiDayOpen(false)}
      />
      {recovery.state ? (
        <AiRecoveryDialog
          open={aiRecoveryOpen}
          ai={ai}
          state={recovery.state}
          onApplied={recovery.dismiss}
          onClose={() => setAiRecoveryOpen(false)}
        />
      ) : null}
    </>
  )

  return {
    view,
    adaptive,
    recovery,
    aiEnabled: ai.enabled,
    lowEnergy,
    layer,
    startFocus,
    shrinkTask,
    completeTask,
    postponeTask,
    startLowEnergy,
    endLowEnergy,
    chooseRecoveryStep,
    applyInsight,
    openAiDay: () => setAiDayOpen(true),
    openAiRecovery: () => setAiRecoveryOpen(true),
  }
}
