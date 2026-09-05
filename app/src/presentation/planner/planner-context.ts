import { createContext } from 'react'
import type { Activity, NewActivityInput } from '@/domain/entities/activity'
import type { ActivityType } from '@/domain/entities/activity-type'
import type { CheckIn, NewCheckInInput } from '@/domain/entities/checkin'
import type { DayKey } from '@/domain/entities/day'
import type { Goal, GoalProgress, NewGoalInput } from '@/domain/entities/goal'
import type { Habit, HabitLog, HabitStatus, NewHabitInput } from '@/domain/entities/habit'
import type { WeeklyReview, WeeklyReviewDraft } from '@/domain/entities/weekly-review'
import type {
  NewObjectiveInput,
  Objective,
  ObjectiveProgress,
} from '@/domain/entities/objective'
import type { PlanLimits } from '@/domain/entities/plan'
import type { PlanDraft } from '@/domain/entities/plan-builder'
import type { Streak } from '@/domain/entities/streak'
import type { NewTaskInput, Task } from '@/domain/entities/task'
import type { NewWinInput, Win } from '@/domain/entities/win'
import type { HabitUpdate } from '@/domain/repositories/habit-repository'
import type { ObjectiveUpdate } from '@/domain/repositories/objective-repository'
import type { TaskReorder, TaskUpdate } from '@/domain/repositories/task-repository'

/**
 * Estado único do planejamento. Tudo que o dashboard mostra sai daqui, e é por
 * isso que as seções conversam entre si: check-in, hábito, ação e registro são
 * o mesmo estado visto de ângulos diferentes, não seis telas independentes.
 */
export interface PlannerState {
  readonly today: DayKey
  readonly activities: readonly Activity[]
  readonly todayActivities: readonly Activity[]
  /**
   * Todas as áreas da conta: as quatro de fábrica mais as que ela criou. É
   * daqui que filtro, seletor e formulário leem — nunca da constante.
   */
  readonly axes: readonly ActivityType[]
  readonly objectives: readonly Objective[]
  readonly objectiveProgress: readonly ObjectiveProgress[]
  readonly goals: readonly Goal[]
  readonly goalProgress: readonly GoalProgress[]
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
  readonly tasks: readonly Task[]
  readonly checkIns: readonly CheckIn[]
  readonly wins: readonly Win[]
  readonly weeklyReviews: readonly WeeklyReview[]
  readonly streak: Streak
  readonly limits: PlanLimits
  readonly loading: boolean
  readonly error: string | null
  /** Falso quando o navegador perdeu a rede: a tela avisa em vez de falhar mudo. */
  readonly online: boolean
  /** Conta nova, sem nada criado ainda: dispara o onboarding em vez de cards vazios. */
  readonly isNewUser: boolean

  logActivity(input: Omit<NewActivityInput, 'userId'>): Promise<void>
  removeActivity(id: string): Promise<void>

  /** Cria uma área nova a partir do nome escrito pela pessoa. */
  createAxis(label: string): Promise<ActivityType | null>

  createObjective(input: Omit<NewObjectiveInput, 'userId'>): Promise<Objective | null>
  updateObjective(id: string, changes: ObjectiveUpdate): Promise<void>
  archiveObjective(id: string): Promise<void>
  /** Pausa e retomada são o mesmo caminho: `true` para, `false` volta. */
  setObjectivePaused(id: string, paused: boolean): Promise<void>
  /**
   * Concluir o objetivo. Fecha também as ações em aberto dele: deixar ação
   * pendente de objetivo concluído entulha o plano com trabalho que ninguém
   * vai fazer.
   */
  completeObjective(id: string, done: boolean): Promise<void>
  /**
   * O plano inteiro de uma vez: objetivo, ritmo semanal, hábitos e as
   * primeiras ações, pra cada objetivo da lista. É uma operação só porque
   * plano pela metade é pior que plano nenhum — a pessoa sairia do onboarding
   * com meta sem ação.
   */
  applyPlan(plans: readonly PlanDraft[]): Promise<void>

  createGoal(input: Omit<NewGoalInput, 'userId'>): Promise<Goal | null>
  archiveGoal(id: string): Promise<void>

  createHabit(input: Omit<NewHabitInput, 'userId'>): Promise<Habit | null>
  updateHabit(id: string, changes: HabitUpdate): Promise<void>
  setHabitPaused(id: string, paused: boolean): Promise<void>
  archiveHabit(id: string): Promise<void>
  setHabitStatus(habitId: string, status: HabitStatus, day?: DayKey): Promise<void>

  createTask(input: Omit<NewTaskInput, 'userId'>): Promise<Task | null>
  updateTask(id: string, changes: TaskUpdate): Promise<void>
  reorderTasks(items: readonly TaskReorder[]): Promise<void>
  removeTask(id: string): Promise<void>

  saveCheckIn(input: Omit<NewCheckInInput, 'userId'>): Promise<void>
  saveWin(input: Omit<NewWinInput, 'userId'>): Promise<void>

  saveWeeklyReview(weekStart: DayKey, draft: WeeklyReviewDraft): Promise<void>

  reload(): Promise<void>
}

export const PlannerContext = createContext<PlannerState | null>(null)
