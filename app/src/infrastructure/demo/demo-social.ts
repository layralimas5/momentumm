import type { CalendarEntry } from '@/domain/entities/calendar-day'
import type { DayKey } from '@/domain/entities/day'
import {
  assertPhotoCount,
  assertValidPost,
  type NewPostInput,
  type Post,
  type PostVisibility,
} from '@/domain/entities/post'
import { assertValidComment, type PostComment } from '@/domain/entities/post-comment'
import {
  assertValidStoryCaption,
  STORY_HOURS,
  type NewStoryInput,
  type Story,
  type StoryRing,
} from '@/domain/entities/story'
import {
  assertCanBlock,
  assertValidReport,
  NO_FOLLOW_STATE,
  type FollowListKind,
  type FollowRequest,
  type FollowState,
  type NewReportInput,
  type ProfileCard,
  type SocialCounts,
} from '@/domain/entities/social-graph'
import { assertCanFollow } from '@/domain/entities/follow'
import type {
  PostPage,
  PostPhotoUpload,
  SocialRepository,
} from '@/domain/repositories/social-repository'
import { DomainError } from '@/shared/errors'
import { DEMO_PEOPLE, DEMO_USER, demoStore } from './demo-store'

/**
 * A camada social no modo demo.
 *
 * ## Por que ela tem o próprio armazenamento
 *
 * `demo-store` guarda o estado inteiro do produto sob uma chave versionada, e
 * subir essa versão apaga o que quem estiver experimentando já criou. A camada
 * social é aditiva e nova: ela merece a chave dela, e assim o dia em que o
 * formato dela mudar não custa a rotina de ninguém.
 *
 * ## O que ela NÃO faz
 *
 * Não existe publicação de fábrica, curtida de fábrica nem comentário de
 * fábrica. O feed do demo mostra o que a própria pessoa publicou, e nada mais.
 * Encher a tela com três posts inventados faria o produto parecer vivo por
 * quinze segundos e mentir no décimo sexto, quando alguém tocasse no perfil de
 * um autor que não existe.
 *
 * As pessoas de `DEMO_PEOPLE` continuam existindo (elas são o que torna o
 * Círculo conferível sem uma segunda conta) e dá pra segui-las, o que deixa os
 * estados de "Seguindo" e as listas de laços visíveis. Elas só não produzem
 * conteúdo.
 *
 * ## Os laços vêm do `demo-store`, não daqui
 *
 * `follows` já mora lá desde a 0060, com as linhas de fábrica que fazem o
 * perfil da demo abrir com números assimétricos em vez de três zeros. Guardar
 * uma segunda lista de "quem eu sigo" aqui criaria dois estados discordando na
 * primeira vez que alguém seguisse por uma tela e conferisse pela outra.
 *
 * ## O arquivo
 *
 * Sem bucket, a imagem vira data URL e mora na própria linha. É a mesma
 * decisão que `DemoDayPhotoRepository` já tinha tomado, e ela é invisível pra
 * quem chama: `mediaUrl` devolve o data URL de volta.
 */

const KEY = 'momentumm.social.demo.v1'

interface DemoMedia {
  path: string
  width: number | null
  height: number | null
}

interface DemoPost {
  id: string
  caption: string | null
  day: DayKey
  visibility: PostVisibility
  objectiveId: string | null
  progressDone: number | null
  progressGoal: number | null
  progressUnit: string | null
  media: DemoMedia[]
  createdAt: string
  editedAt: string | null
}

interface DemoComment {
  id: string
  postId: string
  body: string
  createdAt: string
}

interface DemoStory {
  id: string
  path: string
  kind: 'imagem' | 'video'
  caption: string | null
  createdAt: string
  expiresAt: string
}

interface DemoSocialState {
  posts: DemoPost[]
  likes: string[]
  saved: string[]
  comments: DemoComment[]
  stories: DemoStory[]
  seenStories: string[]
  blocked: string[]
  reports: string[]
}

const EMPTY: DemoSocialState = {
  posts: [],
  likes: [],
  saved: [],
  comments: [],
  stories: [],
  seenStories: [],
  blocked: [],
  reports: [],
}

let state: DemoSocialState = load()

function load(): DemoSocialState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<DemoSocialState>
    return { ...EMPTY, ...parsed }
  } catch {
    return { ...EMPTY }
  }
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Sem persistência o app continua funcionando na sessão atual.
  }
}

export class DemoSocialRepository implements SocialRepository {
  // -------------------------------------------------------------- publicação

  async feed(cursor: Date | null, limit = 10): Promise<PostPage> {
    return this.page(this.visiblePosts(), cursor, limit)
  }

  async postsOf(userId: string, cursor: Date | null, limit = 12): Promise<PostPage> {
    if (userId !== DEMO_USER.id) return { posts: [], cursor: null }
    return this.page(this.visiblePosts(), cursor, limit)
  }

  async postsOfDay(userId: string, day: DayKey): Promise<readonly Post[]> {
    if (userId !== DEMO_USER.id) return []
    return this.visiblePosts()
      .filter((post) => post.day === day)
      .map((post) => this.toPost(post))
  }

  async post(postId: string): Promise<Post | null> {
    const found = state.posts.find((post) => post.id === postId)
    return found ? this.toPost(found) : null
  }

  async publish(input: NewPostInput, photos: readonly PostPhotoUpload[]): Promise<Post> {
    assertValidPost(input)
    assertPhotoCount(photos.length)

    /*
      As MEDIDAS sobem junto, como no Supabase: sem elas o feed não reserva o
      espaço da imagem e cada foto que carrega empurra a lista pra baixo. Era o
      que acontecia aqui, e só aqui — o demo mostrava um salto que a produção
      não tem, o que é a pior espécie de diferença entre os dois mundos.
    */
    const media = await Promise.all(
      photos.map(async (photo) => ({
        path: await toDataUrl(photo.blob),
        width: photo.width,
        height: photo.height,
      })),
    )
    const row: DemoPost = {
      id: crypto.randomUUID(),
      caption: input.caption,
      day: input.day,
      visibility: input.visibility,
      objectiveId: input.objectiveId,
      progressDone: input.progress?.done ?? null,
      progressGoal: input.progress?.goal ?? null,
      progressUnit: input.progress?.unit ?? null,
      media,
      createdAt: new Date().toISOString(),
      editedAt: null,
    }

    state.posts = [row, ...state.posts]
    persist()
    return this.toPost(row)
  }

  async editCaption(postId: string, caption: string | null): Promise<void> {
    const post = state.posts.find((item) => item.id === postId)
    if (!post) return
    post.caption = caption
    post.editedAt = new Date().toISOString()
    persist()
  }

  async setPostVisibility(postId: string, visibility: PostVisibility): Promise<void> {
    const post = state.posts.find((item) => item.id === postId)
    if (!post) return
    post.visibility = visibility
    persist()
  }

  async removePost(postId: string): Promise<void> {
    state.posts = state.posts.filter((post) => post.id !== postId)
    state.comments = state.comments.filter((comment) => comment.postId !== postId)
    state.likes = state.likes.filter((id) => id !== postId)
    state.saved = state.saved.filter((id) => id !== postId)
    persist()
  }

  // -------------------------------------------------------------- interações

  async like(postId: string): Promise<void> {
    if (!state.likes.includes(postId)) state.likes.push(postId)
    persist()
  }

  async unlike(postId: string): Promise<void> {
    state.likes = state.likes.filter((id) => id !== postId)
    persist()
  }

  async save(postId: string): Promise<void> {
    if (!state.saved.includes(postId)) state.saved.push(postId)
    persist()
  }

  async unsave(postId: string): Promise<void> {
    state.saved = state.saved.filter((id) => id !== postId)
    persist()
  }

  async savedPosts(cursor: Date | null, limit = 12): Promise<PostPage> {
    const list = state.posts.filter((post) => state.saved.includes(post.id))
    return this.page(list, cursor, limit)
  }

  async comments(postId: string): Promise<readonly PostComment[]> {
    const me = demoStore.profile()
    return state.comments
      .filter((comment) => comment.postId === postId)
      .map((comment) => ({
        id: comment.id,
        postId,
        author: {
          id: me.id,
          name: me.name,
          handle: me.handle,
          avatarUrl: me.avatarUrl,
        },
        body: comment.body,
        createdAt: new Date(comment.createdAt),
        mine: true,
        canDelete: true,
      }))
  }

  async comment(postId: string, body: string): Promise<PostComment> {
    assertValidComment(body)
    const row: DemoComment = {
      id: crypto.randomUUID(),
      postId,
      body: body.trim(),
      createdAt: new Date().toISOString(),
    }
    state.comments.push(row)
    persist()

    const me = demoStore.profile()
    return {
      id: row.id,
      postId,
      author: { id: me.id, name: me.name, handle: me.handle, avatarUrl: me.avatarUrl },
      body: row.body,
      createdAt: new Date(row.createdAt),
      mine: true,
      canDelete: true,
    }
  }

  async removeComment(commentId: string): Promise<void> {
    state.comments = state.comments.filter((comment) => comment.id !== commentId)
    persist()
  }

  // ------------------------------------------------------------------- laços

  async counts(userId: string): Promise<SocialCounts> {
    const lines = demoStore.followCounts(userId)
    return {
      followers: lines.followers,
      following: lines.following,
      posts: userId === DEMO_USER.id ? this.visiblePosts().length : 0,
    }
  }

  async followState(userId: string): Promise<FollowState> {
    return {
      ...NO_FOLLOW_STATE,
      following: demoStore.isFollowing(DEMO_USER.id, userId),
      followsMe: demoStore.isFollowing(userId, DEMO_USER.id),
      blocked: state.blocked.includes(userId),
    }
  }

  async follow(userId: string): Promise<FollowState> {
    assertCanFollow(DEMO_USER.id, userId)
    demoStore.addFollow({ followerId: DEMO_USER.id, followingId: userId })
    return this.followState(userId)
  }

  async unfollow(userId: string): Promise<void> {
    demoStore.removeFollow(DEMO_USER.id, userId)
  }

  /** Não existe outra conta pra pedir, então não existe pedido pra aceitar. */
  async acceptFollower(): Promise<void> {}
  async removeFollower(): Promise<void> {}
  async followRequests(): Promise<readonly FollowRequest[]> {
    return []
  }

  async followList(userId: string, kind: FollowListKind): Promise<readonly ProfileCard[]> {
    return DEMO_PEOPLE.filter((person) =>
      kind === 'seguidores'
        ? demoStore.isFollowing(person.id, userId)
        : demoStore.isFollowing(userId, person.id),
    ).map(toCard)
  }

  async suggestions(limit = 8): Promise<readonly ProfileCard[]> {
    return DEMO_PEOPLE.filter(
      (person) =>
        !demoStore.isFollowing(DEMO_USER.id, person.id) && !state.blocked.includes(person.id),
    )
      .slice(0, limit)
      .map(toCard)
  }

  // --------------------------------------------------------------- segurança

  async block(userId: string): Promise<void> {
    assertCanBlock(DEMO_USER.id, userId)
    if (!state.blocked.includes(userId)) state.blocked.push(userId)
    persist()
    // O mesmo efeito do trigger da 0067: bloquear desfaz o laço nos dois lados.
    demoStore.removeFollow(DEMO_USER.id, userId)
    demoStore.removeFollow(userId, DEMO_USER.id)
  }

  async unblock(userId: string): Promise<void> {
    state.blocked = state.blocked.filter((id) => id !== userId)
    persist()
  }

  async blockedList(): Promise<readonly ProfileCard[]> {
    return DEMO_PEOPLE.filter((person) => state.blocked.includes(person.id)).map(toCard)
  }

  async report(input: NewReportInput): Promise<void> {
    assertValidReport(input)
    const key = `${input.targetKind}::${input.targetId}`
    if (!state.reports.includes(key)) state.reports.push(key)
    persist()
  }

  // -------------------------------------------------------------- calendário

  async calendar(userId: string, from: DayKey, to: DayKey): Promise<readonly CalendarEntry[]> {
    if (userId !== DEMO_USER.id) return []

    const byDay = new Map<DayKey, CalendarEntry>()

    /*
      A capa é a publicação mais recente QUE TEM foto, e a contagem conta
      todas. É a regra da 0069, repetida aqui: divergir do servidor faria o
      calendário do demo contar uma história que a produção não conta.
    */
    for (const post of this.visiblePosts()) {
      if (post.day < from || post.day > to) continue

      const current = byDay.get(post.day)
      const cover = post.media[0]?.path ?? null

      if (!current) {
        byDay.set(post.day, {
          day: post.day,
          postId: post.id,
          coverPath: cover,
          total: 1,
          fromAlbum: false,
        })
        continue
      }

      /* A lista vem do mais novo pro mais velho: a primeira COM foto fica. */
      byDay.set(post.day, {
        ...current,
        total: current.total + 1,
        postId: current.coverPath ? current.postId : (cover ? post.id : current.postId),
        coverPath: current.coverPath ?? cover,
      })
    }

    // O álbum manual entra sempre que o dia não tem foto publicada.
    for (const photo of demoStore.dayPhotos(from, to)) {
      const current = byDay.get(photo.day)
      if (!current) {
        byDay.set(photo.day, {
          day: photo.day,
          postId: null,
          coverPath: photo.path,
          total: 0,
          fromAlbum: true,
        })
        continue
      }
      if (current.coverPath) continue
      byDay.set(photo.day, { ...current, coverPath: photo.path, fromAlbum: true })
    }

    return [...byDay.values()]
  }

  // ----------------------------------------------------------------- stories

  async storyTray(): Promise<readonly StoryRing[]> {
    const live = this.liveStories()
    if (live.length === 0) return []

    const me = demoStore.profile()
    return [
      {
        userId: me.id,
        name: me.name,
        handle: me.handle,
        avatarUrl: me.avatarUrl,
        total: live.length,
        unseen: live.filter((story) => !state.seenStories.includes(story.id)).length,
        latest: new Date(live[live.length - 1]?.createdAt ?? Date.now()),
      },
    ]
  }

  async storiesOf(userId: string): Promise<readonly Story[]> {
    if (userId !== DEMO_USER.id) return []
    return this.liveStories().map((story) => ({
      id: story.id,
      userId: DEMO_USER.id,
      path: story.path,
      kind: story.kind,
      caption: story.caption,
      width: null,
      height: null,
      createdAt: new Date(story.createdAt),
      expiresAt: new Date(story.expiresAt),
      seen: state.seenStories.includes(story.id),
      views: 0,
    }))
  }

  async publishStory(input: NewStoryInput, file: Blob): Promise<Story> {
    assertValidStoryCaption(input.caption)
    const now = new Date()
    const expires = new Date(now.getTime() + STORY_HOURS * 3_600_000)

    const row: DemoStory = {
      id: crypto.randomUUID(),
      path: await toDataUrl(file),
      kind: input.kind,
      caption: input.caption,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    }
    state.stories.push(row)
    persist()

    return {
      id: row.id,
      userId: DEMO_USER.id,
      path: row.path,
      kind: row.kind,
      caption: row.caption,
      width: input.width,
      height: input.height,
      createdAt: now,
      expiresAt: expires,
      seen: true,
      views: 0,
    }
  }

  async markStorySeen(storyId: string): Promise<void> {
    if (!state.seenStories.includes(storyId)) state.seenStories.push(storyId)
    persist()
  }

  async removeStory(storyId: string): Promise<void> {
    state.stories = state.stories.filter((story) => story.id !== storyId)
    persist()
  }

  // ------------------------------------------------------------------- mídia

  /** No demo o "caminho" já É a imagem. Devolver ela de volta é o contrato. */
  async mediaUrl(path: string): Promise<string> {
    return path
  }

  // ---------------------------------------------------------------- privados

  /** Publicação privada continua visível pra quem publicou, que é a única conta. */
  private visiblePosts(): DemoPost[] {
    return [...state.posts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  private liveStories(): DemoStory[] {
    const now = Date.now()
    return state.stories
      .filter((story) => new Date(story.expiresAt).getTime() > now)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  }

  private page(list: readonly DemoPost[], cursor: Date | null, limit: number): PostPage {
    const filtered = cursor
      ? list.filter((post) => new Date(post.createdAt).getTime() < cursor.getTime())
      : list
    const slice = filtered.slice(0, limit)
    const last = slice[slice.length - 1]
    return {
      posts: slice.map((post) => this.toPost(post)),
      cursor: slice.length < limit || !last ? null : new Date(last.createdAt),
    }
  }

  private toPost(row: DemoPost): Post {
    const me = demoStore.profile()
    const objective = row.objectiveId
      ? demoStore.objectives().find((item) => item.id === row.objectiveId)
      : undefined

    return {
      id: row.id,
      author: { id: me.id, name: me.name, handle: me.handle, avatarUrl: me.avatarUrl },
      caption: row.caption,
      day: row.day,
      visibility: row.visibility,
      objectiveId: row.objectiveId,
      objectiveTitle: objective?.title ?? null,
      progress:
        row.progressDone !== null && row.progressGoal !== null
          ? { done: row.progressDone, goal: row.progressGoal, unit: row.progressUnit }
          : null,
      media: row.media.map((item, index) => ({
        id: `${row.id}-${index}`,
        path: item.path,
        position: index,
        width: item.width,
        height: item.height,
      })),
      likeCount: state.likes.includes(row.id) ? 1 : 0,
      commentCount: state.comments.filter((comment) => comment.postId === row.id).length,
      liked: state.likes.includes(row.id),
      saved: state.saved.includes(row.id),
      createdAt: new Date(row.createdAt),
      editedAt: row.editedAt ? new Date(row.editedAt) : null,
    }
  }
}

function toCard(person: { id: string; name: string; handle: string; avatarUrl: string | null }): ProfileCard {
  return { id: person.id, name: person.name, handle: person.handle, avatarUrl: person.avatarUrl }
}

async function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () =>
      reject(new DomainError('Não consegui ler essa imagem. Tenta outra.')),
    )
    reader.readAsDataURL(blob)
  })
}
