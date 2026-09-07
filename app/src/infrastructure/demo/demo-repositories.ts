import type { AuthService, AuthUser, SignUpResult } from '@/domain/auth/auth-service'
import type { Activity, NewActivityInput } from '@/domain/entities/activity'
import type { ActivityType } from '@/domain/entities/activity-type'
import type { CheckIn, NewCheckInInput } from '@/domain/entities/checkin'
import type { DayKey } from '@/domain/entities/day'
import type { Habit, HabitLog, HabitStatus, NewHabitInput } from '@/domain/entities/habit'
import type { JourneyEvent, NewJourneyEventInput } from '@/domain/entities/journey-event'
import type { NewTaskInput, Task } from '@/domain/entities/task'
import type { WeeklyReview, WeeklyReviewDraft } from '@/domain/entities/weekly-review'
import type { NewWinInput, Win } from '@/domain/entities/win'
import type { Goal, NewGoalInput } from '@/domain/entities/goal'
import type { NewObjectiveInput, Objective } from '@/domain/entities/objective'
import type { Profile } from '@/domain/entities/profile'
import { assertValidBio, assertValidHandle, assertValidName } from '@/domain/entities/profile'
import type { ActivityRepository } from '@/domain/repositories/activity-repository'
import type {
  ActivityTypeRepository,
  NewCustomAxisInput,
} from '@/domain/repositories/activity-type-repository'
import type { GoalRepository } from '@/domain/repositories/goal-repository'
import type {
  ObjectiveRepository,
  ObjectiveUpdate,
} from '@/domain/repositories/objective-repository'
import type { CheckInRepository } from '@/domain/repositories/checkin-repository'
import type { HabitRepository, HabitUpdate } from '@/domain/repositories/habit-repository'
import type { ProfileRepository, ProfileUpdate } from '@/domain/repositories/profile-repository'
import type {
  TaskReorder,
  TaskRepository,
  TaskUpdate,
} from '@/domain/repositories/task-repository'
import type { JourneyEventRepository } from '@/domain/repositories/journey-event-repository'
import type { WeeklyReviewRepository } from '@/domain/repositories/weekly-review-repository'
import type { WinRepository } from '@/domain/repositories/win-repository'
import { isAuthBypass } from '@/infrastructure/config/env'
import type { NewPlanStageInput, PlanStage } from '@/domain/entities/plan-stage'
import type {
  PlanStageRepository,
  PlanStageReweight,
  PlanStageUpdate,
} from '@/domain/repositories/plan-stage-repository'
import { DEMO_USER, demoStore } from './demo-store'

const SESSION_KEY = 'momentumm.demo.session'

export class DemoAuthService implements AuthService {
  private listeners = new Set<(user: AuthUser | null) => void>()

  async currentUser(): Promise<AuthUser | null> {
    // Com o bypass ligado a sessão existe por definição: é o que dispensa o login.
    if (isAuthBypass) return this.readSession() ?? this.startSession(DEMO_USER.email)
    return this.readSession()
  }

  async signIn(email: string): Promise<AuthUser> {
    return this.startSession(email)
  }

  async signUp(email: string, _password: string, name: string): Promise<SignUpResult> {
    const user = this.startSession(email)
    assertValidName(name)
    demoStore.updateProfile({ name: name.trim() })
    // No modo demo não existe e-mail pra confirmar: a sessão abre na hora.
    return { user, needsConfirmation: false }
  }

  async signOut(): Promise<void> {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      // sessão só em memória
    }
    this.emit(null)
  }

  onChange(listener: (user: AuthUser | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private startSession(email: string): AuthUser {
    const user: AuthUser = { id: DEMO_USER.id, email: email.trim() || DEMO_USER.email }
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    } catch {
      // sessão só em memória
    }
    this.emit(user)
    return user
  }

  private readSession(): AuthUser | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? (JSON.parse(raw) as AuthUser) : null
    } catch {
      return null
    }
  }

  private emit(user: AuthUser | null): void {
    for (const listener of this.listeners) listener(user)
  }
}

export class DemoActivityRepository implements ActivityRepository {
  async listByUser(): Promise<Activity[]> {
    return demoStore.activities()
  }

  async create(input: NewActivityInput): Promise<Activity> {
    return demoStore.addActivity(input)
  }

  async remove(id: string): Promise<void> {
    demoStore.removeActivity(id)
  }
}

export class DemoGoalRepository implements GoalRepository {
  async listByUser(): Promise<Goal[]> {
    return demoStore.goals()
  }

  async create(input: NewGoalInput): Promise<Goal> {
    return demoStore.addGoal(input)
  }

  async archive(id: string): Promise<void> {
    demoStore.archiveGoal(id)
  }
}

export class DemoActivityTypeRepository implements ActivityTypeRepository {
  async listCustom(): Promise<ActivityType[]> {
    return demoStore.customAxes()
  }

  async createCustom(input: NewCustomAxisInput): Promise<ActivityType> {
    return demoStore.addCustomAxis(input.label)
  }
}

export class DemoObjectiveRepository implements ObjectiveRepository {
  async listByUser(): Promise<Objective[]> {
    return demoStore.objectives()
  }

  async create(input: NewObjectiveInput): Promise<Objective> {
    return demoStore.addObjective(input)
  }

  async update(id: string, _userId: string, changes: ObjectiveUpdate): Promise<void> {
    demoStore.updateObjective(id, changes)
  }

  async archive(id: string): Promise<void> {
    demoStore.archiveObjective(id)
  }
}

export class DemoPlanStageRepository implements PlanStageRepository {
  async listByUser(): Promise<PlanStage[]> {
    return demoStore.planStages()
  }

  async create(input: NewPlanStageInput): Promise<PlanStage> {
    return demoStore.addPlanStage(input)
  }

  async update(id: string, _userId: string, changes: PlanStageUpdate): Promise<PlanStage> {
    return demoStore.updatePlanStage(id, changes)
  }

  async reweight(_userId: string, items: readonly PlanStageReweight[]): Promise<void> {
    demoStore.reweightPlanStages(items)
  }

  async remove(id: string): Promise<void> {
    demoStore.removePlanStage(id)
  }
}

export class DemoProfileRepository implements ProfileRepository {
  async findById(): Promise<Profile | null> {
    return demoStore.profile()
  }

  async update(_id: string, changes: ProfileUpdate): Promise<Profile> {
    if (changes.name !== undefined) assertValidName(changes.name)
    if (changes.handle !== undefined) assertValidHandle(changes.handle)
    if (changes.bio !== undefined) assertValidBio(changes.bio)

    return demoStore.updateProfile({
      ...(changes.name !== undefined ? { name: changes.name.trim() } : {}),
      ...(changes.handle !== undefined ? { handle: changes.handle } : {}),
      ...(changes.bio !== undefined ? { bio: changes.bio?.trim() || null } : {}),
      ...(changes.avatarUrl !== undefined ? { avatarUrl: changes.avatarUrl } : {}),
      ...(changes.defaultVisibility !== undefined
        ? { defaultVisibility: changes.defaultVisibility }
        : {}),
      ...(changes.plan !== undefined ? { plan: changes.plan } : {}),
    })
  }
}

export class DemoHabitRepository implements HabitRepository {
  async listByUser(): Promise<Habit[]> {
    return demoStore.habits()
  }

  async create(input: NewHabitInput): Promise<Habit> {
    return demoStore.addHabit(input)
  }

  async update(id: string, _userId: string, changes: HabitUpdate): Promise<Habit> {
    return demoStore.updateHabit(id, changes)
  }

  async archive(id: string): Promise<void> {
    demoStore.archiveHabit(id)
  }

  async listLogs(): Promise<HabitLog[]> {
    return demoStore.habitLogs()
  }

  async setStatus(
    _userId: string,
    habitId: string,
    day: DayKey,
    status: HabitStatus,
  ): Promise<HabitLog> {
    return demoStore.setHabitStatus(habitId, day, status)
  }
}

export class DemoTaskRepository implements TaskRepository {
  async listByUser(): Promise<Task[]> {
    return demoStore.tasks()
  }

  async create(input: NewTaskInput): Promise<Task> {
    return demoStore.addTask(input)
  }

  async update(id: string, _userId: string, changes: TaskUpdate): Promise<Task> {
    return demoStore.updateTask(id, changes)
  }

  async reorder(_userId: string, items: readonly TaskReorder[]): Promise<void> {
    demoStore.reorderTasks(items)
  }

  async remove(id: string): Promise<void> {
    demoStore.removeTask(id)
  }
}

export class DemoWeeklyReviewRepository implements WeeklyReviewRepository {
  async listByUser(): Promise<WeeklyReview[]> {
    return demoStore.weeklyReviews()
  }

  async save(
    _userId: string,
    weekStart: DayKey,
    draft: WeeklyReviewDraft,
  ): Promise<WeeklyReview> {
    return demoStore.saveWeeklyReview(weekStart, draft)
  }
}

export class DemoCheckInRepository implements CheckInRepository {
  async listByUser(): Promise<CheckIn[]> {
    return demoStore.checkIns()
  }

  async save(input: NewCheckInInput): Promise<CheckIn> {
    return demoStore.saveCheckIn(input)
  }
}

export class DemoWinRepository implements WinRepository {
  async listByUser(): Promise<Win[]> {
    return demoStore.wins()
  }

  async save(input: NewWinInput): Promise<Win> {
    return demoStore.saveWin(input)
  }
}

export class DemoJourneyEventRepository implements JourneyEventRepository {
  async listByUser(): Promise<JourneyEvent[]> {
    return demoStore.journeyEvents()
  }

  async record(input: NewJourneyEventInput): Promise<JourneyEvent> {
    return demoStore.recordJourneyEvent(input)
  }
}
