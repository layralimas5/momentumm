import { useCallback, useMemo, useState } from 'react'
import { totalMinutes } from '@/domain/entities/activity'
import { addDays, dayKeyOf, type DayKey } from '@/domain/entities/day'
import { capacityOf, checkInOfDay, type CapacityProfile, type CheckIn } from '@/domain/entities/checkin'
import { paceOf, type GoalPace, type GoalProgress } from '@/domain/entities/goal'
import { habitDayProgress, habitDayStates, type HabitDayProgress, type HabitDayState } from '@/domain/entities/habit'
import {
  primaryInsight,
  type Insight,
  type InsightInput,
  type ObjectiveInsightInput,
} from '@/domain/entities/insight'
import { planRatioAt } from '@/domain/entities/plan-progress'
import { MOMENTUM_WINDOW_DAYS } from '@/domain/entities/momentum'
import {
  calculateMomentum,
  recommendationFor,
  type MomentumInput,
  type MomentumScore,
} from '@/domain/entities/momentum'
import { isPending, mainPriorityOf, nextTaskForGoal, supportingTasksOf, type Task } from '@/domain/entities/task'
import { summarizeWeek, type WeeklySummary } from '@/domain/entities/week'
import { winOfDay, type Win } from '@/domain/entities/win'
import { usePlanner } from './use-planner'
import { useObjectives, type ObjectiveView } from './use-objectives'

const DISMISSED_KEY = 'momentumm.insights.dismissed.v1'

export interface GoalInMotion {
  readonly progress: GoalProgress
  readonly pace: GoalPace
  readonly nextTask: Task | null
}

/** Uma ação com o caminho dela: objetivo, etapa e por que ela importa hoje. */
export interface NextUp {
  readonly task: Task
  readonly view: ObjectiveView
  readonly stageTitle: string | null
  readonly reason: string
}

export interface DayProgress {
  readonly done: number
  readonly total: number
  /** 0 a 1: hábitos e ações do dia somados. */
  readonly ratio: number
}

export interface DashboardView {
  readonly checkIn: CheckIn | null
  /**
   * Os objetivos com plano e previsão. O dia lê daqui pra dizer a que etapa e
   * a que objetivo cada linha pertence — é o que separa uma lista de tarefas
   * de um sistema de progresso.
   */
  readonly objectives: readonly ObjectiveView[]
  /** A próxima ação recomendada, com o contexto dela. Null quando não há. */
  readonly nextUp: NextUp | null
  /** Quanto do dia já saiu, contando hábitos e ações juntos. */
  readonly dayProgress: DayProgress
  /**
   * O recado de retomada quando ontem ficou pra trás. Null quando não há nada
   * a retomar — a mensagem só aparece se muda alguma decisão de hoje.
   */
  readonly resumeNote: string | null
  readonly capacity: CapacityProfile
  readonly momentum: MomentumScore
  readonly recommendation: string
  readonly mainPriority: Task | null
  readonly supportingTasks: readonly Task[]
  readonly habitStates: readonly HabitDayState[]
  readonly habitProgress: HabitDayProgress
  readonly week: WeeklySummary
  readonly goalsInMotion: readonly GoalInMotion[]
  readonly insight: Insight | null
  readonly todayWin: Win | null
  readonly focusMinutesToday: number
  /** Todos os hábitos do dia concluídos: o dashboard muda de tom. */
  readonly dayComplete: boolean
  dismissInsight(id: string): void
}

/**
 * A leitura do dia. Aqui as seções deixam de ser independentes: o check-in
 * define a capacidade, a capacidade calibra a recomendação, hábitos e ações
 * alimentam o momentum, o momentum vira progresso semanal e o conjunto gera o
 * insight. Nenhuma dessas contas mora em componente.
 */
export function useDashboard(): DashboardView {
  const planner = usePlanner()
  const objectives = useObjectives()
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(loadDismissed)

  const {
    today,
    activities,
    todayActivities,
    habits,
    habitLogs,
    tasks,
    checkIns,
    wins,
    goalProgress,
    streak,
  } = planner

  const checkIn = useMemo(() => checkInOfDay(checkIns, today), [checkIns, today])
  const capacity = useMemo(() => capacityOf(checkIn), [checkIn])

  /**
   * O avanço de plano na janela do momentum, somado entre os objetivos.
   *
   * É o que faz fechar uma etapa mexer no ritmo — sem isso o momentum
   * enxergaria só hábito e ação solta, e uma semana de trabalho pesado num
   * objetivo apareceria como semana parada.
   */
  const planGains = useMemo<Pick<MomentumInput, 'planGain' | 'previousPlanGain'>>(() => {
    const running = objectives.filter((view) => view.plan.hasPlan)
    // Objeto vazio, não `undefined` explícito: sem plano nenhum o fator fica
    // neutro no momentum em vez de valer zero.
    if (running.length === 0) return {}

    const gainSince = (end: DayKey) => {
      const start = addDays(end, -(MOMENTUM_WINDOW_DAYS - 1))
      const total = running.reduce(
        (sum, view) =>
          sum +
          (planRatioAt(view.plan.stages, end, dayKeyOf) -
            planRatioAt(view.plan.stages, start, dayKeyOf)),
        0,
      )
      return Math.max(0, total / running.length)
    }

    return {
      planGain: gainSince(today),
      previousPlanGain: gainSince(addDays(today, -MOMENTUM_WINDOW_DAYS)),
    }
  }, [objectives, today])

  const momentumInput = useMemo<MomentumInput>(
    () => ({
      activities,
      habits,
      habitLogs,
      tasks,
      today,
      weeklyReviews: planner.weeklyReviews,
      ...planGains,
    }),
    [activities, habits, habitLogs, tasks, today, planner.weeklyReviews, planGains],
  )

  const momentum = useMemo(() => calculateMomentum(momentumInput), [momentumInput])
  const week = useMemo(() => summarizeWeek(momentumInput), [momentumInput])

  const habitStates = useMemo(
    () => habitDayStates(habits, habitLogs, today),
    [habits, habitLogs, today],
  )
  const habitProgress = useMemo(() => habitDayProgress(habitStates), [habitStates])

  const mainPriority = useMemo(() => mainPriorityOf(tasks, today), [tasks, today])
  const supportingTasks = useMemo(() => supportingTasksOf(tasks, today), [tasks, today])

  const goalsInMotion = useMemo<GoalInMotion[]>(
    () =>
      goalProgress.map((progress) => ({
        progress,
        pace: paceOf(progress, today),
        nextTask: nextTaskForGoal(tasks, progress.goal.id),
      })),
    [goalProgress, tasks, today],
  )

  const objectiveInput = useMemo<ObjectiveInsightInput[]>(
    () => objectives.map((view) => ({ plan: view.plan, forecast: view.forecast })),
    [objectives],
  )

  const insight = useMemo(() => {
    const input: InsightInput = {
      activities,
      habits,
      habitLogs,
      tasks,
      checkIns,
      streak,
      momentum,
      capacity,
      today,
      objectives: objectiveInput,
    }
    return primaryInsight(input, dismissed)
  }, [
    activities,
    habits,
    habitLogs,
    tasks,
    checkIns,
    streak,
    momentum,
    capacity,
    today,
    objectiveInput,
    dismissed,
  ])

  /**
   * A próxima ação, com o motivo dela.
   *
   * A prioridade principal vem primeiro por ser uma escolha explícita da
   * pessoa. Sem ela, o app propõe a próxima ação do objetivo mais apertado —
   * e diz por quê, porque uma sugestão sem motivo é indistinguível de um chute.
   */
  const nextUp = useMemo<NextUp | null>(() => {
    const candidates = objectives.filter((view) => view.plan.nextTask !== null)
    if (candidates.length === 0) return null

    const chosen =
      candidates.find((view) => view.plan.nextTask?.id === mainPriority?.id) ??
      candidates.find((view) => view.plan.bottleneck !== null) ??
      candidates[0]

    const task = chosen?.plan.nextTask
    if (!chosen || !task) return null

    const stage =
      chosen.plan.stages.find((item) => item.stage.id === task.stageId)?.stage ?? null

    const reason =
      chosen.plan.bottleneck?.stage.id === stage?.id && stage
        ? `Destrava a etapa ${stage.title}, que está segurando o objetivo.`
        : stage
          ? `Próximo passo da etapa ${stage.title}.`
          : 'Próxima ação em aberto desse objetivo.'

    return { task, view: chosen, stageTitle: stage?.title ?? null, reason }
  }, [objectives, mainPriority])

  const dismissInsight = useCallback((id: string) => {
    setDismissed((current) => {
      const next = new Set(current)
      next.add(id)
      persistDismissed(next)
      return next
    })
  }, [])

  const pendingToday = tasks.filter((task) => task.day === today && isPending(task)).length

  const dayProgress = useMemo<DayProgress>(() => {
    const dayTasks = tasks.filter((task) => task.day === today && task.status !== 'cancelada')
    const tasksDone = dayTasks.filter((task) => task.status === 'feita').length

    const total = habitProgress.total + dayTasks.length
    const done = habitProgress.done + tasksDone

    return { done, total, ratio: total === 0 ? 0 : done / total }
  }, [tasks, today, habitProgress])

  /**
   * A retomada.
   *
   * O tom aqui é decisão de produto, não de copy: a frase diz o que ficou e o
   * que dá pra fazer, e nunca quantos dias foram perdidos. "Você quebrou uma
   * sequência de 12 dias" é verdade e é exatamente o que faz a pessoa não
   * voltar.
   */
  const resumeNote = useMemo(() => {
    const yesterday = addDays(today, -1)

    const missedTasks = tasks.filter((task) => task.day === yesterday && isPending(task)).length
    const scheduledYesterday = habitDayStates(habits, habitLogs, yesterday)
    const missedHabits = scheduledYesterday.filter((state) => state.status === 'pendente').length

    if (missedTasks === 0 && missedHabits === 0) return null

    const parts: string[] = []
    if (missedTasks > 0) {
      parts.push(`${missedTasks} ${missedTasks === 1 ? 'ação' : 'ações'}`)
    }
    if (missedHabits > 0) {
      parts.push(`${missedHabits} ${missedHabits === 1 ? 'hábito' : 'hábitos'}`)
    }

    return `Ontem ficaram ${parts.join(' e ')} sem sair. Não precisa compensar: escolhe o que ainda faz sentido hoje e segue daqui.`
  }, [tasks, habits, habitLogs, today])

  return {
    checkIn,
    objectives,
    nextUp,
    dayProgress,
    resumeNote,
    capacity,
    momentum,
    recommendation: recommendationFor(momentum, capacity),
    mainPriority,
    supportingTasks,
    habitStates,
    habitProgress,
    week,
    goalsInMotion,
    insight,
    todayWin: winOfDay(wins, today),
    focusMinutesToday: totalMinutes(todayActivities),
    dayComplete: habitProgress.allDone && pendingToday === 0 && habitProgress.total > 0,
    dismissInsight,
  }
}

/**
 * Insight dispensado fica só no dispositivo: é preferência de leitura, não dado
 * de negócio, e não vale uma escrita de rede.
 */
function loadDismissed(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function persistDismissed(ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
  } catch {
    // Sem armazenamento o insight simplesmente volta na próxima sessão.
  }
}
