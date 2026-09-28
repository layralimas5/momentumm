import type { DayKey } from '@/domain/entities/day'
import type { CalendarEntry } from '@/domain/entities/calendar-day'
import type { NewPostInput, Post, PostVisibility } from '@/domain/entities/post'
import type { PostComment } from '@/domain/entities/post-comment'
import type { NewStoryInput, Story, StoryRing } from '@/domain/entities/story'
import type {
  FollowListKind,
  FollowRequest,
  FollowState,
  NewReportInput,
  ProfileCard,
  SocialCounts,
} from '@/domain/entities/social-graph'

/** Uma página de publicações mais o cursor da próxima. */
export interface PostPage {
  readonly posts: readonly Post[]
  /**
   * O `createdAt` da última publicação da página. `null` quando acabou.
   *
   * Cursor, e não número de página: com "página 3" uma publicação nova no topo
   * empurra tudo e a terceira página repete a segunda. O cursor anda pelo
   * tempo, que não muda de lugar.
   */
  readonly cursor: Date | null
}

/** O que sobe junto com a foto. Medidas reais, pro feed reservar o espaço. */
export interface PostPhotoUpload {
  readonly blob: Blob
  readonly width: number
  readonly height: number
}

/**
 * A camada social, num contrato só.
 *
 * Publicação, story e laço moram juntos porque quase toda tela usa mais de um:
 * o feed lê publicação e story, o perfil lê publicação, laço e calendário.
 * Separar em três interfaces daria três injeções e nenhuma fronteira nova,
 * as três falam com as mesmas tabelas e com a mesma regra de visibilidade.
 *
 * Nada aqui devolve "todas" as publicações: toda leitura de lista é paginada,
 * desde o primeiro dia.
 */
export interface SocialRepository {
  // ---- publicação ---------------------------------------------------------

  /** O feed: quem eu sigo, mais eu, do mais recente. */
  feed(cursor: Date | null, limit?: number): Promise<PostPage>
  postsOf(userId: string, cursor: Date | null, limit?: number): Promise<PostPage>
  postsOfDay(userId: string, day: DayKey): Promise<readonly Post[]>
  post(postId: string): Promise<Post | null>

  /**
   * Publica. As fotos sobem primeiro; a linha da publicação nasce depois.
   *
   * A ordem é essa porque publicação sem foto é um card quebrado no feed de
   * todo mundo, e foto sem publicação é um arquivo órfão que ninguém vê.
   */
  publish(input: NewPostInput, photos: readonly PostPhotoUpload[]): Promise<Post>
  editCaption(postId: string, caption: string | null): Promise<void>
  setPostVisibility(postId: string, visibility: PostVisibility): Promise<void>
  removePost(postId: string): Promise<void>

  // ---- interações ---------------------------------------------------------

  like(postId: string): Promise<void>
  unlike(postId: string): Promise<void>
  save(postId: string): Promise<void>
  unsave(postId: string): Promise<void>
  savedPosts(cursor: Date | null, limit?: number): Promise<PostPage>

  comments(postId: string, after: Date | null, limit?: number): Promise<readonly PostComment[]>
  comment(postId: string, body: string): Promise<PostComment>
  removeComment(commentId: string): Promise<void>

  // ---- laços --------------------------------------------------------------

  counts(userId: string): Promise<SocialCounts>
  followState(userId: string): Promise<FollowState>
  follow(userId: string): Promise<FollowState>
  unfollow(userId: string): Promise<void>
  /** Aceitar um pedido. Recusar é `removeFollower`, que é o mesmo delete. */
  acceptFollower(followerId: string): Promise<void>
  removeFollower(followerId: string): Promise<void>
  followRequests(): Promise<readonly FollowRequest[]>
  followList(userId: string, kind: FollowListKind, offset: number): Promise<readonly ProfileCard[]>
  /** Perfis públicos de verdade que a pessoa ainda não segue. Nunca inventados. */
  suggestions(limit?: number): Promise<readonly ProfileCard[]>

  // ---- segurança ----------------------------------------------------------

  block(userId: string): Promise<void>
  unblock(userId: string): Promise<void>
  blockedList(): Promise<readonly ProfileCard[]>
  report(input: NewReportInput): Promise<void>

  // ---- calendário ---------------------------------------------------------

  calendar(userId: string, from: DayKey, to: DayKey): Promise<readonly CalendarEntry[]>

  // ---- stories ------------------------------------------------------------

  storyTray(): Promise<readonly StoryRing[]>
  storiesOf(userId: string): Promise<readonly Story[]>
  publishStory(input: NewStoryInput, file: Blob): Promise<Story>
  markStorySeen(storyId: string): Promise<void>
  removeStory(storyId: string): Promise<void>

  // ---- mídia --------------------------------------------------------------

  /**
   * Link temporário pra abrir um arquivo do bucket social.
   *
   * Recebe o CAMINHO que veio na linha, nunca uma URL montada na tela: quem
   * decide se aquele arquivo pode ser lido é o servidor, e o caminho é a
   * pergunta que ele responde.
   */
  mediaUrl(path: string): Promise<string>
}
