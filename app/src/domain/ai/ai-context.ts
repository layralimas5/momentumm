import { activityType } from '@/domain/entities/activity-type'
import { capacityOf, checkInOfDay, type CheckIn } from '@/domain/entities/checkin'
import { addDays, type DayKey } from '@/domain/entities/day'
import { forecastLabel, type Forecast } from '@/domain/entities/forecast'
import {
  countsAsDone,
  HABIT_FREQUENCY_LABELS,
  habitConsistency,
  habitsScheduledOn,
  statusOf,
  type Habit,
  type HabitLog,
} from '@/domain/entities/habit'
import {
  MOMENTUM_LEVEL_LABELS,
  type MomentumFactor,
  type MomentumScore,
} from '@/domain/entities/momentum'
import type { MomentumNextAction } from '@/domain/entities/momentum-next-action'
import { OBJECTIVE_STATE_LABELS, type ObjectiveProgress } from '@/domain/entities/objective'
import type { PlanProgress } from '@/domain/entities/plan-progress'
import type { Streak } from '@/domain/entities/streak'
import { isPending, type Task } from '@/domain/entities/task'
import { weekLabel, type WeeklyReview } from '@/domain/entities/weekly-review'
import type { Win } from '@/domain/entities/win'

/**
 * O que a Momentumm AI enxerga da conta.
 *
 * É um recorte FECHADO e montado num lugar só: objetivos com plano e previsão,
 * hábitos com constância, o dia como está, os últimos reviews e o score aberto
 * em fatores. Duas telas montando recortes diferentes receberiam leituras que
 * se contradizem — e a IA é a única parte do produto que fala em prosa, então
 * a contradição apareceria escrita.
 *
 * Nenhum id atravessa a fronteira: a IA devolve estrutura por posição
 * (`stepIndex`) e texto, nunca referências que o app precise confiar.
 */

export interface AiContextObjective {
  readonly title: string
  readonly axis: string
  readonly motive: string | null
  readonly priority: string
  readonly state: string
  readonly deadline: DayKey
  readonly daysLeft: number
  /** Volume registrado contra o alvo, na unidade do eixo. */
  readonly volume: { readonly done: number; readonly target: number; readonly unit: string }
  /** Execução ponderada do plano (0-100), ou null quando não há etapas. */
  readonly planPercent: number | null
  readonly stages: readonly {
    readonly title: string
    readonly weightPercent: number
    readonly status: string
    readonly dueOn: DayKey | null
    readonly tasksDone: number
    readonly tasksTotal: number
  }[]
  readonly currentStage: string | null
  readonly bottleneck: string | null
  readonly nextAction: string | null
  readonly overdueActions: number
  readonly forecast: string
  readonly habitCount: number
}

export interface AiContextHabit {
  readonly name: string
  readonly axis: string
  readonly frequency: string
  readonly target: number
  readonly minimalTarget: number
  readonly unit: string
  readonly objective: string | null
  /** Constância nas últimas duas semanas, 0-100. */
  readonly consistencyPercent: number
  readonly doneLast7: number
  readonly scheduledToday: boolean
  readonly doneToday: boolean
}

export interface AiContextTask {
  readonly title: string
  readonly day: DayKey
  readonly estimatedMin: number
  readonly priority: string
  readonly status: string
  readonly isMainPriority: boolean
  readonly objective: string | null
  readonly minimalVersion: string | null
}

export interface AiContextReview {
  readonly week: string
  readonly achievements: string | null
  readonly difficulties: string | null
  readonly learnings: string | null
  readonly adjustments: string | null
  readonly priorities: readonly string[]
  readonly completed: boolean
}

export interface AiUserContext {
  readonly today: DayKey
  readonly momentum: {
    readonly value: number
    /** O mesmo cálculo sem o limite de variação diária. */
    readonly rawValue: number
    readonly level: string
    readonly delta: number
    readonly hasEnoughData: boolean
    readonly factors: readonly {
      readonly label: string
      readonly score: number
      readonly weightPercent: number
      readonly measured: boolean
    }[]
    /** O que subiu e o que caiu contra a semana anterior, em pontos do score. */
    readonly drivers: readonly { readonly label: string; readonly delta: number }[]
    /** A ação em aberto que mais sobe o score hoje, ou null. */
    readonly nextAction: { readonly title: string; readonly gain: number; readonly reason: string } | null
  }
  readonly consistency: {
    readonly activeDaysLast7: number
    readonly activeDaysLast28: number
    readonly streak: number
    readonly streakRecord: number
  }
  readonly capacity: {
    readonly label: string
    readonly focusMin: number
    readonly actions: number
    readonly checkedIn: boolean
  }
  readonly objectives: readonly AiContextObjective[]
  readonly habits: readonly AiContextHabit[]
  readonly todayTasks: readonly AiContextTask[]
  readonly overdueTasks: readonly AiContextTask[]
  readonly reviews: readonly AiContextReview[]
  readonly recentWins: readonly string[]
}

export interface AiContextInput {
  readonly today: DayKey
  readonly momentum: MomentumScore
  readonly factors: readonly MomentumFactor[]
  readonly nextAction?: MomentumNextAction | null
  readonly streak: Streak
  readonly checkIns: readonly CheckIn[]
  readonly objectives: readonly {
    readonly progress: ObjectiveProgress
    readonly plan: PlanProgress
    readonly forecast: Forecast
  }[]
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
  readonly tasks: readonly Task[]
  readonly reviews: readonly WeeklyReview[]
  readonly wins: readonly Win[]
}

/** Reviews e vitórias são texto escrito pela pessoa: poucos e recentes bastam. */
const MAX_REVIEWS = 3
const MAX_WINS = 5
const CONSISTENCY_WINDOW_DAYS = 14

export function buildAiContext(input: AiContextInput): AiUserContext {
  const { today } = input
  const checkIn = checkInOfDay(input.checkIns, today)
  const capacity = capacityOf(checkIn)
  const objectiveTitles = new Map(
    input.objectives.map((item) => [item.progress.objective.id, item.progress.objective.title]),
  )
  const scheduledToday = new Set(habitsScheduledOn(input.habits, today).map((habit) => habit.id))
  const consistencyFrom = addDays(today, -(CONSISTENCY_WINDOW_DAYS - 1))

  const habits = input.habits.map<AiContextHabit>((habit) => {
    const consistency = habitConsistency(habit, input.habitLogs, consistencyFrom, today)
    const axis = activityType(habit.axis)
    return {
      name: habit.name,
      axis: axis.label,
      frequency: HABIT_FREQUENCY_LABELS[habit.frequency],
      target: habit.target,
      minimalTarget: habit.minimalTarget,
      unit: axis.unitLabel.many,
      objective: habit.objectiveId ? (objectiveTitles.get(habit.objectiveId) ?? null) : null,
      consistencyPercent: Math.round(consistency.rate * 100),
      doneLast7: consistency.recent,
      scheduledToday: scheduledToday.has(habit.id),
      doneToday: countsAsDone(statusOf(input.habitLogs, habit.id, today)),
    }
  })

  const toTask = (task: Task): AiContextTask => ({
    title: task.title,
    day: task.day,
    estimatedMin: task.estimatedMin,
    priority: task.priority,
    status: task.status,
    isMainPriority: task.isMainPriority,
    objective: task.objectiveId ? (objectiveTitles.get(task.objectiveId) ?? null) : null,
    minimalVersion: task.minimalVersion,
  })

  const todayTasks = input.tasks.filter((task) => task.day === today).map(toTask)
  const overdueTasks = input.tasks
    .filter((task) => isPending(task) && task.day < today)
    .sort((a, b) => a.day.localeCompare(b.day))
    .map(toTask)

  const objectives = input.objectives.map<AiContextObjective>(({ progress, plan, forecast }) => {
    const axis = activityType(progress.objective.axis)
    return {
      title: progress.objective.title,
      axis: axis.label,
      motive: progress.objective.motive,
      priority: progress.objective.priority,
      state: OBJECTIVE_STATE_LABELS[progress.state],
      deadline: progress.objective.deadline,
      daysLeft: progress.daysLeft,
      volume: { done: progress.done, target: progress.target, unit: axis.unitLabel.many },
      planPercent: plan.hasPlan ? Math.round(plan.ratio * 100) : null,
      stages: plan.stages.map((stage) => ({
        title: stage.stage.title,
        weightPercent: stage.stage.weight,
        status: stage.status,
        dueOn: stage.stage.dueOn,
        tasksDone: stage.doneTasks,
        tasksTotal: stage.totalTasks,
      })),
      currentStage: plan.currentStage?.stage.title ?? null,
      bottleneck: plan.bottleneck?.stage.title ?? null,
      nextAction: plan.nextTask?.title ?? null,
      overdueActions: plan.overdueCount,
      forecast: forecastLabel(forecast),
      habitCount: plan.habits.length,
    }
  })

  const reviews = [...input.reviews]
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .slice(0, MAX_REVIEWS)
    .map<AiContextReview>((review) => ({
      week: weekLabel(review.weekStart),
      achievements: review.achievements,
      difficulties: review.difficulties,
      learnings: review.learnings,
      adjustments: review.adjustments,
      priorities: review.priorities,
      completed: review.completedAt !== null,
    }))

  const recentWins = [...input.wins]
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, MAX_WINS)
    .map((win) => win.text)

  return {
    today,
    momentum: {
      value: input.momentum.value,
      rawValue: input.momentum.rawValue,
      level: MOMENTUM_LEVEL_LABELS[input.momentum.level],
      delta: input.momentum.delta,
      hasEnoughData: input.momentum.hasEnoughData,
      factors: input.factors.map((factor) => ({
        label: factor.label,
        score: factor.score,
        weightPercent: factor.weightPercent,
        measured: factor.measured,
      })),
      drivers: input.momentum.drivers.map((driver) => ({
        label: driver.label,
        delta: driver.delta,
      })),
      nextAction: input.nextAction
        ? {
            title: input.nextAction.title,
            gain: input.nextAction.gain,
            reason: input.nextAction.reason,
          }
        : null,
    },
    consistency: {
      activeDaysLast7: input.momentum.activeDays,
      activeDaysLast28: input.momentum.activeDaysInHorizon,
      streak: input.streak.current,
      streakRecord: input.streak.record,
    },
    capacity: {
      label: capacity.label,
      focusMin: capacity.suggestedFocusMin,
      actions: capacity.suggestedActions,
      checkedIn: checkIn !== null,
    },
    objectives,
    habits,
    todayTasks,
    overdueTasks,
    reviews,
    recentWins,
  }
}
