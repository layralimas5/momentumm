import type { PostgrestError } from '@supabase/supabase-js'
import type { AuthService, AuthUser } from '@/domain/auth/auth-service'
import { createActivity, type Activity, type NewActivityInput } from '@/domain/entities/activity'
import { createCheckIn, type CheckIn, type NewCheckInInput } from '@/domain/entities/checkin'
import type { DayKey } from '@/domain/entities/day'
import {
  createHabit,
  type Habit,
  type HabitLog,
  type HabitStatus,
  type NewHabitInput,
} from '@/domain/entities/habit'
import { createTask, type NewTaskInput, type Task } from '@/domain/entities/task'
import { createWin, type NewWinInput, type Win } from '@/domain/entities/win'
import { createGoal, type Goal, type NewGoalInput } from '@/domain/entities/goal'
import type { Profile } from '@/domain/entities/profile'
import { assertValidBio, assertValidHandle, assertValidName } from '@/domain/entities/profile'
import type { ActivityRepository } from '@/domain/repositories/activity-repository'
import type { GoalRepository } from '@/domain/repositories/goal-repository'
import type { CheckInRepository } from '@/domain/repositories/checkin-repository'
import type { HabitRepository } from '@/domain/repositories/habit-repository'
import type { ProfileRepository, ProfileUpdate } from '@/domain/repositories/profile-repository'
import type { TaskRepository, TaskUpdate } from '@/domain/repositories/task-repository'
import type { WinRepository } from '@/domain/repositories/win-repository'
import { DomainError, InfrastructureError } from '@/shared/errors'
import { supabase } from './client'
import {
  toActivity,
  toCheckIn,
  toGoal,
  toHabit,
  toHabitLog,
  toProfile,
  toTask,
  toWin,
} from './schemas'

const UNIQUE_VIOLATION = '23505'

function fail(error: PostgrestError, action: string): never {
  if (error.code === UNIQUE_VIOLATION) {
    throw new DomainError('Já existe um registro assim.')
  }
  throw new InfrastructureError(`Falha ao ${action}.`, error)
}

export class SupabaseAuthService implements AuthService {
  async currentUser(): Promise<AuthUser | null> {
    const { data, error } = await supabase().auth.getUser()
    if (error || !data.user?.email) return null
    return { id: data.user.id, email: data.user.email }
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await supabase().auth.signInWithPassword({ email, password })
    if (error || !data.user?.email) {
      throw new DomainError('E-mail ou senha não conferem.')
    }
    return { id: data.user.id, email: data.user.email }
  }

  async signUp(email: string, password: string, name: string): Promise<AuthUser> {
    assertValidName(name)

    const { data, error } = await supabase().auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() } },
    })

    if (error || !data.user?.email) {
      throw new DomainError(error?.message ?? 'Não consegui criar a conta agora.')
    }
    return { id: data.user.id, email: data.user.email }
  }

  async signOut(): Promise<void> {
    await supabase().auth.signOut()
  }

  onChange(listener: (user: AuthUser | null) => void): () => void {
    const { data } = supabase().auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      listener(user?.email ? { id: user.id, email: user.email } : null)
    })
    return () => data.subscription.unsubscribe()
  }
}

export class SupabaseActivityRepository implements ActivityRepository {
  async listByUser(userId: string): Promise<Activity[]> {
    const { data, error } = await supabase()
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(500)

    if (error) fail(error, 'carregar as atividades')
    return (data ?? []).map(toActivity)
  }

  async create(input: NewActivityInput): Promise<Activity> {
    // Valida e deriva no domínio antes de tocar no banco: o dia local sai daqui.
    const draft = createActivity(input, crypto.randomUUID())

    const { data, error } = await supabase()
      .from('activities')
      .insert({
        user_id: draft.userId,
        type_slug: draft.type,
        value: draft.value,
        unit: draft.unit,
        duration_min: draft.durationMin,
        note: draft.note,
        day: draft.day,
        occurred_at: draft.occurredAt.toISOString(),
        visibility: draft.visibility,
        source: draft.source,
      })
      .select('*')
      .single()

    if (error) fail(error, 'salvar a atividade')
    return toActivity(data)
  }

  async remove(id: string, userId: string): Promise<void> {
    const { error } = await supabase().from('activities').delete().eq('id', id).eq('user_id', userId)
    if (error) fail(error, 'apagar a atividade')
  }
}

export class SupabaseGoalRepository implements GoalRepository {
  async listByUser(userId: string): Promise<Goal[]> {
    const { data, error } = await supabase()
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('created_at', { ascending: true })

    if (error) fail(error, 'carregar as metas')
    return (data ?? []).map(toGoal)
  }

  async create(input: NewGoalInput): Promise<Goal> {
    const draft = createGoal(input, crypto.randomUUID())

    const { data, error } = await supabase()
      .from('goals')
      .insert({
        user_id: draft.userId,
        type_slug: draft.type,
        target: draft.target,
        period: draft.period,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new DomainError('Você já tem uma meta ativa pra esse eixo nesse período.')
      }
      fail(error, 'criar a meta')
    }
    return toGoal(data)
  }

  async archive(id: string, userId: string): Promise<void> {
    const { error } = await supabase()
      .from('goals')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) fail(error, 'arquivar a meta')
  }
}

export class SupabaseProfileRepository implements ProfileRepository {
  async findById(id: string): Promise<Profile | null> {
    const { data, error } = await supabase()
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) fail(error, 'carregar o perfil')
    return data ? toProfile(data) : null
  }

  async update(id: string, changes: ProfileUpdate): Promise<Profile> {
    if (changes.name !== undefined) assertValidName(changes.name)
    if (changes.handle !== undefined) assertValidHandle(changes.handle)
    if (changes.bio !== undefined) assertValidBio(changes.bio)

    const { data, error } = await supabase()
      .from('profiles')
      .update({
        ...(changes.name !== undefined ? { name: changes.name.trim() } : {}),
        ...(changes.handle !== undefined ? { handle: changes.handle } : {}),
        ...(changes.bio !== undefined ? { bio: changes.bio?.trim() || null } : {}),
        ...(changes.defaultVisibility !== undefined
          ? { default_visibility: changes.defaultVisibility }
          : {}),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new DomainError('Esse @ já está em uso.')
      }
      fail(error, 'salvar o perfil')
    }
    return toProfile(data)
  }
}

export class SupabaseCheckInRepository implements CheckInRepository {
  async listByUser(userId: string): Promise<CheckIn[]> {
    const { data, error } = await supabase()
      .from('check_ins')
      .select('*')
      .eq('user_id', userId)
      .order('day', { ascending: false })
      .limit(180)

    if (error) fail(error, 'carregar os check-ins')
    return (data ?? []).map(toCheckIn)
  }

  async save(input: NewCheckInInput): Promise<CheckIn> {
    const draft = createCheckIn(input, crypto.randomUUID())

    const { data, error } = await supabase()
      .from('check_ins')
      .upsert(
        {
          user_id: draft.userId,
          day: draft.day,
          mood: draft.mood,
          energy: draft.energy,
          focus: draft.focus,
          note: draft.note,
        },
        { onConflict: 'user_id,day' },
      )
      .select('*')
      .single()

    if (error) fail(error, 'salvar o check-in')
    return toCheckIn(data)
  }
}

export class SupabaseHabitRepository implements HabitRepository {
  async listByUser(userId: string): Promise<Habit[]> {
    const { data, error } = await supabase()
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('created_at', { ascending: true })

    if (error) fail(error, 'carregar os hábitos')
    return (data ?? []).map(toHabit)
  }

  async create(input: NewHabitInput): Promise<Habit> {
    const draft = createHabit(input, crypto.randomUUID())

    const { data, error } = await supabase()
      .from('habits')
      .insert({
        user_id: draft.userId,
        name: draft.name,
        icon: draft.icon,
        axis_slug: draft.axis,
        day_part: draft.dayPart,
        weekdays: draft.weekdays,
        target: draft.target,
        minimal_target: draft.minimalTarget,
      })
      .select('*')
      .single()

    if (error) fail(error, 'criar o hábito')
    return toHabit(data)
  }

  async archive(id: string, userId: string): Promise<void> {
    const { error } = await supabase()
      .from('habits')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) fail(error, 'arquivar o hábito')
  }

  async listLogs(userId: string): Promise<HabitLog[]> {
    const { data, error } = await supabase()
      .from('habit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('day', { ascending: false })
      .limit(1000)

    if (error) fail(error, 'carregar os registros de hábito')
    return (data ?? []).map(toHabitLog)
  }

  async setStatus(
    userId: string,
    habitId: string,
    day: DayKey,
    status: HabitStatus,
  ): Promise<HabitLog> {
    // Voltar pra pendente é desfazer: apaga a linha em vez de guardar um estado
    // que não significa nada no histórico.
    if (status === 'pendente') {
      const { error } = await supabase()
        .from('habit_logs')
        .delete()
        .eq('user_id', userId)
        .eq('habit_id', habitId)
        .eq('day', day)

      if (error) fail(error, 'desfazer o registro do hábito')
      return { id: crypto.randomUUID(), userId, habitId, day, status, createdAt: new Date() }
    }

    const { data, error } = await supabase()
      .from('habit_logs')
      .upsert({ user_id: userId, habit_id: habitId, day, status }, { onConflict: 'habit_id,day' })
      .select('*')
      .single()

    if (error) fail(error, 'registrar o hábito')
    return toHabitLog(data)
  }
}

export class SupabaseTaskRepository implements TaskRepository {
  async listByUser(userId: string): Promise<Task[]> {
    const { data, error } = await supabase()
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('day', { ascending: true })
      .limit(500)

    if (error) fail(error, 'carregar as ações')
    return (data ?? []).map(toTask)
  }

  async create(input: NewTaskInput): Promise<Task> {
    const draft = createTask(input, crypto.randomUUID())

    // Só uma principal por dia: libera a anterior antes de gravar a nova.
    if (draft.isMainPriority) {
      await this.releaseMainPriority(draft.userId, draft.day)
    }

    const { data, error } = await supabase()
      .from('tasks')
      .insert({
        user_id: draft.userId,
        title: draft.title,
        goal_id: draft.goalId,
        axis_slug: draft.axis,
        estimated_min: draft.estimatedMin,
        effort: draft.effort,
        minimal_version: draft.minimalVersion,
        day: draft.day,
        is_main_priority: draft.isMainPriority,
      })
      .select('*')
      .single()

    if (error) fail(error, 'criar a ação')
    return toTask(data)
  }

  async update(id: string, userId: string, changes: TaskUpdate): Promise<Task> {
    if (changes.isMainPriority && changes.day) {
      await this.releaseMainPriority(userId, changes.day, id)
    }

    const { data, error } = await supabase()
      .from('tasks')
      .update({
        ...(changes.title !== undefined ? { title: changes.title } : {}),
        ...(changes.goalId !== undefined ? { goal_id: changes.goalId } : {}),
        ...(changes.axis !== undefined ? { axis_slug: changes.axis } : {}),
        ...(changes.estimatedMin !== undefined ? { estimated_min: changes.estimatedMin } : {}),
        ...(changes.effort !== undefined ? { effort: changes.effort } : {}),
        ...(changes.minimalVersion !== undefined
          ? { minimal_version: changes.minimalVersion }
          : {}),
        ...(changes.day !== undefined ? { day: changes.day } : {}),
        ...(changes.isMainPriority !== undefined
          ? { is_main_priority: changes.isMainPriority }
          : {}),
        ...(changes.status !== undefined ? { status: changes.status } : {}),
        ...(changes.completedAt !== undefined
          ? { completed_at: changes.completedAt?.toISOString() ?? null }
          : {}),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) fail(error, 'atualizar a ação')
    return toTask(data)
  }

  async remove(id: string, userId: string): Promise<void> {
    const { error } = await supabase().from('tasks').delete().eq('id', id).eq('user_id', userId)
    if (error) fail(error, 'apagar a ação')
  }

  /** Uma prioridade principal por dia é regra de banco; aqui ela é respeitada. */
  private async releaseMainPriority(userId: string, day: DayKey, exceptId?: string): Promise<void> {
    const query = supabase()
      .from('tasks')
      .update({ is_main_priority: false })
      .eq('user_id', userId)
      .eq('day', day)
      .eq('is_main_priority', true)

    const { error } = exceptId ? await query.neq('id', exceptId) : await query
    if (error) fail(error, 'trocar a prioridade principal')
  }
}

export class SupabaseWinRepository implements WinRepository {
  async listByUser(userId: string): Promise<Win[]> {
    const { data, error } = await supabase()
      .from('wins')
      .select('*')
      .eq('user_id', userId)
      .order('day', { ascending: false })
      .limit(120)

    if (error) fail(error, 'carregar as vitórias')
    return (data ?? []).map(toWin)
  }

  async save(input: NewWinInput): Promise<Win> {
    const draft = createWin(input, crypto.randomUUID())

    const { data, error } = await supabase()
      .from('wins')
      .upsert(
        { user_id: draft.userId, day: draft.day, text: draft.text },
        { onConflict: 'user_id,day' },
      )
      .select('*')
      .single()

    if (error) fail(error, 'salvar a vitória')
    return toWin(data)
  }
}
