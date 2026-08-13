import type { AuthService, AuthUser } from '@/domain/auth/auth-service'
import type { Activity, NewActivityInput } from '@/domain/entities/activity'
import type { Goal, NewGoalInput } from '@/domain/entities/goal'
import type { Profile } from '@/domain/entities/profile'
import { assertValidBio, assertValidHandle, assertValidName } from '@/domain/entities/profile'
import type { ActivityRepository } from '@/domain/repositories/activity-repository'
import type { GoalRepository } from '@/domain/repositories/goal-repository'
import type { ProfileRepository, ProfileUpdate } from '@/domain/repositories/profile-repository'
import { DEMO_USER, demoStore } from './demo-store'

const SESSION_KEY = 'momentumm.demo.session'

export class DemoAuthService implements AuthService {
  private listeners = new Set<(user: AuthUser | null) => void>()

  async currentUser(): Promise<AuthUser | null> {
    return this.readSession()
  }

  async signIn(email: string): Promise<AuthUser> {
    return this.startSession(email)
  }

  async signUp(email: string, _password: string, name: string): Promise<AuthUser> {
    const user = this.startSession(email)
    assertValidName(name)
    demoStore.updateProfile({ name: name.trim() })
    return user
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
      ...(changes.defaultVisibility !== undefined
        ? { defaultVisibility: changes.defaultVisibility }
        : {}),
    })
  }
}
