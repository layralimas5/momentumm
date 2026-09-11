import { useCallback, useMemo, useState } from 'react'
import type {
  AiPlanRequest,
  AiPlanSuggestion,
  AiProgressReading,
  AiProgressRequest,
  AiReviewRequest,
} from '@/domain/ai/ai-service'
import { buildAiContext, type AiUserContext } from '@/domain/ai/ai-context'
import { activityType } from '@/domain/entities/activity-type'
import { capacityOf, checkInOfDay } from '@/domain/entities/checkin'
import { deadlineFrom } from '@/domain/entities/objective'
import { estimatedMinutesOf, isPending, tasksOfDay } from '@/domain/entities/task'
import { AiError, type AiErrorCode } from '@/domain/ai/ai-error'
import { container } from '@/infrastructure/container'
import { usePlanner } from '@/presentation/planner/use-planner'
import { useProgress } from '@/presentation/planner/use-progress'
import { toUserMessage } from '@/shared/errors'

interface AiCall<TResult, TArgs extends unknown[]> {
  readonly result: TResult | null
  readonly loading: boolean
  readonly error: string | null
  /** O código do erro da IA, quando é dela: a tela decide o que oferecer. */
  readonly errorCode: AiErrorCode | null
  run(...args: TArgs): Promise<TResult | null>
  reset(): void
}

function useAiCall<TResult, TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<TResult>,
): AiCall<TResult, TArgs> {
  const [result, setResult] = useState<TResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<AiErrorCode | null>(null)

  const run = useCallback(
    async (...args: TArgs) => {
      setLoading(true)
      setError(null)
      setErrorCode(null)
      try {
        const value = await action(...args)
        setResult(value)
        return value
      } catch (cause) {
        setError(toUserMessage(cause))
        setErrorCode(cause instanceof AiError ? cause.code : null)
        return null
      } finally {
        setLoading(false)
      }
    },
    [action],
  )

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
    setErrorCode(null)
  }, [])

  return { result, loading, error, errorCode, run, reset }
}

export interface PlanRequestDraft {
  readonly title: string
  readonly axis: string
  readonly target: number
  readonly days: number
  readonly minutesPerDay: number
  readonly motive: string
}

/**
 * As duas funções do Momentumm AI ligadas aos dados reais da conta.
 *
 * A montagem do pedido acontece aqui e não no componente porque é ela que
 * define o que a IA vê. Deixar isso na tela abriria a porta pra duas telas
 * mandarem recortes diferentes e receberem leituras que se contradizem.
 */
export function useAi() {
  const planner = usePlanner()
  const progress = useProgress()

  // Um contexto só pros três pedidos, recalculado quando o snapshot muda.
  const context = useMemo<AiUserContext>(
    () =>
      buildAiContext({
        today: planner.today,
        momentum: progress.momentum,
        factors: progress.factors,
        nextAction: progress.nextAction,
        streak: planner.streak,
        checkIns: planner.checkIns,
        objectives: progress.objectives,
        habits: planner.habits,
        habitLogs: planner.habitLogs,
        tasks: planner.tasks,
        reviews: planner.weeklyReviews,
        wins: planner.wins,
      }),
    [planner, progress],
  )

  const buildPlan = useAiCall(async (draft: PlanRequestDraft): Promise<AiPlanSuggestion> => {
    const axis = activityType(draft.axis)
    const request: AiPlanRequest = {
      context,
      title: draft.title,
      axis: draft.axis,
      target: draft.target,
      unitLabel: axis.unitLabel.many,
      startedOn: planner.today,
      deadline: deadlineFrom(planner.today, draft.days),
      minutesPerDay: draft.minutesPerDay,
      motive: draft.motive.trim() || null,
    }
    return container.ai.buildPlan(request)
  })

  const request = useMemo<AiProgressRequest>(() => {
    const checkIn = checkInOfDay(planner.checkIns, planner.today)
    const capacity = capacityOf(checkIn)
    const todayTasks = tasksOfDay(planner.tasks, planner.today).filter(isPending)

    return {
      context,
      momentum: progress.momentum.value,
      momentumLevel: progress.momentum.level,
      activeDays: progress.last7.activeDays,
      windowDays: 7,
      habitRate: progress.last7.habits.ratio,
      taskRate: progress.last7.tasks.ratio,
      stalledObjectives: progress.stalled.map((view) => view.progress.objective.title),
      overdueTasks: planner.tasks.filter((task) => isPending(task) && task.day < planner.today)
        .length,
      plannedTodayMin: estimatedMinutesOf(todayTasks),
      capacityMin: capacity.suggestedFocusMin * capacity.suggestedActions,
      weakestFactor: progress.weakest?.label.toLowerCase() ?? null,
    }
  }, [context, planner.checkIns, planner.tasks, planner.today, progress])

  const readProgress = useAiCall(
    async (): Promise<AiProgressReading> => container.ai.readProgress(request),
  )

  // A síntese do review não passa por `useAiCall`: ela não tem tela própria e o
  // resultado é gravado no review em vez de ficar em estado local.
  const summarizeReview = useCallback(
    (input: Omit<AiReviewRequest, 'context'>) => container.ai.summarizeReview({ ...input, context }),
    [context],
  )

  return {
    simulated: container.ai.simulated,
    buildPlan,
    readProgress,
    summarizeReview,
    request,
    context,
  }
}
