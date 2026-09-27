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
  createRoutineItem,
  type NewRoutineItemInput,
  type RoutineItem,
  type RoutineOccurrence,
} from '@/domain/entities/routine-item'
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
  ObjectiveAxisConflictError,
  type NewObjectiveInput,
  type Objective,
} from '@/domain/entities/objective'
import { PlanLimitError } from '@/domain/entities/plan-usage'
import type { Profile } from '@/domain/entities/profile'
import {
  assertValidBio,
  assertValidHandle,
  assertValidName,
  assertValidRestWeekdays,
  normalizedRestWeekdays,
} from '@/domain/entities/profile'
import { assertValidBanner, assertValidStatus, normalizeStatus } from '@/domain/entities/profile-banner'
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
import type {
  RoutineItemUpdate,
  RoutineOccurrencePatch,
  RoutineRepository,
} from '@/domain/repositories/routine-repository'
import type {
  AccountExport,
  ProfileRepository,
  ProfileUpdate,
} from '@/domain/repositories/profile-repository'
import { MEDIA_KINDS } from '@/domain/media/media-policy'
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
import type { FollowRepository } from '@/domain/repositories/follow-repository'
import type { ReferralRepository } from '@/domain/repositories/referral-repository'
import type { ClubRepository } from '@/domain/repositories/club-repository'
import type { ClubInvitation, ClubInvitePreview } from '@/domain/entities/club-invite'
import {
  assertValidClubDescription,
  assertValidClubName,
  rankClubMembers,
  type Club,
  type ClubMember,
  type ClubRankedMember,
  type NewClubInput,
} from '@/domain/entities/club'
import type { DayPhotoRepository } from '@/domain/repositories/day-photo-repository'
import {
  createFollow,
  EMPTY_FOLLOW_COUNTS,
  type Follow,
  type FollowCounts,
  type NewFollowInput,
} from '@/domain/entities/follow'
import { createDayPhoto, type DayPhoto, type NewDayPhotoInput } from '@/domain/entities/day-photo'
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
  toRoutineItem,
  toRoutineOccurrence,
  toProfile,
  toFollow,
  toFollowCounts,
  toDayPhoto,
  toClub,
  toClubInvitation,
  toClubInvitePreview,
  toClubMember,
  toClubRankingRow,
  toPlanStage,
  toTask,
  toWeeklyReview,
  toWin,
} from './schemas'

const UNIQUE_VIOLATION = '23505'
/*
  Regra de plano recusando a escrita.

  É o mesmo `22023` que `rpc.ts` deixa subir com o texto original, e por isso as
  mensagens do servidor que usam esse código são escritas pra serem lidas na
  tela. Aqui ele nunca é genérico: quem o levanta é uma guarda de plano, e a
  mensagem dela já diz o que destrava.
*/
const PLAN_REFUSED = '22023'
/*
  Função ausente: base que ainda não rodou a 0012. A busca cai na parcial em
  vez de estourar, pior que não achar pelo @ exato é a tela do Círculo inteira
  quebrar num ambiente que só está desatualizado.
*/
const FUNCTION_MISSING = 'PGRST202'

function fail(error: PostgrestError, action: string): never {
  if (error.code === UNIQUE_VIOLATION) {
    throw new DomainError('Já existe um registro assim.')
  }
  /*
    Banco atrás do app: a tela chama uma função que a migration ainda não
    criou. Isso não é falha de conexão, e dizer "verifica a conexão" manda a
    pessoa reiniciar o roteador por causa de um deploy que faltou. O texto diz
    o que é, e some sozinho quando a migration sobe.
  */
  if (error.code === FUNCTION_MISSING) {
    throw new DomainError('Esse recurso ainda não chegou ao servidor. Tenta de novo mais tarde.')
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

  A remoção acontece em `auth.users`, que a API pública não alcança, e nem
  deveria. A função `delete_my_account` roda como definer, apaga sempre
  `auth.uid()` e deixa o cascade levar o resto: perfil, objetivos, hábitos,
  ações, registros, momentos e, pelo trigger de mídia, os arquivos.
*/
/**
 * Excluir a conta: os arquivos primeiro, pela Storage API, e só depois a
 * linha em `auth.users`, que cascateia o resto.
 *
 * O Supabase recusa `delete from storage.objects` por SQL, então o trigger
 * do banco não consegue mais apagar a pasta da pessoa (migration 0017). Quem
 * pode é o próprio dono, daqui, pela política "dono apaga", e é isso que faz
 * a conta sair sem deixar arquivo órfão.
 */
async function deleteOwnAccount(): Promise<void> {
  const {
    data: { user },
  } = await supabase().auth.getUser()
  if (user) await purgeOwnMedia(user.id)

  const { error } = await supabase().rpc('delete_my_account')
  if (error) throw new DomainError('Não consegui excluir a conta agora.')
  await supabase().auth.signOut({ scope: 'global' })
}

async function purgeOwnMedia(userId: string): Promise<void> {
  const bucket = supabase().storage.from('user-media')
  const failure = new DomainError('Não consegui limpar teus arquivos antes de excluir a conta.')

  // A pasta da pessoa tem uma subpasta por tipo (fotos, audios, anexos) e
  // pode ter arquivos soltos de antes disso. `list` não desce sozinho.
  const folders = ['', ...MEDIA_KINDS]
  const paths: string[] = []
  for (const folder of folders) {
    const prefix = folder ? `${userId}/${folder}` : userId
    const { data: files, error } = await bucket.list(prefix, { limit: 1000 })
    if (error) throw failure
    for (const file of files ?? []) {
      // Pasta vem sem `id`; arquivo vem com. Só arquivo entra na remoção.
      if (file.id) paths.push(`${prefix}/${file.name}`)
    }
  }
  if (paths.length === 0) return

  const { error: removeError } = await bucket.remove(paths)
  if (removeError) throw failure
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
        started_at: draft.startedAt?.toISOString() ?? null,
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
 * `activity_types.slug` é chave primária global, é ela que as FKs de
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
      /*
        O teto de objetivos ativos do plano, aplicado pelo trigger da 0057.

        Sobe como `PlanLimitError` porque é o tipo que a ativação do plano do
        quiz já sabe tratar: ela diz qual limite parou e oferece o que destrava.
        Caindo no `fail` genérico viraria "Falha ao criar o objetivo.", e a
        pessoa ficaria sem saber que a saída existe.
      */
      if (error.code === PLAN_REFUSED) {
        throw new PlanLimitError('Objetivos ativos', error.message)
      }
      if (error.code === UNIQUE_VIOLATION) {
        /*
          Erro TIPADO, com o eixo junto. Quem chama precisa saber qual área
          está ocupada pra oferecer a saída, sem isso a tela só sabe repetir
          a mensagem e mandar "tentar de novo", que falha igual.
        */
        throw new ObjectiveAxisConflictError(
          draft.axis,
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
    if (changes.restWeekdays !== undefined) assertValidRestWeekdays(changes.restWeekdays)
    const status = changes.status !== undefined ? normalizeStatus(changes.status) : undefined
    if (status !== undefined) assertValidStatus(status)
    if (changes.banner !== undefined) assertValidBanner(changes.banner)

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
        ...(changes.restWeekdays !== undefined
          ? { rest_weekdays: normalizedRestWeekdays(changes.restWeekdays) }
          : {}),
        ...(status !== undefined
          ? { status_emoji: status?.emoji ?? null, status_text: status?.text ?? null }
          : {}),
        ...(changes.banner !== undefined ? { banner: changes.banner } : {}),
        /*
          Rede por rede, e não o objeto inteiro: mandar `socials` fechado faria
          "só troquei o Instagram" apagar o TikTok e o LinkedIn, porque o que
          não vem no objeto vem como `undefined` e viraria `null` na coluna.
        */
        ...(changes.socials?.instagram !== undefined
          ? { instagram: changes.socials.instagram }
          : {}),
        ...(changes.socials?.tiktok !== undefined ? { tiktok: changes.socials.tiktok } : {}),
        ...(changes.socials?.linkedin !== undefined ? { linkedin: changes.socials.linkedin } : {}),
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

  async resetData(): Promise<void> {
    const {
      data: { user },
    } = await supabase().auth.getUser()
    if (user) await purgeOwnMedia(user.id)

    const { error } = await supabase().rpc('reset_my_data')
    if (error) throw new DomainError('Não consegui recomeçar do zero agora.')
  }

  async exportData(): Promise<AccountExport> {
    const { data, error } = await supabase().rpc('export_my_data')
    if (error) throw new DomainError('Não consegui montar a exportação agora.')
    return data as AccountExport
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

export class SupabaseRoutineRepository implements RoutineRepository {
  async listItems(userId: string): Promise<RoutineItem[]> {
    const { data, error } = await supabase()
      .from('routine_items')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('order', { ascending: true })

    if (error) fail(error, 'carregar a rotina')
    return (data ?? []).map(toRoutineItem)
  }

  async createItem(input: NewRoutineItemInput): Promise<RoutineItem> {
    // O domínio valida ANTES do banco: nome curto, horário torto e "dias
    // específicos sem dia" viram mensagem em português, não erro de constraint.
    const draft = createRoutineItem(input, crypto.randomUUID())

    const { data, error } = await supabase()
      .from('routine_items')
      .insert({
        user_id: draft.userId,
        title: draft.title,
        note: draft.note,
        category: draft.category,
        time_of_day: draft.timeOfDay,
        day_part: draft.dayPart,
        duration_min: draft.durationMin,
        recurrence: draft.recurrence,
        weekdays: draft.weekdays,
        day: draft.day,
        objective_id: draft.objectiveId,
        reminder_min: draft.reminderMin,
        order: draft.order,
      })
      .select('*')
      .single()

    if (error) fail(error, 'criar o item da rotina')
    return toRoutineItem(data)
  }

  async updateItem(id: string, userId: string, changes: RoutineItemUpdate): Promise<RoutineItem> {
    const { data, error } = await supabase()
      .from('routine_items')
      .update({
        ...(changes.title !== undefined ? { title: changes.title } : {}),
        ...(changes.note !== undefined ? { note: changes.note } : {}),
        ...(changes.category !== undefined ? { category: changes.category } : {}),
        ...(changes.timeOfDay !== undefined ? { time_of_day: changes.timeOfDay } : {}),
        ...(changes.dayPart !== undefined ? { day_part: changes.dayPart } : {}),
        ...(changes.durationMin !== undefined ? { duration_min: changes.durationMin } : {}),
        ...(changes.recurrence !== undefined ? { recurrence: changes.recurrence } : {}),
        ...(changes.weekdays !== undefined ? { weekdays: changes.weekdays } : {}),
        ...(changes.day !== undefined ? { day: changes.day } : {}),
        ...(changes.objectiveId !== undefined ? { objective_id: changes.objectiveId } : {}),
        ...(changes.reminderMin !== undefined ? { reminder_min: changes.reminderMin } : {}),
        ...(changes.order !== undefined ? { order: changes.order } : {}),
        ...(changes.pausedAt !== undefined
          ? { paused_at: changes.pausedAt?.toISOString() ?? null }
          : {}),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) fail(error, 'atualizar o item da rotina')
    return toRoutineItem(data)
  }

  async archiveItem(id: string, userId: string): Promise<void> {
    const { error } = await supabase()
      .from('routine_items')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) fail(error, 'arquivar o item da rotina')
  }

  async listOccurrences(userId: string): Promise<RoutineOccurrence[]> {
    const { data, error } = await supabase()
      .from('routine_occurrences')
      .select('*')
      .eq('user_id', userId)
      .order('day', { ascending: false })
      .limit(1000)

    if (error) fail(error, 'carregar os dias da rotina')
    return (data ?? []).map(toRoutineOccurrence)
  }

  async setOccurrence(
    userId: string,
    itemId: string,
    day: DayKey,
    patch: RoutineOccurrencePatch,
  ): Promise<RoutineOccurrence> {
    /*
      Pendente e sem nada guardado é a ausência de linha.

      Desmarcar apaga em vez de gravar um "pendente", pelo mesmo motivo do
      hábito: linha que não diz nada só faz a tabela crescer. Mas pendente COM
      horário trocado ou dia de destino fica, porque ali ela carrega a decisão
      de reagendar.
    */
    const guardaDecisao = patch.timeOverride != null || patch.movedToDay != null

    if (patch.status === 'pendente' && !guardaDecisao) {
      const { error } = await supabase()
        .from('routine_occurrences')
        .delete()
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .eq('day', day)

      if (error) fail(error, 'desfazer o registro da rotina')
      return {
        id: crypto.randomUUID(),
        userId,
        itemId,
        day,
        status: 'pendente',
        plannedTime: patch.plannedTime ?? null,
        timeOverride: null,
        movedToDay: null,
        completedAt: null,
        createdAt: new Date(),
      }
    }

    const { data, error } = await supabase()
      .from('routine_occurrences')
      .upsert(
        {
          // O `user_id` é reescrito pelo trigger a partir do dono do item: o
          // que vai daqui é conveniência, nunca a fonte da autorização.
          user_id: userId,
          item_id: itemId,
          day,
          status: patch.status,
          ...(patch.plannedTime !== undefined ? { planned_time: patch.plannedTime } : {}),
          ...(patch.timeOverride !== undefined ? { time_override: patch.timeOverride } : {}),
          ...(patch.movedToDay !== undefined ? { moved_to_day: patch.movedToDay } : {}),
        },
        { onConflict: 'item_id,day' },
      )
      .select('*')
      .single()

    if (error) fail(error, 'registrar a rotina')
    return toRoutineOccurrence(data)
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
 * existir, ele pagina, não é essa chamada que vira infinita.
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
 * A leitura traz TODAS as linhas em que a pessoa aparece, aceitas, pendentes
 * e recusadas, porque as três importam na tela: amigo na lista, pedido
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
      SQL, mas seria uma consulta que ela controla, e o `%` transformaria
      qualquer busca num "traz todo mundo".
    */
    const escaped = needle.replace(/[%_,().*]/g, '')
    if (escaped.length < 2) return []

    /*
      Duas buscas somadas, e a diferença entre elas é a política de privacidade
      inteira.

      A parcial roda pelo SELECT normal e, desde a 0012, só enxerga quem
      escolheu `publico`, é o que "público" significa. A exata passa por uma
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
      faz é separar o que a pessoa criou do que aceitaram, e a tela precisa
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
        // Só vai quando existe: base anterior à 0062 não tem a coluna, e
        // mandar `null` nela quebraria a criação de desafio comum.
        ...(draft.clubId ? { club_id: draft.clubId } : {}),
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

      Não é transação de verdade, o PostgREST não oferece uma, mas é a
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

/**
 * Seguir, contra o Supabase.
 *
 * As contagens NÃO saem de um `select count`: a política de `follows` só deixa
 * cada pessoa ver as próprias linhas, então contar pelo select daria "1
 * seguidor" em qualquer perfil que você mesma segue. Elas vêm da função
 * `follow_counts` (0060), que devolve dois números e nada mais.
 */
export class SupabaseFollowRepository implements FollowRepository {
  async counts(userId: string): Promise<FollowCounts> {
    const { data, error } = await supabase().rpc('follow_counts', { target: userId })
    if (error) fail(error, 'carregar seguidores')

    // A função devolve UMA linha; o PostgREST entrega como lista.
    const row = Array.isArray(data) ? data[0] : data
    return row ? toFollowCounts(row) : EMPTY_FOLLOW_COUNTS
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const { count, error } = await supabase()
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', followerId)
      .eq('following_id', followingId)

    if (error) fail(error, 'conferir se você já segue')
    return (count ?? 0) > 0
  }

  async follow(input: NewFollowInput): Promise<Follow> {
    const draft = createFollow(input)

    const { data, error } = await supabase()
      .from('follows')
      .upsert(
        {
          follower_id: draft.followerId,
          following_id: draft.followingId,
        },
        // Seguir de novo é a mesma linha, não um erro pra tela resolver.
        { onConflict: 'follower_id,following_id', ignoreDuplicates: false },
      )
      .select('*')
      .single()

    if (error) fail(error, 'seguir')
    return toFollow(data)
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const { error } = await supabase()
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)

    if (error) fail(error, 'deixar de seguir')
  }
}

/**
 * A foto do dia, contra o Supabase.
 *
 * Aqui mora só o vínculo dia -> caminho. O arquivo sobe e é assinado pelo
 * `MediaRepository`, que já tem bucket, limite de tamanho e link temporário,
 * duplicar isso daria duas regras de upload discordando na primeira mudança.
 */
export class SupabaseDayPhotoRepository implements DayPhotoRepository {
  async listBetween(userId: string, from: DayKey, to: DayKey): Promise<DayPhoto[]> {
    const { data, error } = await supabase()
      .from('day_photos')
      .select('*')
      .eq('user_id', userId)
      .gte('day', from)
      .lte('day', to)
      .order('day', { ascending: false })

    if (error) fail(error, 'carregar as fotos do mês')
    return (data ?? []).map(toDayPhoto)
  }

  async save(input: NewDayPhotoInput): Promise<DayPhoto> {
    const draft = createDayPhoto(input)

    const { data, error } = await supabase()
      .from('day_photos')
      .upsert(
        { user_id: draft.userId, day: draft.day, path: draft.path },
        // Uma por dia: a segunda foto do mesmo dia troca a primeira.
        { onConflict: 'user_id,day' },
      )
      .select('*')
      .single()

    if (error) fail(error, 'guardar a foto do dia')
    return toDayPhoto(data)
  }

  async remove(userId: string, day: DayKey): Promise<void> {
    const { error } = await supabase()
      .from('day_photos')
      .delete()
      .eq('user_id', userId)
      .eq('day', day)

    if (error) fail(error, 'tirar a foto do dia')
  }
}

/**
 * O convite de amigo, contra o Supabase.
 *
 * O registro passa por `register_referral` (0061), que aplica as regras e
 * resolve o @ em id. A contagem sai do SELECT normal: a política deixa cada
 * pessoa ver as próprias linhas, e "quantos entraram pelo meu convite" é
 * exatamente uma delas.
 */
export class SupabaseReferralRepository implements ReferralRepository {
  async register(inviteCode: string): Promise<boolean> {
    const { data, error } = await supabase().rpc('register_referral', {
      inviter_handle: inviteCode,
    })

    /*
      Falhar aqui não pode estragar o primeiro minuto de uso: isto roda logo
      depois de a conta nascer, e nada do que a pessoa veio fazer depende
      disso. Erro vira "não registrei", e segue.
    */
    if (error) return false
    return data === true
  }

  async countInvited(userId: string): Promise<number> {
    const { count, error } = await supabase()
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('inviter_id', userId)

    if (error) return 0
    return count ?? 0
  }
}

/**
 * Os clubes, contra o Supabase.
 *
 * Criar passa pela função `create_club` (0062), que confere a assinatura e
 * coloca o dono dentro na mesma transação. Editar e arquivar vão pelo UPDATE
 * normal, onde a política já exige dono COM PRO, a tela esconde o botão, o
 * banco recusa a escrita, e é o banco que vale.
 */
export class SupabaseClubRepository implements ClubRepository {
  async listMine(userId: string): Promise<Club[]> {
    const { data, error } = await supabase()
      .from('club_members')
      .select('clubs(*)')
      .eq('user_id', userId)

    if (error) fail(error, 'carregar teus clubes')

    return (data ?? [])
      .flatMap((row) => {
        const club = (row as { clubs: unknown }).clubs
        return club ? [toClub(club)] : []
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async listOpen(limit = 20): Promise<Club[]> {
    /*
      A política já esconde o que é por convite. O filtro aqui é pra não
      arrastar os clubes de que a pessoa participa pra dentro da descoberta,
      eles têm lista própria.
    */
    const { data, error } = await supabase()
      .from('clubs')
      .select('*')
      .eq('privacy', 'aberto')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) fail(error, 'carregar os clubes abertos')
    return (data ?? []).map(toClub)
  }

  async findById(id: string): Promise<Club | null> {
    const { data, error } = await supabase().from('clubs').select('*').eq('id', id).maybeSingle()
    if (error) fail(error, 'abrir o clube')
    return data ? toClub(data) : null
  }

  async listMembers(clubId: string): Promise<ClubMember[]> {
    const { data, error } = await supabase()
      .from('club_members')
      .select('*')
      .eq('club_id', clubId)
      .order('joined_at', { ascending: true })

    if (error) fail(error, 'carregar os membros')
    return (data ?? []).map(toClubMember)
  }

  async ranking(clubId: string): Promise<ClubRankedMember[]> {
    const { data, error } = await supabase().rpc('club_ranking', { club: clubId })
    if (error) fail(error, 'carregar o ranking do clube')

    const rows = ((data ?? []) as unknown[]).map(toClubRankingRow)
    return rankClubMembers(rows)
  }

  async create(input: NewClubInput): Promise<Club> {
    assertValidClubName(input.name)
    assertValidClubDescription(input.description)

    const { data, error } = await supabase().rpc('create_club', {
      p_name: input.name.trim(),
      p_description: input.description?.trim() || null,
      p_category: input.category,
      p_cover: input.cover,
      p_privacy: input.privacy,
    })

    if (error) {
      // O código que a função usa pra recusar quem não assina. A tela precisa
      // distinguir isso de uma falha, pra oferecer o PRO em vez de um erro.
      if (error.code === 'P0001') {
        throw new DomainError('Criar clube faz parte do Momentumm PRO.')
      }
      fail(error, 'criar o clube')
    }

    // A função devolve a linha inteira; o PostgREST entrega como objeto.
    return toClub(Array.isArray(data) ? data[0] : data)
  }

  async update(id: string, changes: Partial<NewClubInput>): Promise<Club> {
    if (changes.name !== undefined) assertValidClubName(changes.name)
    if (changes.description !== undefined) assertValidClubDescription(changes.description)

    const { data, error } = await supabase()
      .from('clubs')
      .update({
        ...(changes.name !== undefined ? { name: changes.name.trim() } : {}),
        ...(changes.description !== undefined
          ? { description: changes.description?.trim() || null }
          : {}),
        ...(changes.category !== undefined ? { category: changes.category } : {}),
        ...(changes.cover !== undefined ? { cover: changes.cover } : {}),
        ...(changes.privacy !== undefined ? { privacy: changes.privacy } : {}),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) fail(error, 'salvar o clube')
    return toClub(data)
  }

  async archive(id: string): Promise<void> {
    const { error } = await supabase()
      .from('clubs')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)

    if (error) fail(error, 'arquivar o clube')
  }

  async join(clubId: string, userId: string): Promise<void> {
    const { error } = await supabase()
      .from('club_members')
      .insert({ club_id: clubId, user_id: userId, role: 'membro' })

    if (error) fail(error, 'entrar no clube')
  }

  async leave(clubId: string, userId: string): Promise<void> {
    const { error } = await supabase()
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', userId)

    if (error) fail(error, 'sair do clube')
  }

  async invite(clubId: string, userId: string): Promise<void> {
    const { error } = await supabase().rpc('invite_to_club', {
      p_club: clubId,
      p_person: userId,
    })

    if (error) {
      // O mesmo código que `create_club` usa pra recusar quem não assina: a
      // tela oferece o PRO em vez de mostrar um aviso vermelho.
      if (error.code === 'P0001') {
        throw new DomainError('Convidar pro clube faz parte do Momentumm PRO.')
      }
      fail(error, 'convidar pro clube')
    }
  }

  async listMyInvitations(): Promise<ClubInvitation[]> {
    const { data, error } = await supabase().rpc('my_club_invitations')
    if (error) fail(error, 'carregar teus convites')
    return ((data ?? []) as unknown[]).map(toClubInvitation)
  }

  async respondInvitation(invitationId: string, accept: boolean): Promise<void> {
    const { error } = await supabase().rpc('respond_club_invitation', {
      p_invitation: invitationId,
      p_accept: accept,
    })

    if (error) fail(error, accept ? 'entrar no clube' : 'recusar o convite')
  }

  async inviteToken(clubId: string, rotate = false): Promise<string> {
    const { data, error } = await supabase().rpc('club_invite_token', {
      p_club: clubId,
      p_rotate: rotate,
    })

    if (error) {
      if (error.code === 'P0001') {
        throw new DomainError('O link do clube faz parte do Momentumm PRO.')
      }
      fail(error, 'gerar o link do clube')
    }

    return String(data)
  }

  async previewInvite(token: string): Promise<ClubInvitePreview> {
    const { data, error } = await supabase().rpc('club_invite_preview', { p_token: token })
    if (error) fail(error, 'abrir o convite')
    return toClubInvitePreview(data)
  }

  async joinByToken(token: string): Promise<string> {
    const { data, error } = await supabase().rpc('join_club_by_token', { p_token: token })
    if (error) fail(error, 'entrar no clube')
    return String(data)
  }
}
