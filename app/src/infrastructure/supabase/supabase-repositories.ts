import type { PostgrestError } from '@supabase/supabase-js'
import type { AuthService, AuthUser, SignUpResult } from '@/domain/auth/auth-service'
import { createActivity, type Activity, type NewActivityInput } from '@/domain/entities/activity'
import { createActivityType, type ActivityType } from '@/domain/entities/activity-type'
import { createCheckIn, type CheckIn, type NewCheckInInput } from '@/domain/entities/checkin'
import type { DayKey } from '@/domain/entities/day'
import {
  createHabit,
  type Habit,
  type HabitLog,
  type HabitStatus,
  type NewHabitInput,
} from '@/domain/entities/habit'
import {
  createPlanStage,
  type NewPlanStageInput,
  type PlanStage,
} from '@/domain/entities/plan-stage'
import { createTask, type NewTaskInput, type Task } from '@/domain/entities/task'
import { createWin, type NewWinInput, type Win } from '@/domain/entities/win'
import type { WeeklyReview, WeeklyReviewDraft } from '@/domain/entities/weekly-review'
import { createGoal, type Goal, type NewGoalInput } from '@/domain/entities/goal'
import {
  createObjective,
  type NewObjectiveInput,
  type Objective,
} from '@/domain/entities/objective'
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
  PlanStageRepository,
  PlanStageReweight,
  PlanStageUpdate,
} from '@/domain/repositories/plan-stage-repository'
import type {
  TaskReorder,
  TaskRepository,
  TaskUpdate,
} from '@/domain/repositories/task-repository'
import type { WeeklyReviewRepository } from '@/domain/repositories/weekly-review-repository'
import type { WinRepository } from '@/domain/repositories/win-repository'
import { DomainError, InfrastructureError } from '@/shared/errors'
import { supabase } from './client'
import {
  toActivity,
  toCheckIn,
  toCustomAxis,
  toGoal,
  toHabit,
  toObjective,
  toHabitLog,
  toProfile,
  toPlanStage,
  toTask,
  toWeeklyReview,
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

  async signUp(email: string, password: string, name: string): Promise<SignUpResult> {
    assertValidName(name)

    const { data, error } = await supabase().auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() } },
    })

    if (error || !data.user?.email) {
      throw new DomainError(error?.message ?? 'Não consegui criar a conta agora.')
    }

    // Sem sessão significa confirmação de e-mail pendente. É um caso normal,
    // não um erro: o app precisa dizer isso em vez de tentar entrar.
    return {
      user: { id: data.user.id, email: data.user.email },
      needsConfirmation: data.session === null,
    }
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

/**
 * O slug de uma área criada é prefixado com o dono.
 *
 * `activity_types.slug` é chave primária global — é ela que as FKs de
 * atividade, hábito, meta e objetivo apontam. Sem prefixo, duas pessoas
 * criando "Escrita" colidiriam na mesma linha e passariam a dividir o eixo.
 */
function axisSlugFor(userId: string, slug: string): string {
  return `${userId.slice(0, 8)}-${slug}`
}

export class SupabaseActivityTypeRepository implements ActivityTypeRepository {
  async listCustom(userId: string): Promise<ActivityType[]> {
    const { data, error } = await supabase()
      .from('activity_types')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })

    if (error) fail(error, 'carregar as áreas')
    return (data ?? []).map(toCustomAxis)
  }

  async createCustom(input: NewCustomAxisInput): Promise<ActivityType> {
    const draft = createActivityType({ label: input.label, order: input.order })
    const slug = axisSlugFor(input.userId, draft.slug)

    const { data, error } = await supabase()
      .from('activity_types')
      .insert({
        slug,
        user_id: input.userId,
        label: draft.label,
        verb: draft.verb,
        unit: draft.unit,
        color: draft.colorToken,
        sort_order: 100 + input.order,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new DomainError('Você já tem uma área com esse nome.')
      }
      fail(error, 'criar a área')
    }
    return toCustomAxis(data)
  }
}

export class SupabaseObjectiveRepository implements ObjectiveRepository {
  async listByUser(userId: string): Promise<Objective[]> {
    const { data, error } = await supabase()
      .from('objectives')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('deadline', { ascending: true })

    if (error) fail(error, 'carregar os objetivos')
    return (data ?? []).map(toObjective)
  }

  async create(input: NewObjectiveInput): Promise<Objective> {
    const draft = createObjective(input, crypto.randomUUID())

    const { data, error } = await supabase()
      .from('objectives')
      .insert({
        user_id: draft.userId,
        title: draft.title,
        axis_slug: draft.axis,
        description: draft.description,
        motive: draft.motive,
        priority: draft.priority,
        target: draft.target,
        started_on: draft.startedOn,
        deadline: draft.deadline,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new DomainError(
          'Você já tem um objetivo ativo nessa área. Fecha ou arquiva ele antes de abrir outro.',
        )
      }
      fail(error, 'criar o objetivo')
    }
    return toObjective(data)
  }

  async update(id: string, userId: string, changes: ObjectiveUpdate): Promise<void> {
    const { error } = await supabase()
      .from('objectives')
      .update({
        ...(changes.title !== undefined ? { title: changes.title } : {}),
        ...(changes.description !== undefined ? { description: changes.description } : {}),
        ...(changes.target !== undefined ? { target: changes.target } : {}),
        ...(changes.deadline !== undefined ? { deadline: changes.deadline } : {}),
        ...(changes.motive !== undefined ? { motive: changes.motive } : {}),
        ...(changes.priority !== undefined ? { priority: changes.priority } : {}),
        ...(changes.completedAt !== undefined
          ? { completed_at: changes.completedAt?.toISOString() ?? null }
          : {}),
        ...(changes.pausedAt !== undefined
          ? { paused_at: changes.pausedAt?.toISOString() ?? null }
          : {}),
      })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) fail(error, 'atualizar o objetivo')
  }

  async archive(id: string, userId: string): Promise<void> {
    const { error } = await supabase()
      .from('objectives')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) fail(error, 'arquivar o objetivo')
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
        description: draft.description,
        icon: draft.icon,
        axis_slug: draft.axis,
        objective_id: draft.objectiveId,
        stage_id: draft.stageId,
        priority: draft.priority,
        frequency: draft.frequency,
        day_part: draft.dayPart,
        time_of_day: draft.timeOfDay,
        weekdays: draft.weekdays,
        times_per_week: draft.timesPerWeek,
        target: draft.target,
        minimal_target: draft.minimalTarget,
      })
      .select('*')
      .single()

    if (error) fail(error, 'criar o hábito')
    return toHabit(data)
  }

  async update(id: string, userId: string, changes: HabitUpdate): Promise<Habit> {
    const { data, error } = await supabase()
      .from('habits')
      .update({
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.description !== undefined ? { description: changes.description } : {}),
        ...(changes.icon !== undefined ? { icon: changes.icon } : {}),
        ...(changes.axis !== undefined ? { axis_slug: changes.axis } : {}),
        ...(changes.objectiveId !== undefined ? { objective_id: changes.objectiveId } : {}),
        ...(changes.stageId !== undefined ? { stage_id: changes.stageId } : {}),
        ...(changes.priority !== undefined ? { priority: changes.priority } : {}),
        ...(changes.frequency !== undefined ? { frequency: changes.frequency } : {}),
        ...(changes.dayPart !== undefined ? { day_part: changes.dayPart } : {}),
        ...(changes.timeOfDay !== undefined ? { time_of_day: changes.timeOfDay } : {}),
        ...(changes.weekdays !== undefined ? { weekdays: changes.weekdays } : {}),
        ...(changes.timesPerWeek !== undefined ? { times_per_week: changes.timesPerWeek } : {}),
        ...(changes.target !== undefined ? { target: changes.target } : {}),
        ...(changes.minimalTarget !== undefined ? { minimal_target: changes.minimalTarget } : {}),
        ...(changes.pausedAt !== undefined
          ? { paused_at: changes.pausedAt?.toISOString() ?? null }
          : {}),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) fail(error, 'atualizar o hábito')
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
        description: draft.description,
        goal_id: draft.goalId,
        objective_id: draft.objectiveId,
        stage_id: draft.stageId,
        weight: draft.weight,
        is_required: draft.isRequired,
        axis_slug: draft.axis,
        estimated_min: draft.estimatedMin,
        effort: draft.effort,
        priority: draft.priority,
        minimal_version: draft.minimalVersion,
        day: draft.day,
        time_of_day: draft.timeOfDay,
        sort_order: draft.order,
        depends_on_id: draft.dependsOnId,
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
        ...(changes.description !== undefined ? { description: changes.description } : {}),
        ...(changes.goalId !== undefined ? { goal_id: changes.goalId } : {}),
        ...(changes.objectiveId !== undefined ? { objective_id: changes.objectiveId } : {}),
        ...(changes.stageId !== undefined ? { stage_id: changes.stageId } : {}),
        ...(changes.weight !== undefined ? { weight: changes.weight } : {}),
        ...(changes.isRequired !== undefined ? { is_required: changes.isRequired } : {}),
        ...(changes.axis !== undefined ? { axis_slug: changes.axis } : {}),
        ...(changes.estimatedMin !== undefined ? { estimated_min: changes.estimatedMin } : {}),
        ...(changes.effort !== undefined ? { effort: changes.effort } : {}),
        ...(changes.priority !== undefined ? { priority: changes.priority } : {}),
        ...(changes.timeOfDay !== undefined ? { time_of_day: changes.timeOfDay } : {}),
        ...(changes.order !== undefined ? { sort_order: changes.order } : {}),
        ...(changes.dependsOnId !== undefined ? { depends_on_id: changes.dependsOnId } : {}),
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

  async reorder(userId: string, items: readonly TaskReorder[]): Promise<void> {
    if (items.length === 0) return

    // Uma chamada por ação, mas em paralelo: o Postgrest não faz update em
    // massa com valor diferente por linha, e um RPC só pra isso obrigaria a
    // instalar função no banco antes do app rodar.
    const results = await Promise.all(
      items.map((item) =>
        supabase()
          .from('tasks')
          .update({ sort_order: item.order })
          .eq('id', item.id)
          .eq('user_id', userId),
      ),
    )

    const failed = results.find((result) => result.error)
    if (failed?.error) fail(failed.error, 'reordenar as ações')
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

export class SupabasePlanStageRepository implements PlanStageRepository {
  async listByUser(userId: string): Promise<PlanStage[]> {
    const { data, error } = await supabase()
      .from('plan_stages')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })

    if (error) fail(error, 'carregar as etapas do plano')
    return (data ?? []).map(toPlanStage)
  }

  async create(input: NewPlanStageInput): Promise<PlanStage> {
    const draft = createPlanStage(input, crypto.randomUUID())

    const { data, error } = await supabase()
      .from('plan_stages')
      .insert({
        user_id: draft.userId,
        objective_id: draft.objectiveId,
        title: draft.title,
        description: draft.description,
        sort_order: draft.order,
        weight: draft.weight,
        status: draft.status,
        due_on: draft.dueOn,
      })
      .select('*')
      .single()

    if (error) fail(error, 'criar a etapa')
    return toPlanStage(data)
  }

  async update(id: string, userId: string, changes: PlanStageUpdate): Promise<PlanStage> {
    const { data, error } = await supabase()
      .from('plan_stages')
      .update({
        ...(changes.title !== undefined ? { title: changes.title } : {}),
        ...(changes.description !== undefined ? { description: changes.description } : {}),
        ...(changes.order !== undefined ? { sort_order: changes.order } : {}),
        ...(changes.weight !== undefined ? { weight: changes.weight } : {}),
        ...(changes.status !== undefined ? { status: changes.status } : {}),
        ...(changes.dueOn !== undefined ? { due_on: changes.dueOn } : {}),
        ...(changes.completedAt !== undefined
          ? { completed_at: changes.completedAt?.toISOString() ?? null }
          : {}),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) fail(error, 'atualizar a etapa')
    return toPlanStage(data)
  }

  async reweight(userId: string, items: readonly PlanStageReweight[]): Promise<void> {
    if (items.length === 0) return

    // Em paralelo, como a reordenação de ações: o Postgrest não faz update em
    // massa com valor diferente por linha. A soma 100 é garantida antes daqui,
    // no domínio, e o conjunto chega inteiro ou não chega.
    const results = await Promise.all(
      items.map((item) =>
        supabase()
          .from('plan_stages')
          .update({ sort_order: item.order, weight: item.weight })
          .eq('id', item.id)
          .eq('user_id', userId),
      ),
    )

    const failed = results.find((result) => result.error)
    if (failed?.error) fail(failed.error, 'salvar os pesos das etapas')
  }

  async remove(id: string, userId: string): Promise<void> {
    const { error } = await supabase()
      .from('plan_stages')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    // As ações da etapa não somem junto: a FK é `on delete set null`, então
    // elas voltam pro objetivo sem etapa e a pessoa decide o destino.
    if (error) fail(error, 'apagar a etapa')
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


export class SupabaseWeeklyReviewRepository implements WeeklyReviewRepository {
  async listByUser(userId: string): Promise<WeeklyReview[]> {
    const { data, error } = await supabase()
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(60)

    if (error) fail(error, 'carregar os reviews')
    return (data ?? []).map(toWeeklyReview)
  }

  async save(
    userId: string,
    weekStart: DayKey,
    draft: WeeklyReviewDraft,
  ): Promise<WeeklyReview> {
    // Upsert por (user_id, week_start): o fluxo guiado salva a cada passo e
    // precisa atualizar a mesma linha, nunca criar um review por resposta.
    const { data, error } = await supabase()
      .from('weekly_reviews')
      .upsert(
        {
          user_id: userId,
          week_start: weekStart,
          ...(draft.achievements !== undefined ? { achievements: draft.achievements } : {}),
          ...(draft.difficulties !== undefined ? { difficulties: draft.difficulties } : {}),
          ...(draft.learnings !== undefined ? { learnings: draft.learnings } : {}),
          ...(draft.adjustments !== undefined ? { adjustments: draft.adjustments } : {}),
          ...(draft.priorities !== undefined ? { priorities: draft.priorities } : {}),
          ...(draft.aiSummary !== undefined ? { ai_summary: draft.aiSummary } : {}),
          ...(draft.lastStep !== undefined ? { last_step: draft.lastStep } : {}),
          ...(draft.completedAt !== undefined
            ? { completed_at: draft.completedAt?.toISOString() ?? null }
            : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' },
      )
      .select('*')
      .single()

    if (error) fail(error, 'salvar o review')
    return toWeeklyReview(data)
  }
}
