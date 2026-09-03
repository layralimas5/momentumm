import { createContext } from 'react'
import type { Activity, NewActivityInput } from '@/domain/entities/activity'
import type { CheckIn, NewCheckInInput } from '@/domain/entities/checkin'
import type { DayKey } from '@/domain/entities/day'
import type { Goal, GoalProgress, NewGoalInput } from '@/domain/entities/goal'
import type { Habit, HabitLog, HabitStatus, NewHabitInput } from '@/domain/entities/habit'
import type { PlanLimits } from '@/domain/entities/plan'
import type { Streak } from '@/domain/entities/streak'
import type { NewTaskInput, Task } from '@/domain/entities/task'
import type { NewWinInput, Win } from '@/domain/entities/win'
import type { TaskUpdate } from '@/domain/repositories/task-repository'

/**
 * Estado único do planejamento. Tudo que o dashboard mostra sai daqui, e é por
 * isso que as seções conversam entre si: check-in, hábito, ação e registro são
 * o mesmo estado visto de ângulos diferentes, não seis telas independentes.
 */
export interface PlannerState {
  readonly today: DayKey
  readonly activities: readonly Activity[]
  readonly todayActivities: readonly Activity[]
  readonly goals: readonly Goal[]
  readonly goalProgress: readonly GoalProgress[]
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
  readonly tasks: readonly Task[]
  readonly checkIns: readonly CheckIn[]
  readonly wins: readonly Win[]
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

  createGoal(input: Omit<NewGoalInput, 'userId'>): Promise<void>
  archiveGoal(id: string): Promise<void>

  createHabit(input: Omit<NewHabitInput, 'userId'>): Promise<void>
  archiveHabit(id: string): Promise<void>
  setHabitStatus(habitId: string, status: HabitStatus, day?: DayKey): Promise<void>

  createTask(input: Omit<NewTaskInput, 'userId'>): Promise<void>
  updateTask(id: string, changes: TaskUpdate): Promise<void>
  removeTask(id: string): Promise<void>

  saveCheckIn(input: Omit<NewCheckInInput, 'userId'>): Promise<void>
  saveWin(input: Omit<NewWinInput, 'userId'>): Promise<void>

  reload(): Promise<void>
}

export const PlannerContext = createContext<PlannerState | null>(null)
