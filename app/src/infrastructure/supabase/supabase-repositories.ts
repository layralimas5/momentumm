import type { PostgrestError } from '@supabase/supabase-js'
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
import {
  createChallenge,
  type Challenge,
  type ChallengeParticipant,
  type NewChallengeInput,
} from '@/domain/entities/challenge'
import type { CircleAuthor, CircleFeedItem } from '@/domain/entities/circle-feed'
import {
  createFriendship,
  type Friendship,
  type NewFriendshipInput,
} from '@/domain/entities/friendship'
import {
  createJourneyEvent,
  type JourneyEvent,
  type JourneyVisibility,
  type NewJourneyEventInput,
} from '@/domain/entities/journey-event'
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
import type {
  ChallengeRepository,
  ChallengeUpdate,
} from '@/domain/repositories/challenge-repository'
import type { FriendshipRepository } from '@/domain/repositories/friendship-repository'
import type { JourneyEventRepository } from '@/domain/repositories/journey-event-repository'
import type { WeeklyReviewRepository } from '@/domain/repositories/weekly-review-repository'
import type { WinRepository } from '@/domain/repositories/win-repository'
import { DomainError, InfrastructureError } from '@/shared/errors'
import { supabase } from './client'
import {
  toActivity,
  toChallenge,
  toChallengeParticipant,
  toCheckIn,
  toCircleAuthor,
  toFriendship,
  toJourneyEvent,
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
/*
  Função ausente: base que ainda não rodou a 0012. A busca cai na parcial em
  vez de estourar — pior que não achar pelo @ exato é a tela do Círculo inteira
  quebrar num ambiente que só está desatualizado.
*/
const FUNCTION_MISSING = 'PGRST202'

function fail(error: PostgrestError, action: string): never {
  if (error.code === UNIQUE_VIOLATION) {
    throw new DomainError('Já existe um registro assim.')
  }
  throw new InfrastructureError(`Falha ao ${action}.`, error)
}

/*
  A autenticação mudou de arquivo.

  Ela deixou de ser um adaptador de quatro métodos: MFA, recuperação, OAuth e
  nível de garantia da sessão sao regras de seguranca, e elas precisam caber
  numa revisão sem rolar por mil linhas de repositório. O re-export mantém
  todo o resto do app importando do mesmo lugar de antes.
*/
export { SupabaseAuthService } from './supabase-auth'

/*
  Exclusão de conta.

  A remoção acontece em `auth.users`, que a API pública não alcança — e nem
  deveria. A função `delete_my_account` roda como definer, apaga sempre
  `auth.uid()` e deixa o cascade levar o resto: perfil, objetivos, hábitos,
  ações, registros, momentos e, pelo trigger de mídia, os arquivos.
*/
async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase().rpc('delete_my_account')
  if (error) throw new DomainError('Não consegui excluir a conta agora.')
  await supabase().auth.signOut({ scope: 'global' })
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
        ...(changes.avatarUrl !== undefined ? { avatar_url: changes.avatarUrl } : {}),
        ...(changes.defaultVisibility !== undefined
          ? { default_visibility: changes.defaultVisibility }
          : {}),
        ...(changes.visibility !== undefined
          ? { profile_visibility: changes.visibility }
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

  async deleteAccount(): Promise<void> {
    await deleteOwnAccount()
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

/**
 * Momentos da jornada.
 *
 * A leitura é limitada aos mais recentes: a tabela cresce pra sempre e nenhuma
 * tela do app precisa do histórico inteiro carregado de uma vez. Quando o feed
 * existir, ele pagina — não é essa chamada que vira infinita.
 */
export class SupabaseJourneyEventRepository implements JourneyEventRepository {
  async listByUser(userId: string): Promise<JourneyEvent[]> {
    const { data, error } = await supabase()
      .from('journey_events')
      .select('*')
      .eq('user_id', userId)
      .order('day', { ascending: false })
      .limit(120)

    if (error) fail(error, 'carregar os momentos da jornada')
    return (data ?? []).map(toJourneyEvent)
  }

  /**
   * O feed do Círculo.
   *
   * Nenhum filtro de amizade na consulta: quem decide o que esta pessoa pode
   * ler é a RLS da migration 0009. Repetir a regra aqui criaria dois lugares
   * onde ela pode divergir, e o que valeria de verdade seria sempre o do banco.
   * O filtro daqui existe só pra não trazer os próprios momentos de volta.
   */
  async listCircleFeed(userId: string): Promise<CircleFeedItem[]> {
    const { data, error } = await supabase()
      .from('journey_events')
      .select('*')
      .eq('visibility', 'amigos')
      .neq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(60)

    if (error) fail(error, 'carregar o círculo')
    return this.decorate((data ?? []).map(toJourneyEvent), userId)
  }

  async listByAuthor(userId: string, authorId: string): Promise<CircleFeedItem[]> {
    const { data, error } = await supabase()
      .from('journey_events')
      .select('*')
      .eq('user_id', authorId)
      .eq('visibility', 'amigos')
      .order('completed_at', { ascending: false })
      .limit(40)

    if (error) fail(error, 'carregar os momentos dessa pessoa')
    return this.decorate((data ?? []).map(toJourneyEvent), userId)
  }

  /**
   * Junta autor e apoio aos eventos.
   *
   * Duas consultas pro lote inteiro, não duas por linha: um feed de sessenta
   * momentos faria cento e vinte viagens ao banco se cada card fosse buscar o
   * próprio autor.
   */
  private async decorate(
    events: readonly JourneyEvent[],
    userId: string,
  ): Promise<CircleFeedItem[]> {
    if (events.length === 0) return []

    const authorIds = [...new Set(events.map((event) => event.userId))]
    const eventIds = events.map((event) => event.id)

    const [people, supports] = await Promise.all([
      supabase().from('profiles').select('id, name, handle, avatar_url').in('id', authorIds),
      supabase()
        .from('journey_event_supports')
        .select('event_id, user_id')
        .in('event_id', eventIds),
    ])

    if (people.error) fail(people.error, 'carregar quem publicou')
    if (supports.error) fail(supports.error, 'carregar os apoios')

    const byId = new Map(
      (people.data ?? []).map((row) => {
        const author = toCircleAuthor(row)
        return [author.id, author] as const
      }),
    )

    const rows = supports.data ?? []

    return events.flatMap((event) => {
      const author = byId.get(event.userId)
      // Autor que a RLS não deixa ler é autor que não deveria estar no feed:
      // some da lista em vez de virar um card sem nome.
      if (!author) return []

      const mine = rows.filter((row) => row.event_id === event.id)
      return [
        {
          event,
          author,
          supports: mine.length,
          supportedByMe: mine.some((row) => row.user_id === userId),
        },
      ]
    })
  }

  async setVisibility(
    id: string,
    userId: string,
    visibility: JourneyVisibility,
  ): Promise<JourneyEvent> {
    const { data, error } = await supabase()
      .from('journey_events')
      .update({ visibility })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) fail(error, 'mudar quem vê esse momento')
    return toJourneyEvent(data)
  }

  async support(eventId: string, userId: string, supported: boolean): Promise<void> {
    const table = supabase().from('journey_event_supports')

    const { error } = supported
      ? await table.upsert({ event_id: eventId, user_id: userId })
      : await table.delete().eq('event_id', eventId).eq('user_id', userId)

    if (error) fail(error, 'registrar o apoio')
  }

  async record(input: NewJourneyEventInput): Promise<JourneyEvent> {
    const draft = createJourneyEvent(input, crypto.randomUUID())

    // Upsert pela chave de deduplicação, igual ao índice parcial da migration:
    // remarcar o último hábito do dia atualiza a linha em vez de empilhar.
    const { data, error } = await supabase()
      .from('journey_events')
      .upsert(
        {
          user_id: draft.userId,
          type: draft.type,
          source_type: draft.sourceType,
          source_id: draft.sourceId,
          title: draft.title,
          description: draft.description,
          progress_before: draft.progressBefore,
          progress_after: draft.progressAfter,
          momentum_before: draft.momentumBefore,
          momentum_after: draft.momentumAfter,
          duration_min: draft.durationMin,
          completion_percentage: draft.completionPercentage,
          metadata: draft.metadata,
          visibility: draft.visibility,
          day: draft.day,
          completed_at: draft.completedAt?.toISOString() ?? null,
        },
        { onConflict: 'user_id,type,source_id,day' },
      )
      .select('*')
      .single()

    if (error) fail(error, 'salvar o momento da jornada')
    return toJourneyEvent(data)
  }
}

/**
 * Amizades.
 *
 * A leitura traz TODAS as linhas em que a pessoa aparece — aceitas, pendentes
 * e recusadas — porque as três importam na tela: amigo na lista, pedido
 * esperando resposta, e recusado pra a busca não oferecer de novo quem já
 * disse não.
 */
export class SupabaseFriendshipRepository implements FriendshipRepository {
  async listByUser(userId: string): Promise<Friendship[]> {
    const { data, error } = await supabase()
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error) fail(error, 'carregar teu círculo')
    return (data ?? []).map(toFriendship)
  }

  async listPeople(ids: readonly string[]): Promise<CircleAuthor[]> {
    if (ids.length === 0) return []

    const { data, error } = await supabase()
      .from('profiles')
      .select('id, name, handle, avatar_url')
      .in('id', [...ids])

    if (error) fail(error, 'carregar as pessoas do círculo')
    return (data ?? []).map(toCircleAuthor)
  }

  async search(userId: string, term: string): Promise<CircleAuthor[]> {
    const needle = term.trim()
    // Duas letras é o piso: com uma, a busca devolveria metade da base e não
    // ajudaria ninguém a achar quem procura.
    if (needle.length < 2) return []

    /*
      O filtro do PostgREST é uma STRING, com vírgula e parêntese como
      separadores. Deixar passar o que a pessoa digitou não seria injeção de
      SQL, mas seria uma consulta que ela controla — e o `%` transformaria
      qualquer busca num "traz todo mundo".
    */
    const escaped = needle.replace(/[%_,().*]/g, '')
    if (escaped.length < 2) return []

    /*
      Duas buscas somadas, e a diferença entre elas é a política de privacidade
      inteira.

      A parcial roda pelo SELECT normal e, desde a 0012, só enxerga quem
      escolheu `publico` — é o que "público" significa. A exata passa por uma
      função `security definer` de retorno estreito e encontra qualquer pessoa
      pelo @ completo, inclusive quem é privado: sem isso ninguém conseguiria
      adicionar ninguém, já que todo perfil nasce fechado.
    */
    const exact = await supabase().rpc('find_profile_by_handle', { target_handle: needle })
    if (exact.error && exact.error.code !== FUNCTION_MISSING) {
      fail(exact.error, 'buscar pelo @')
    }

    const { data, error } = await supabase()
      .from('profiles')
      .select('id, name, handle, avatar_url')
      .or(`name.ilike.%${escaped}%,handle.ilike.%${escaped}%`)
      .neq('id', userId)
      .limit(20)

    if (error) fail(error, 'buscar pessoas')

    // O @ exato primeiro: quem digitou o endereço inteiro está procurando uma
    // pessoa específica, não navegando uma lista.
    const found = (exact.data ?? []) as unknown[]
    const merged = [...found, ...(data ?? [])].map(toCircleAuthor)
    const unique = new Map(merged.map((person) => [person.id, person]))
    unique.delete(userId)

    return [...unique.values()]
  }

  async request(input: NewFriendshipInput): Promise<Friendship> {
    const draft = createFriendship(input, crypto.randomUUID())

    const { data, error } = await supabase()
      .from('friendships')
      .insert({
        requester_id: draft.requesterId,
        addressee_id: draft.addresseeId,
        status: draft.status,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new DomainError('Vocês já têm um pedido em aberto ou uma amizade.')
      }
      fail(error, 'enviar o pedido')
    }
    return toFriendship(data)
  }

  async respond(id: string, userId: string, accept: boolean): Promise<Friendship> {
    // O filtro pelo destinatário é redundante com a RLS de propósito: a
    // política é quem garante, e o filtro é quem deixa o erro compreensível.
    const { data, error } = await supabase()
      .from('friendships')
      .update({ status: accept ? 'aceita' : 'recusada', responded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('addressee_id', userId)
      .select('*')
      .single()

    if (error) fail(error, 'responder o pedido')
    return toFriendship(data)
  }

  async remove(id: string, userId: string): Promise<void> {
    const { error } = await supabase()
      .from('friendships')
      .delete()
      .eq('id', id)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

    if (error) fail(error, 'desfazer a amizade')
  }
}

/**
 * Desafios.
 *
 * Nenhuma consulta filtra por participação: quem decide o que esta pessoa
 * enxerga é a RLS da migration 0011. Repetir a regra aqui criaria dois lugares
 * onde ela pode divergir, e o que valeria de verdade seria sempre o do banco.
 */
export class SupabaseChallengeRepository implements ChallengeRepository {
  async listByUser(userId: string): Promise<Challenge[]> {
    /*
      Dois passos, e o primeiro existe pra ORDENAR, não pra proteger.

      A política de `challenges` já responde "posso ver este?". O que ela não
      faz é separar o que a pessoa criou do que aceitaram — e a tela precisa
      dos dois lados. Buscar antes os ids em que ela aparece deixa a lista sob
      controle sem duplicar a regra de acesso: o banco continua sendo quem
      recusa.
    */
    const mine = await supabase()
      .from('challenge_participants')
      .select('challenge_id')
      .eq('user_id', userId)

    if (mine.error) fail(mine.error, 'carregar teus desafios')

    const ids = [...new Set((mine.data ?? []).map((row) => row.challenge_id as string))]
    const filter = ids.length > 0 ? `owner_id.eq.${userId},id.in.(${ids.join(',')})` : `owner_id.eq.${userId}`

    const { data, error } = await supabase()
      .from('challenges')
      .select('*')
      .or(filter)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) fail(error, 'carregar teus desafios')
    return (data ?? []).map(toChallenge)
  }

  async listParticipants(challengeIds: readonly string[]): Promise<ChallengeParticipant[]> {
    if (challengeIds.length === 0) return []

    const { data, error } = await supabase()
      .from('challenge_participants')
      .select('*')
      .in('challenge_id', [...challengeIds])

    if (error) fail(error, 'carregar quem está nos desafios')
    return (data ?? []).map(toChallengeParticipant)
  }

  async create(input: NewChallengeInput): Promise<{
    challenge: Challenge
    participant: ChallengeParticipant
  }> {
    const draft = createChallenge(input, crypto.randomUUID())

    const created = await supabase()
      .from('challenges')
      .insert({
        owner_id: draft.ownerId,
        name: draft.name,
        description: draft.description,
        axis: draft.axis,
        mode: draft.mode,
        target: draft.target,
        daily_target: draft.dailyTarget,
        starts_on: draft.startsOn,
        ends_on: draft.endsOn,
      })
      .select('*')
      .single()

    if (created.error) fail(created.error, 'criar o desafio')
    const challenge = toChallenge(created.data)

    /*
      O dono entra na mesma operação, e se a entrada falhar o desafio some.

      Não é transação de verdade — o PostgREST não oferece uma — mas é a
      compensação honesta: um desafio sem o dono dentro não é desafio, é uma
      linha órfã que a interface não consegue abrir nem apagar.
    */
    const joined = await supabase()
      .from('challenge_participants')
      .insert({
        challenge_id: challenge.id,
        user_id: draft.ownerId,
        status: 'ativo',
        habit_id: input.habitId ?? null,
      })
      .select('*')
      .single()

    if (joined.error) {
      await supabase().from('challenges').delete().eq('id', challenge.id)
      fail(joined.error, 'entrar no desafio que você criou')
    }

    return { challenge, participant: toChallengeParticipant(joined.data) }
  }

  async update(id: string, ownerId: string, changes: ChallengeUpdate): Promise<Challenge> {
    const { data, error } = await supabase()
      .from('challenges')
      .update({
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.description !== undefined ? { description: changes.description } : {}),
        ...(changes.completedAt !== undefined
          ? { completed_at: changes.completedAt?.toISOString() ?? null }
          : {}),
        ...(changes.archivedAt !== undefined
          ? { archived_at: changes.archivedAt?.toISOString() ?? null }
          : {}),
      })
      .eq('id', id)
      .eq('owner_id', ownerId)
      .select('*')
      .single()

    if (error) fail(error, 'atualizar o desafio')
    return toChallenge(data)
  }

  async invite(
    challengeId: string,
    _ownerId: string,
    userId: string,
  ): Promise<ChallengeParticipant> {
    const { data, error } = await supabase()
      .from('challenge_participants')
      .insert({ challenge_id: challengeId, user_id: userId, status: 'convidado' })
      .select('*')
      .single()

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new DomainError('Essa pessoa já está no desafio.')
      }
      fail(error, 'convidar pro desafio')
    }
    return toChallengeParticipant(data)
  }

  async respond(
    participantId: string,
    userId: string,
    accept: boolean,
  ): Promise<ChallengeParticipant> {
    // O filtro pelo dono da linha é redundante com a RLS de propósito: a
    // política é quem garante, o filtro é quem deixa o erro compreensível.
    const { data, error } = await supabase()
      .from('challenge_participants')
      .update({ status: accept ? 'ativo' : 'recusado' })
      .eq('id', participantId)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) fail(error, 'responder o convite')
    return toChallengeParticipant(data)
  }

  async leave(participantId: string, userId: string): Promise<void> {
    // Sair MARCA a linha, não apaga: o desafio precisa continuar sabendo quem
    // estava dentro enquanto ele rodava, e apagar reabriria o convite como se
    // nada tivesse acontecido.
    const { error } = await supabase()
      .from('challenge_participants')
      .update({ status: 'saiu' })
      .eq('id', participantId)
      .eq('user_id', userId)

    if (error) fail(error, 'sair do desafio')
  }

  async setHabit(
    participantId: string,
    userId: string,
    habitId: string | null,
  ): Promise<ChallengeParticipant> {
    const { data, error } = await supabase()
      .from('challenge_participants')
      .update({ habit_id: habitId })
      .eq('id', participantId)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) fail(error, 'vincular o hábito ao desafio')
    return toChallengeParticipant(data)
  }

  async publishProgress(
    participantId: string,
    userId: string,
    doneDays: number,
    completed: boolean,
  ): Promise<ChallengeParticipant> {
    const { data, error } = await supabase()
      .from('challenge_participants')
      .update({
        done_days: Math.max(0, Math.round(doneDays)),
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', participantId)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) fail(error, 'publicar teu avanço no desafio')
    return toChallengeParticipant(data)
  }
}
