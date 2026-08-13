import type { PostgrestError } from '@supabase/supabase-js'
import type { AuthService, AuthUser } from '@/domain/auth/auth-service'
import { createActivity, type Activity, type NewActivityInput } from '@/domain/entities/activity'
import { createGoal, type Goal, type NewGoalInput } from '@/domain/entities/goal'
import type { Profile } from '@/domain/entities/profile'
import { assertValidBio, assertValidHandle, assertValidName } from '@/domain/entities/profile'
import type { ActivityRepository } from '@/domain/repositories/activity-repository'
import type { GoalRepository } from '@/domain/repositories/goal-repository'
import type { ProfileRepository, ProfileUpdate } from '@/domain/repositories/profile-repository'
import { DomainError, InfrastructureError } from '@/shared/errors'
import { supabase } from './client'
import { toActivity, toGoal, toProfile } from './schemas'

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
