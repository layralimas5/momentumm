import type {
  AuthService,
  AuthUser,
  MfaEnrollment,
  MfaFactor,
  SessionInfo,
  SignUpResult,
} from '@/domain/auth/auth-service'
import { DomainError } from '@/shared/errors'
import type { Activity, NewActivityInput } from '@/domain/entities/activity'
import type { ActivityType } from '@/domain/entities/activity-type'
import type { CheckIn, NewCheckInInput } from '@/domain/entities/checkin'
import type { DayKey } from '@/domain/entities/day'
import type { Habit, HabitLog, HabitStatus, NewHabitInput } from '@/domain/entities/habit'
import type {
  Challenge,
  ChallengeParticipant,
  NewChallengeInput,
} from '@/domain/entities/challenge'
import type { CircleAuthor, CircleFeedItem } from '@/domain/entities/circle-feed'
import {
  friendIdsOf,
  type Friendship,
  type NewFriendshipInput,
} from '@/domain/entities/friendship'
import type {
  JourneyEvent,
  JourneyVisibility,
  NewJourneyEventInput,
} from '@/domain/entities/journey-event'
import type { NewTaskInput, Task } from '@/domain/entities/task'
import type { WeeklyReview, WeeklyReviewDraft } from '@/domain/entities/weekly-review'
import type { NewWinInput, Win } from '@/domain/entities/win'
import type { Goal, NewGoalInput } from '@/domain/entities/goal'
import type { NewObjectiveInput, Objective } from '@/domain/entities/objective'
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
  AccountExport,
  ProfileRepository,
  ProfileUpdate,
} from '@/domain/repositories/profile-repository'
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
import { isAuthBypass } from '@/infrastructure/config/env'
import type { NewPlanStageInput, PlanStage } from '@/domain/entities/plan-stage'
import type {
  PlanStageRepository,
  PlanStageReweight,
  PlanStageUpdate,
} from '@/domain/repositories/plan-stage-repository'
import { LEGAL_VERSIONS, type LegalAcceptance, type LegalDocument, type LegalVersions } from '@/domain/legal/legal-documents'
import { assertMediaAllowed, assertOwnsMediaPath, mediaPath, type MediaKind } from '@/domain/media/media-policy'
import type { LegalAcceptanceRepository } from '@/domain/repositories/legal-acceptance-repository'
import type { MediaRepository, StoredMedia } from '@/domain/repositories/media-repository'
import type { EvolutionRepository } from '@/domain/repositories/evolution-repository'
import type { EvolutionSnapshot } from '@/domain/entities/evolution'
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

  /*
    O modo demo não tem servidor de identidade, então ele não FINGE ter.

    Devolver um MFA de mentira aqui seria pior que não ter: a tela de
    segurança mostraria "verificação em duas etapas ativa" pra uma sessão que
    é um objeto no localStorage. Cada caminho de credencial abaixo diz, em
    voz alta, que aquilo só existe com Supabase configurado — e a sessão demo
    nunca se apresenta como administrativa.
  */
  async currentSession(): Promise<SessionInfo | null> {
    const user = await this.currentUser()
    if (!user) return null
    return { user, assurance: 'aal1', hasMfa: false, isAdmin: false, adminRole: null }
  }

  async signInWithGoogle(): Promise<void> {
    throw new DomainError('O login com Google precisa do Supabase configurado.')
  }

  async requestPasswordReset(): Promise<void> {
    // Resolve em silêncio, igual ao caminho real: nem aqui o app diz se o
    // e-mail existe.
  }

  async updatePassword(): Promise<void> {
    throw new DomainError('Trocar a senha precisa do Supabase configurado.')
  }

  async completePasswordReset(): Promise<void> {
    throw new DomainError('Recuperar a senha precisa do Supabase configurado.')
  }

  async listMfaFactors(): Promise<readonly MfaFactor[]> {
    return []
  }

  async startMfaEnrollment(): Promise<MfaEnrollment> {
    throw new DomainError('A verificação em duas etapas precisa do Supabase configurado.')
  }

  async confirmMfaEnrollment(): Promise<void> {
    throw new DomainError('A verificação em duas etapas precisa do Supabase configurado.')
  }

  async verifyMfa(): Promise<void> {
    throw new DomainError('A verificação em duas etapas precisa do Supabase configurado.')
  }

  async removeMfaFactor(): Promise<void> {
    throw new DomainError('A verificação em duas etapas precisa do Supabase configurado.')
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
  /*
    No modo demo "a conta" é o conteúdo do localStorage. Apagar aqui é apagar
    de verdade o que existe — a mesma promessa da tela, no alcance que este
    modo tem.
  */
  async deleteAccount(): Promise<void> {
    demoStore.clear()
  }

  async resetData(): Promise<void> {
    demoStore.clear()
  }

  async exportData(): Promise<AccountExport> {
    return { exported_at: new Date().toISOString(), format: 'momentumm.export.v1', ...demoStore.snapshot() }
  }

  async findById(): Promise<Profile | null> {
    return demoStore.profile()
  }

  async update(_id: string, changes: ProfileUpdate): Promise<Profile> {
    if (changes.name !== undefined) assertValidName(changes.name)
    if (changes.handle !== undefined) assertValidHandle(changes.handle)
    if (changes.bio !== undefined) assertValidBio(changes.bio)
    if (changes.restWeekdays !== undefined) assertValidRestWeekdays(changes.restWeekdays)
    const status = changes.status !== undefined ? normalizeStatus(changes.status) : undefined
    if (status !== undefined) assertValidStatus(status)
    if (changes.banner !== undefined) assertValidBanner(changes.banner)

    return demoStore.updateProfile({
      ...(changes.name !== undefined ? { name: changes.name.trim() } : {}),
      ...(changes.handle !== undefined ? { handle: changes.handle } : {}),
      ...(changes.bio !== undefined ? { bio: changes.bio?.trim() || null } : {}),
      ...(changes.avatarUrl !== undefined ? { avatarUrl: changes.avatarUrl } : {}),
      ...(changes.defaultVisibility !== undefined
        ? { defaultVisibility: changes.defaultVisibility }
        : {}),
      ...(changes.visibility !== undefined ? { visibility: changes.visibility } : {}),
      ...(changes.restWeekdays !== undefined
        ? { restWeekdays: normalizedRestWeekdays(changes.restWeekdays) }
        : {}),
      ...(changes.plan !== undefined ? { plan: changes.plan } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(changes.banner !== undefined ? { banner: changes.banner } : {}),
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

export class DemoEvolutionRepository implements EvolutionRepository {
  async load(): Promise<EvolutionSnapshot> {
    return demoStore.evolution()
  }
}

export class DemoJourneyEventRepository implements JourneyEventRepository {
  // Filtra por autor: desde que o modo demo ganhou amigos, a lista guarda os
  // momentos deles junto com os seus.
  async listByUser(userId: string): Promise<JourneyEvent[]> {
    return demoStore.journeyEvents().filter((event) => event.userId === userId)
  }

  async listCircleFeed(userId: string): Promise<CircleFeedItem[]> {
    const friends = new Set(friendIdsOf(demoStore.friendships(), userId))
    const events = demoStore
      .journeyEvents()
      .filter((event) => friends.has(event.userId) && event.visibility === 'amigos')

    return toFeedItems(events, userId)
  }

  async listByAuthor(userId: string, authorId: string): Promise<CircleFeedItem[]> {
    const friends = new Set(friendIdsOf(demoStore.friendships(), userId))
    if (!friends.has(authorId)) return []

    const events = demoStore
      .journeyEvents()
      .filter((event) => event.userId === authorId && event.visibility === 'amigos')

    return toFeedItems(events, userId)
  }

  async setVisibility(
    id: string,
    userId: string,
    visibility: JourneyVisibility,
  ): Promise<JourneyEvent> {
    return demoStore.setEventVisibility(id, userId, visibility)
  }

  async support(eventId: string, userId: string, supported: boolean): Promise<void> {
    demoStore.setSupport(eventId, userId, supported)
  }

  async record(input: NewJourneyEventInput): Promise<JourneyEvent> {
    return demoStore.recordJourneyEvent(input)
  }
}

/** Junta evento, autor e apoio — o mesmo formato que a consulta do Supabase devolve. */
function toFeedItems(events: readonly JourneyEvent[], userId: string): CircleFeedItem[] {
  const people = new Map(
    demoStore.people(events.map((event) => event.userId)).map((person) => [person.id, person]),
  )

  return events.flatMap((event) => {
    const author = people.get(event.userId)
    if (!author) return []

    const supports = demoStore.supportsOf(event.id)
    return [
      {
        event,
        author,
        supports: supports.length,
        supportedByMe: supports.includes(userId),
      },
    ]
  })
}

export class DemoFriendshipRepository implements FriendshipRepository {
  async listByUser(): Promise<Friendship[]> {
    return demoStore.friendships()
  }

  async listPeople(ids: readonly string[]): Promise<CircleAuthor[]> {
    return demoStore.people(ids)
  }

  async search(userId: string, term: string): Promise<CircleAuthor[]> {
    return demoStore.searchPeople(userId, term)
  }

  async request(input: NewFriendshipInput): Promise<Friendship> {
    return demoStore.addFriendship(input)
  }

  async respond(id: string, userId: string, accept: boolean): Promise<Friendship> {
    return demoStore.respondFriendship(id, userId, accept)
  }

  async remove(id: string, userId: string): Promise<void> {
    demoStore.removeFriendship(id, userId)
  }
}

/**
 * Desafios no modo demo.
 *
 * O filtro por participação acontece aqui porque não existe RLS pra fazê-lo:
 * contra o Supabase é a política que decide o que a pessoa enxerga, e o
 * repositório de lá não filtra nada. Os dois chegam ao mesmo resultado por
 * caminhos diferentes, e é assim que tem que ser — a regra de acesso mora no
 * banco quando existe banco.
 */
export class DemoChallengeRepository implements ChallengeRepository {
  async listByUser(userId: string): Promise<Challenge[]> {
    const mine = new Set(
      demoStore
        .challengeParticipants()
        .filter((item) => item.userId === userId)
        .map((item) => item.challengeId),
    )

    return demoStore
      .challenges()
      .filter((challenge) => challenge.ownerId === userId || mine.has(challenge.id))
  }

  async listParticipants(challengeIds: readonly string[]): Promise<ChallengeParticipant[]> {
    const ids = new Set(challengeIds)
    return demoStore.challengeParticipants().filter((item) => ids.has(item.challengeId))
  }

  async create(input: NewChallengeInput): Promise<{
    challenge: Challenge
    participant: ChallengeParticipant
  }> {
    return demoStore.addChallenge(input)
  }

  async update(id: string, _ownerId: string, changes: ChallengeUpdate): Promise<Challenge> {
    return demoStore.updateChallenge(id, {
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.description !== undefined ? { description: changes.description } : {}),
      ...(changes.completedAt !== undefined ? { completedAt: changes.completedAt } : {}),
      ...(changes.archivedAt !== undefined ? { archivedAt: changes.archivedAt } : {}),
    })
  }

  async invite(
    challengeId: string,
    _ownerId: string,
    userId: string,
  ): Promise<ChallengeParticipant> {
    return demoStore.inviteToChallenge(challengeId, userId)
  }

  async respond(
    participantId: string,
    userId: string,
    accept: boolean,
  ): Promise<ChallengeParticipant> {
    return demoStore.updateParticipant(participantId, userId, {
      status: accept ? 'ativo' : 'recusado',
    })
  }

  async leave(participantId: string, userId: string): Promise<void> {
    demoStore.updateParticipant(participantId, userId, { status: 'saiu' })
  }

  async setHabit(
    participantId: string,
    userId: string,
    habitId: string | null,
  ): Promise<ChallengeParticipant> {
    return demoStore.updateParticipant(participantId, userId, { habitId })
  }

  async publishProgress(
    participantId: string,
    userId: string,
    doneDays: number,
    completed: boolean,
  ): Promise<ChallengeParticipant> {
    return demoStore.updateParticipant(participantId, userId, {
      doneDays: Math.max(0, Math.round(doneDays)),
      completedAt: completed ? new Date() : null,
    })
  }
}

/**
 * Aceite legal no modo demo: fica no `localStorage`, ao lado do resto. O
 * fluxo da tela é o mesmo do Supabase, que é o que importa conferir aqui.
 */
export class DemoLegalAcceptanceRepository implements LegalAcceptanceRepository {
  private static readonly KEY = 'momentumm.demo.legal.v1'

  async listMine(): Promise<LegalAcceptance[]> {
    try {
      const raw = localStorage.getItem(DemoLegalAcceptanceRepository.KEY)
      const parsed = raw ? (JSON.parse(raw) as { document: LegalDocument; version: string; acceptedAt: string }[]) : []
      return parsed.map((item) => ({ ...item, acceptedAt: new Date(item.acceptedAt) }))
    } catch {
      return []
    }
  }

  async accept(_userId: string, documents: readonly LegalDocument[], versions: LegalVersions = LEGAL_VERSIONS): Promise<void> {
    const current = await this.listMine()
    const next = [
      ...current,
      ...documents
        .filter((document) => !current.some((item) => item.document === document && item.version === versions[document]))
        .map((document) => ({ document, version: versions[document], acceptedAt: new Date() })),
    ]
    localStorage.setItem(DemoLegalAcceptanceRepository.KEY, JSON.stringify(next))
  }
}

/**
 * Mídia no modo demo: o arquivo vira uma URL de objeto na memória da aba.
 * Some ao recarregar, e é isso mesmo: modo demo não guarda arquivo de ninguém.
 */
export class DemoMediaRepository implements MediaRepository {
  private readonly files = new Map<string, { blob: Blob; media: StoredMedia }>()

  async upload(userId: string, kind: MediaKind, file: Blob): Promise<StoredMedia> {
    assertMediaAllowed({ kind, mimeType: file.type, size: file.size })
    const path = mediaPath(userId, kind, file.type, crypto.randomUUID())
    const media = { path, kind, mimeType: file.type, size: file.size }
    this.files.set(path, { blob: file, media })
    return media
  }

  async signedUrl(userId: string, path: string): Promise<string> {
    assertOwnsMediaPath(userId, path)
    const entry = this.files.get(path)
    if (!entry) throw new DomainError('Esse arquivo não existe mais.')
    return URL.createObjectURL(entry.blob)
  }

  async remove(userId: string, path: string): Promise<void> {
    assertOwnsMediaPath(userId, path)
    this.files.delete(path)
  }

  async list(userId: string, kind: MediaKind): Promise<StoredMedia[]> {
    return [...this.files.values()]
      .map((entry) => entry.media)
      .filter((media) => media.kind === kind && media.path.startsWith(`${userId}/`))
  }
}
