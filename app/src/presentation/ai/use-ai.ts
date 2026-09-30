import { useCallback, useMemo, useRef, useState } from 'react'
import type {
  AiCoachNudge,
  AiCoachRequest,
  AiDayPlan,
  AiPlanRequest,
  AiPlanSuggestion,
  AiProgressReading,
  AiProgressRequest,
  AiQuota,
  AiRecoveryPlan,
  AiReviewDraft,
  AiReviewDraftRequest,
  AiReviewRequest,
} from '@/domain/ai/ai-service'
import { buildAiContextBundle, type AiContextBundle } from '@/domain/ai/ai-context'
import { activityType, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import { capacityOf, checkInOfDay } from '@/domain/entities/checkin'
import { deadlineFrom } from '@/domain/entities/objective'
import { detectBlueprint } from '@/domain/entities/plan-blueprint'
import { estimatedMinutesOf, isPending, tasksOfDay } from '@/domain/entities/task'
import { AiError, type AiErrorCode } from '@/domain/ai/ai-error'
import { container } from '@/infrastructure/container'
import { useEvolution } from '@/presentation/evolution/use-evolution'
import { usePlanner } from '@/presentation/planner/use-planner'
import { useProgress } from '@/presentation/planner/use-progress'
import { DomainError, toUserMessage } from '@/shared/errors'

/**
 * Freio do lado do cliente. O teto de verdade é a franquia mensal no servidor;
 * este é só o que impede um duplo toque de virar duas leituras cobradas. É
 * por tipo de pedido: pedir o dia e depois a review é legítimo.
 */
const COOLDOWN_MS = 8_000

export interface AiCall<TResult, TArgs extends unknown[]> {
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
  const lastRun = useRef(0)
  const inFlight = useRef(false)

  const run = useCallback(
    async (...args: TArgs) => {
      // Uma chamada por vez, e um respiro entre duas: toque repetido não vira
      // pedido repetido.
      if (inFlight.current) return null
      const since = Date.now() - lastRun.current
      if (since < COOLDOWN_MS) {
        setError(`Calma: a última leitura foi há ${Math.ceil(since / 1000)}s. Tenta de novo em instantes.`)
        return null
      }

      inFlight.current = true
      lastRun.current = Date.now()
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
        // Erro de domínio antes de chamar (dia vazio, semana sem dado) não
        // gasta o respiro: a pessoa corrige e tenta de novo na hora.
        if (cause instanceof DomainError && !(cause instanceof AiError)) lastRun.current = 0
        return null
      } finally {
        inFlight.current = false
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

export interface ReviewDraftInput {
  readonly weekLabel: string
  readonly executionRate: number
  readonly habitsDone: number
  readonly habitsPlanned: number
  readonly tasksDone: number
  readonly tasksPlanned: number
  readonly activeDays: number
  readonly focusMinutes: number
  readonly written: AiReviewDraftRequest['written']
}

export interface RecoveryInput {
  readonly signals: readonly string[]
  readonly daysSinceLastMove: number
}

/**
 * A Momentumm AI ligada aos dados reais da conta, uma função por porta.
 *
 * A montagem do pedido acontece aqui e não no componente porque é ela que
 * define o que a IA vê. Deixar isso na tela abriria a porta pra duas telas
 * mandarem recortes diferentes e receberem leituras que se contradizem.
 *
 * O contexto é um recorte fechado (`buildAiContextBundle`): objetivos,
 * etapas, hábitos, ações, capacidade, progresso, score, últimos reviews e
 * vitórias recentes. Nada além disso sai do aparelho, nem e-mail, nem nome,
 * nem a observação do check-in. Os `refs` ficam aqui, do lado do app, e são a
 * única forma de a resposta apontar pra uma linha de verdade.
 */
export function useAi() {
  const planner = usePlanner()
  const progress = useProgress()
  const { summary: evolution } = useEvolution()

  const bundle = useMemo<AiContextBundle>(
    () =>
      buildAiContextBundle({
        today: planner.today,
        momentum: progress.momentum,
        factors: progress.factors,
        nextAction: progress.nextAction,
        streak: planner.streak,
        checkIns: planner.checkIns,
        objectives: progress.objectives,
        habits: planner.habits,
        habitLogs: planner.habitLogs,
      routineItems: planner.routineItems,
      routineOccurrences: planner.routineOccurrences,
        tasks: planner.tasks,
        reviews: planner.weeklyReviews,
        wins: planner.wins,
      }),
    [planner, progress],
  )
  const { context, refs } = bundle

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
      /*
        O roteiro da biblioteca vai junto quando o assunto é conhecido.

        A IA deixa de reinventar a estrutura de "emagrecer" a cada chamada e
        passa a gastar o raciocínio no que é específico DESTA pessoa. Em
        assunto que a biblioteca não conhece, `baseline` é nulo e ela monta do
        zero, que é justamente o que a IA existe pra cobrir.
      */
      baseline: baselineOf(draft.title, draft.axis, draft.motive),
    }
    return container.ai.buildPlan(request)
  })

  const plannedTodayMin = useMemo(
    () => estimatedMinutesOf(tasksOfDay(planner.tasks, planner.today).filter(isPending)),
    [planner.tasks, planner.today],
  )

  const reorganizeDay = useAiCall(async (availableMin: number): Promise<AiDayPlan> => {
    if (context.todayTasks.length === 0 && context.overdueTasks.length === 0) {
      throw new DomainError('Hoje não tem ação marcada: não há o que reorganizar.')
    }
    return container.ai.reorganizeDay({ context, availableMin, plannedMin: plannedTodayMin })
  })

  const request = useMemo<AiProgressRequest>(() => {
    const checkIn = checkInOfDay(planner.checkIns, planner.today)
    const capacity = capacityOf(checkIn)

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
      plannedTodayMin,
      capacityMin: capacity.suggestedFocusMin * capacity.suggestedActions,
      weakestFactor: progress.weakest?.label.toLowerCase() ?? null,
    }
  }, [context, planner.checkIns, planner.tasks, planner.today, plannedTodayMin, progress])

  const readProgress = useAiCall(async (): Promise<AiProgressReading> => {
    if (!progress.momentum.hasEnoughData && planner.activities.length === 0) {
      throw new DomainError('Ainda não há registro suficiente pra ler. Marca alguns dias e volta.')
    }
    return container.ai.readProgress(request)
  })

  const coachRequest = useMemo<AiCoachRequest>(
    () => ({
      context,
      momentum: progress.momentum.value,
      momentumLevel: progress.momentum.level,
      weekXp: evolution.weekXp,
      previousWeekXp: evolution.previousWeekXp,
      level: evolution.progress.level,
      levelName: evolution.progress.name,
      xpToNext: evolution.progress.xpToNext,
      streak: planner.streak.current,
      streakRecord: Math.max(planner.streak.record, planner.streak.current),
      activeDays: progress.last7.activeDays,
      windowDays: 7,
      stalledObjectives: progress.stalled.map((view) => view.progress.objective.title),
      overdueTasks: planner.tasks.filter((task) => isPending(task) && task.day < planner.today)
        .length,
      nextAction: progress.nextAction?.title ?? null,
    }),
    [context, progress, evolution, planner.streak, planner.tasks, planner.today],
  )

  const coach = useAiCall(async (): Promise<AiCoachNudge> => container.ai.coach(coachRequest))

  const draftReview = useAiCall(
    async (input: ReviewDraftInput): Promise<AiReviewDraft> =>
      container.ai.draftReview({ ...input, context }),
  )

  const planRecovery = useAiCall(
    async (input: RecoveryInput): Promise<AiRecoveryPlan> =>
      container.ai.planRecovery({ ...input, context }),
  )

  // A síntese do review não passa por `useAiCall`: ela não tem tela própria e o
  // resultado é gravado no review em vez de ficar em estado local.
  const summarizeReview = useCallback(
    (input: Omit<AiReviewRequest, 'context'>) => container.ai.summarizeReview({ ...input, context }),
    [context],
  )

  const quota: AiQuota | null = container.ai.quota

  return {
    simulated: container.ai.simulated,
    /** A IA é do PRO. Sem isso as portas mostram o convite, não o botão. */
    enabled: planner.limits.ai,
    quota,
    buildPlan,
    reorganizeDay,
    readProgress,
    draftReview,
    planRecovery,
    summarizeReview,
    coach,
    request,
    context,
    refs,
  }
}

export type AiController = ReturnType<typeof useAi>

/**
 * O roteiro da biblioteca no formato compacto que o prompt lê.
 *
 * Só o que ajuda o modelo a decidir: o degrau e o porquê dele, os nomes dos
 * hábitos e das ações, e o limite a repassar. Os números (fração de tempo,
 * minutos, pesos) ficam de fora de propósito, porque quem dimensiona é a
 * aritmética do `plan-builder`, e mandá-los aqui convidaria o modelo a
 * copiá-los sem saber quanto tempo esta pessoa tem.
 */
function baselineOf(
  title: string,
  axis: ActivityTypeSlug,
  motive: string,
): AiPlanRequest['baseline'] {
  const blueprint = detectBlueprint(title, axis, motive)
  if (!blueprint) return null

  return {
    label: blueprint.label,
    steps: blueprint.stages.map((stage) => ({
      title: stage.title,
      description: stage.description,
    })),
    habits: blueprint.habits.map((habit) => habit.name),
    tasks: blueprint.tasks.map((task) => task.title),
    caution: blueprint.caution ?? null,
  }
}
