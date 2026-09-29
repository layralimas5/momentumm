import type { PostgrestError } from '@supabase/supabase-js'
import type { CalendarEntry } from '@/domain/entities/calendar-day'
import type { DayKey } from '@/domain/entities/day'
import {
  assertPhotoCount,
  assertValidPost,
  MAX_POST_PHOTOS,
  type NewPostInput,
  type Post,
  type PostMedia,
  type PostVisibility,
} from '@/domain/entities/post'
import { assertValidComment, type PostComment } from '@/domain/entities/post-comment'
import {
  assertValidStoryCaption,
  type NewStoryInput,
  type Story,
  type StoryRing,
} from '@/domain/entities/story'
import {
  assertCanBlock,
  assertValidReport,
  EMPTY_SOCIAL_COUNTS,
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
import { DomainError, InfrastructureError } from '@/shared/errors'
import { supabase } from './client'

const BUCKET = 'social-media'
/** Curto: é pra abrir agora, não pra guardar num histórico de navegação. */
const SIGNED_SECONDS = 10 * 60
const UNIQUE_VIOLATION = '23505'
const FUNCTION_MISSING = '42883'

/**
 * A camada social contra o Supabase (migrations 0067 e 0068).
 *
 * ## Quase tudo passa por função, e o motivo não é performance
 *
 * Um card de publicação precisa do post, do autor, das fotos, do objetivo e de
 * dois booleanos do próprio leitor. Pelo PostgREST isso são cinco requisições
 * — e a quinta, "eu curti?", não tem como ser pedida em lote sem baixar a
 * lista de curtidas de todo mundo. A função devolve o card inteiro, uma vez.
 *
 * As ESCRITAS continuam em tabela, pelo PostgREST: elas passam pelas políticas
 * da 0067 uma a uma, e é isso que faz cada `insert` ser recusado pela regra
 * certa em vez de por um `if` dentro de uma função que ninguém relê.
 *
 * ## A sessão nunca vem por parâmetro
 *
 * Nenhum método recebe "quem sou eu". Quem responde isso é `auth.uid()` no
 * servidor. Aceitar um id de quem chama seria aceitar que a tela diga quem
 * ela é, e é assim que se escreve a primeira falha de autorização.
 */
export class SupabaseSocialRepository implements SocialRepository {
  // -------------------------------------------------------------- publicação

  async feed(cursor: Date | null, limit = 10): Promise<PostPage> {
    const { data, error } = await supabase().rpc('feed_page', {
      p_before: cursor?.toISOString() ?? null,
      p_limit: limit,
    })
    if (error) fail(error, 'carregar o feed')
    return toPage(data, limit)
  }

  async postsOf(userId: string, cursor: Date | null, limit = 12): Promise<PostPage> {
    const { data, error } = await supabase().rpc('profile_posts_page', {
      p_user: userId,
      p_before: cursor?.toISOString() ?? null,
      p_limit: limit,
    })
    if (error) fail(error, 'carregar as publicações')
    return toPage(data, limit)
  }

  async postsOfDay(userId: string, day: DayKey): Promise<readonly Post[]> {
    const { data, error } = await supabase().rpc('posts_of_day', { p_user: userId, p_day: day })
    if (error) fail(error, 'carregar o dia')
    return rows(data).map(toPost)
  }

  async post(postId: string): Promise<Post | null> {
    const { data, error } = await supabase().rpc('post_card', { p_id: postId })
    if (error) fail(error, 'carregar a publicação')
    const first = rows(data)[0]
    return first ? toPost(first) : null
  }

  /**
   * Publicar, em três passos e nesta ordem: arquivos, linha, fotos.
   *
   * Se o upload falhar, nada foi criado. Se a linha falhar, os arquivos ficam
   * órfãos no bucket por um momento e a limpeza os pega — arquivo órfão custa
   * bytes; publicação sem foto custa um card quebrado no feed de todo mundo.
   *
   * O inverso (linha primeiro) seria pior justamente por isso, e o "tudo numa
   * transação" não existe: o Storage não participa da transação do Postgres.
   */
  async publish(input: NewPostInput, photos: readonly PostPhotoUpload[]): Promise<Post> {
    assertValidPost(input)
    assertPhotoCount(photos.length)

    const uploaded: string[] = []
    try {
      for (const photo of photos.slice(0, MAX_POST_PHOTOS)) {
        uploaded.push(await this.upload(input.userId, 'posts', photo.blob))
      }

      const { data, error } = await supabase()
        .from('posts')
        .insert({
          user_id: input.userId,
          caption: input.caption,
          day: input.day,
          visibility: input.visibility,
          objective_id: input.objectiveId,
          progress_done: input.progress?.done ?? null,
          progress_goal: input.progress?.goal ?? null,
          progress_unit: input.progress?.unit ?? null,
        })
        .select('id')
        .single()

      if (error) fail(error, 'publicar')
      const postId = String((data as { id: string }).id)

      const { error: mediaError } = await supabase()
        .from('post_media')
        .insert(
          uploaded.map((path, index) => ({
            post_id: postId,
            user_id: input.userId,
            path,
            position: index,
            width: photos[index]?.width ?? null,
            height: photos[index]?.height ?? null,
          })),
        )

      if (mediaError) {
        // Publicação sem foto é um card vazio. Desfaz a linha e devolve o erro.
        await supabase().from('posts').delete().eq('id', postId)
        fail(mediaError, 'anexar as fotos')
      }

      const saved = await this.post(postId)
      if (!saved) throw new InfrastructureError('Publiquei, mas não consegui reler a publicação.')
      return saved
    } catch (cause) {
      await this.discard(uploaded)
      throw cause
    }
  }

  async editCaption(postId: string, caption: string | null): Promise<void> {
    const { error } = await supabase()
      .from('posts')
      .update({ caption, edited_at: new Date().toISOString() })
      .eq('id', postId)
    if (error) fail(error, 'editar a legenda')
  }

  async setPostVisibility(postId: string, visibility: PostVisibility): Promise<void> {
    const { error } = await supabase().from('posts').update({ visibility }).eq('id', postId)
    if (error) fail(error, 'mudar quem vê')
  }

  /**
   * Apagar leva os arquivos junto.
   *
   * A linha cai pela cascata e o bucket não participa dela: sem esta limpeza,
   * cada publicação apagada deixaria a foto no disco pra sempre, ilegível (a
   * política lê pela linha que acabou de sumir) e invisível — ou seja, custo
   * sem nenhum uso possível.
   */
  async removePost(postId: string): Promise<void> {
    const { data } = await supabase().from('post_media').select('path').eq('post_id', postId)
    const paths = (data ?? []).map((row) => String((row as { path: string }).path))

    const { error } = await supabase().from('posts').delete().eq('id', postId)
    if (error) fail(error, 'apagar a publicação')

    await this.discard(paths)
  }

  // -------------------------------------------------------------- interações

  async like(postId: string): Promise<void> {
    const userId = await this.me()
    const { error } = await supabase()
      .from('post_likes')
      .upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' })
    // Curtir de novo é a mesma linha, não um erro pra tela resolver.
    if (error && error.code !== UNIQUE_VIOLATION) fail(error, 'curtir')
  }

  async unlike(postId: string): Promise<void> {
    const userId = await this.me()
    const { error } = await supabase()
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) fail(error, 'descurtir')
  }

  async save(postId: string): Promise<void> {
    const userId = await this.me()
    const { error } = await supabase()
      .from('saved_posts')
      .upsert({ post_id: postId, user_id: userId }, { onConflict: 'user_id,post_id' })
    if (error && error.code !== UNIQUE_VIOLATION) fail(error, 'salvar')
  }

  async unsave(postId: string): Promise<void> {
    const userId = await this.me()
    const { error } = await supabase()
      .from('saved_posts')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) fail(error, 'tirar dos salvos')
  }

  /**
   * Os salvos são lidos em dois passos de propósito: a lista de ids vem da
   * tabela (que é de dono puro) e os cards vêm da mesma função que o feed usa.
   * Uma função `saved_page` seria uma terceira montagem do mesmo card.
   */
  async savedPosts(cursor: Date | null, limit = 12): Promise<PostPage> {
    const userId = await this.me()
    let query = supabase()
      .from('saved_posts')
      .select('post_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (cursor) query = query.lt('created_at', cursor.toISOString())

    const { data, error } = await query
    if (error) fail(error, 'carregar os salvos')

    const ids = (data ?? []).map((row) => String((row as { post_id: string }).post_id))
    if (ids.length === 0) return { posts: [], cursor: null }

    const { data: cards, error: cardsError } = await supabase().rpc('post_cards', { p_ids: ids })
    if (cardsError) fail(cardsError, 'carregar os salvos')

    const last = data?.[data.length - 1] as { created_at: string } | undefined
    return {
      posts: rows(cards).map(toPost),
      cursor: ids.length < limit || !last ? null : new Date(last.created_at),
    }
  }

  async comments(postId: string, after: Date | null, limit = 20): Promise<readonly PostComment[]> {
    const { data, error } = await supabase().rpc('post_comments_page', {
      p_post: postId,
      p_after: after?.toISOString() ?? null,
      p_limit: limit,
    })
    if (error) fail(error, 'carregar os comentários')
    return rows(data).map(toComment(postId))
  }

  async comment(postId: string, body: string): Promise<PostComment> {
    assertValidComment(body)
    const userId = await this.me()

    const { data, error } = await supabase()
      .from('post_comments')
      .insert({ post_id: postId, user_id: userId, body: body.trim() })
      .select('id, created_at')
      .single()

    if (error) fail(error, 'comentar')

    /*
      O autor vem da sessão, e não de uma segunda ida ao servidor: quem
      escreveu foi quem está logado, e o perfil dela já está na tela. Buscar de
      novo só pra preencher nome e foto adiaria o comentário aparecer.
    */
    const row = data as { id: string; created_at: string }
    const profile = await this.myCard(userId)

    return {
      id: String(row.id),
      postId,
      author: profile,
      body: body.trim(),
      createdAt: new Date(row.created_at),
      mine: true,
      canDelete: true,
    }
  }

  async removeComment(commentId: string): Promise<void> {
    const { error } = await supabase().from('post_comments').delete().eq('id', commentId)
    if (error) fail(error, 'apagar o comentário')
  }

  // ------------------------------------------------------------------- laços

  async counts(userId: string): Promise<SocialCounts> {
    const { data, error } = await supabase().rpc('profile_stats', { p_user: userId })
    if (error) fail(error, 'carregar os números do perfil')
    const row = rows(data)[0] as { followers: number; following: number; posts: number } | undefined
    return row
      ? {
          followers: Number(row.followers ?? 0),
          following: Number(row.following ?? 0),
          posts: Number(row.posts ?? 0),
        }
      : EMPTY_SOCIAL_COUNTS
  }

  async followState(userId: string): Promise<FollowState> {
    const { data, error } = await supabase().rpc('follow_state', { p_user: userId })
    if (error) fail(error, 'conferir se você segue')
    const row = rows(data)[0] as Record<string, boolean> | undefined
    return row
      ? {
          following: row['following'] === true,
          requested: row['requested'] === true,
          followsMe: row['follows_me'] === true,
          blocked: row['blocked'] === true,
        }
      : NO_FOLLOW_STATE
  }

  /**
   * Seguir, e a tela precisa saber COMO ficou.
   *
   * Perfil aberto vira "Seguindo" na hora; perfil fechado vira "Solicitado". A
   * diferença é decidida por um trigger no servidor, então a única resposta
   * honesta é reler o estado — adivinhar aqui, pela visibilidade que a tela
   * tem em mãos, daria "Seguindo" num perfil que acabou de fechar.
   */
  async follow(userId: string): Promise<FollowState> {
    const me = await this.me()
    assertCanFollow(me, userId)

    const { error } = await supabase()
      .from('follows')
      .upsert(
        { follower_id: me, following_id: userId },
        { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
      )
    if (error && error.code !== UNIQUE_VIOLATION) fail(error, 'seguir')

    return this.followState(userId)
  }

  async unfollow(userId: string): Promise<void> {
    const me = await this.me()
    const { error } = await supabase()
      .from('follows')
      .delete()
      .eq('follower_id', me)
      .eq('following_id', userId)
    if (error) fail(error, 'deixar de seguir')
  }

  async acceptFollower(followerId: string): Promise<void> {
    const me = await this.me()
    const { error } = await supabase()
      .from('follows')
      .update({ status: 'aceito' })
      .eq('follower_id', followerId)
      .eq('following_id', me)
    if (error) fail(error, 'aceitar o pedido')
  }

  /** Recusar e remover seguidor são o mesmo delete: some a linha, some o laço. */
  async removeFollower(followerId: string): Promise<void> {
    const me = await this.me()
    const { error } = await supabase()
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', me)
    if (error) fail(error, 'recusar o pedido')
  }

  async followRequests(): Promise<readonly FollowRequest[]> {
    const { data, error } = await supabase().rpc('follow_requests')
    if (error) fail(error, 'carregar os pedidos')
    return rows(data).map((row) => ({ ...toCard(row), since: new Date(String(row['since'])) }))
  }

  async followList(
    userId: string,
    kind: FollowListKind,
    offset = 0,
  ): Promise<readonly ProfileCard[]> {
    const { data, error } = await supabase().rpc('follow_list', {
      p_user: userId,
      p_kind: kind,
      p_after: offset,
      p_limit: 30,
    })
    if (error) fail(error, 'carregar a lista')
    return rows(data).map(toCard)
  }

  async suggestions(limit = 8): Promise<readonly ProfileCard[]> {
    const { data, error } = await supabase().rpc('suggested_profiles', { p_limit: limit })
    if (error) fail(error, 'carregar as sugestões')
    return rows(data).map(toCard)
  }

  // -------------------------------------------------------------- segurança

  async block(userId: string): Promise<void> {
    const me = await this.me()
    assertCanBlock(me, userId)
    const { error } = await supabase()
      .from('blocks')
      .upsert(
        { blocker_id: me, blocked_id: userId },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      )
    if (error && error.code !== UNIQUE_VIOLATION) fail(error, 'bloquear')
  }

  async unblock(userId: string): Promise<void> {
    const me = await this.me()
    const { error } = await supabase()
      .from('blocks')
      .delete()
      .eq('blocker_id', me)
      .eq('blocked_id', userId)
    if (error) fail(error, 'desbloquear')
  }

  /**
   * Em dois passos, e não por `select` aninhado.
   *
   * O aninhado sairia numa ida só, mas a RLS de `profiles` ainda vale por
   * dentro dele: quem bloqueou alguém de perfil fechado receberia a linha do
   * bloqueio com o perfil nulo, e a lista mostraria um nome em branco sem
   * explicar por quê. Separado, a ausência é visível e tratável.
   */
  async blockedList(): Promise<readonly ProfileCard[]> {
    const { data, error } = await supabase()
      .from('blocks')
      .select('blocked_id')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) fail(error, 'carregar os bloqueados')

    const ids = (data ?? []).map((row) => String((row as { blocked_id: string }).blocked_id))
    if (ids.length === 0) return []

    const { data: people, error: peopleError } = await supabase()
      .from('profiles')
      .select('id, name, handle, avatar_url')
      .in('id', ids)
    if (peopleError) fail(peopleError, 'carregar os bloqueados')

    return (people ?? []).map((row) => toCard(row as Record<string, unknown>))
  }

  async report(input: NewReportInput): Promise<void> {
    assertValidReport(input)
    const me = await this.me()

    const { error } = await supabase().from('reports').insert({
      reporter_id: me,
      target_kind: input.targetKind,
      target_id: input.targetId,
      reason: input.reason,
      note: input.note,
    })

    // Denunciar o mesmo alvo de novo é o mesmo registro. Pra quem denunciou, o
    // resultado é idêntico, e dizer "você já denunciou" seria um erro sobre
    // algo que já deu certo.
    if (error && error.code !== UNIQUE_VIOLATION) fail(error, 'denunciar')
  }

  // -------------------------------------------------------------- calendário

  async calendar(userId: string, from: DayKey, to: DayKey): Promise<readonly CalendarEntry[]> {
    const { data, error } = await supabase().rpc('profile_calendar', {
      p_user: userId,
      p_from: from,
      p_to: to,
    })
    if (error) fail(error, 'carregar o calendário')

    return rows(data).map((row) => ({
      day: String(row['day']).slice(0, 10) as DayKey,
      postId: row['post_id'] ? String(row['post_id']) : null,
      coverPath: row['cover_path'] ? String(row['cover_path']) : null,
      total: Number(row['total'] ?? 0),
      fromAlbum: row['from_album'] === true,
    }))
  }

  // ----------------------------------------------------------------- stories

  async storyTray(): Promise<readonly StoryRing[]> {
    const { data, error } = await supabase().rpc('stories_tray')
    if (error) fail(error, 'carregar os stories')

    return rows(data).map((row) => ({
      userId: String(row['user_id']),
      name: String(row['name'] ?? ''),
      handle: String(row['handle'] ?? ''),
      avatarUrl: row['avatar_url'] ? String(row['avatar_url']) : null,
      total: Number(row['total'] ?? 0),
      unseen: Number(row['unseen'] ?? 0),
      latest: new Date(String(row['latest'])),
    }))
  }

  async storiesOf(userId: string): Promise<readonly Story[]> {
    const { data, error } = await supabase().rpc('stories_of', { p_user: userId })
    if (error) fail(error, 'abrir os stories')

    return rows(data).map((row) => ({
      id: String(row['id']),
      userId: String(row['user_id']),
      path: String(row['path']),
      kind: row['kind'] === 'video' ? ('video' as const) : ('imagem' as const),
      caption: row['caption'] ? String(row['caption']) : null,
      width: row['width'] ? Number(row['width']) : null,
      height: row['height'] ? Number(row['height']) : null,
      createdAt: new Date(String(row['created_at'])),
      expiresAt: new Date(String(row['expires_at'])),
      seen: row['seen'] === true,
      views: Number(row['views'] ?? 0),
    }))
  }

  async publishStory(input: NewStoryInput, file: Blob): Promise<Story> {
    assertValidStoryCaption(input.caption)
    const path = await this.upload(input.userId, 'stories', file)

    const { data, error } = await supabase()
      .from('stories')
      .insert({
        user_id: input.userId,
        path,
        kind: input.kind,
        caption: input.caption,
        width: input.width,
        height: input.height,
      })
      .select('id, created_at, expires_at')
      .single()

    if (error) {
      await this.discard([path])
      fail(error, 'publicar o story')
    }

    const row = data as { id: string; created_at: string; expires_at: string }
    return {
      id: String(row.id),
      userId: input.userId,
      path,
      kind: input.kind,
      caption: input.caption,
      width: input.width,
      height: input.height,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      seen: true,
      views: 0,
    }
  }

  async markStorySeen(storyId: string): Promise<void> {
    const me = await this.me()
    const { error } = await supabase()
      .from('story_views')
      .upsert(
        { story_id: storyId, viewer_id: me },
        { onConflict: 'story_id,viewer_id', ignoreDuplicates: true },
      )
    // Ver de novo não é um erro, e falhar em marcar não pode travar a tela:
    // o pior que acontece é o anel continuar aceso.
    if (error && error.code !== UNIQUE_VIOLATION) {
      console.warn('não consegui marcar o story como visto', error.message)
    }
  }

  async removeStory(storyId: string): Promise<void> {
    const { data } = await supabase().from('stories').select('path').eq('id', storyId).maybeSingle()
    const { error } = await supabase().from('stories').delete().eq('id', storyId)
    if (error) fail(error, 'apagar o story')

    const path = (data as { path?: string } | null)?.path
    if (path) await this.discard([path])
  }

  // ------------------------------------------------------------------- mídia

  async mediaUrl(path: string): Promise<string> {
    const { data, error } = await supabase()
      .storage.from(BUCKET)
      .createSignedUrl(path, SIGNED_SECONDS)
    if (error || !data) throw new InfrastructureError('Não consegui abrir essa imagem.', error)
    return data.signedUrl
  }

  // ---------------------------------------------------------------- privados

  /**
   * O caminho é `<uid>/<posts|stories>/<id>.<ext>`.
   *
   * O primeiro segmento É a autorização (a política compara com `auth.uid()`),
   * o segundo é a pasta que a política também confere, e o nome é um id — nunca
   * o nome do arquivo no aparelho da pessoa, que costuma carregar data, lugar e
   * às vezes o nome dela.
   */
  private async upload(userId: string, folder: 'posts' | 'stories', file: Blob): Promise<string> {
    const extension = EXTENSIONS[file.type]
    if (!extension) throw new DomainError('Esse tipo de arquivo não é aceito.')

    const path = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase()
      .storage.from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })

    if (error) {
      throw new DomainError(
        'O arquivo não foi aceito. Confere o tipo e o tamanho, e tenta de novo.',
      )
    }
    return path
  }

  /** Limpeza de melhor esforço: arquivo órfão custa bytes, não corrompe nada. */
  private async discard(paths: readonly string[]): Promise<void> {
    if (paths.length === 0) return
    try {
      await supabase().storage.from(BUCKET).remove([...paths])
    } catch {
      // Silêncio proposital: a falha aqui não muda nada pra quem está na tela.
    }
  }

  private async me(): Promise<string> {
    const { data } = await supabase().auth.getUser()
    const id = data.user?.id
    if (!id) throw new DomainError('Tua sessão expirou. Entra de novo.')
    return id
  }

  private async myCard(userId: string): Promise<ProfileCard> {
    const { data } = await supabase()
      .from('profiles')
      .select('id, name, handle, avatar_url')
      .eq('id', userId)
      .maybeSingle()

    return data
      ? toCard(data as Record<string, unknown>)
      : { id: userId, name: 'Você', handle: '', avatarUrl: null }
  }
}

// ---------------------------------------------------------------------------
// conversão
// ---------------------------------------------------------------------------

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

function rows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return []
  return data as Record<string, unknown>[]
}

/**
 * A página e o cursor.
 *
 * O cursor é o `created_at` da ÚLTIMA linha, e só existe quando a página veio
 * cheia: página menor que o limite significa que acabou, e devolver cursor ali
 * faria a tela pedir mais uma vez pra receber vazio.
 */
function toPage(data: unknown, limit: number): PostPage {
  const list = rows(data)
  const posts = list.map(toPost)
  const last = posts[posts.length - 1]
  return { posts, cursor: list.length < limit || !last ? null : last.createdAt }
}

function toPost(row: Record<string, unknown>): Post {
  const done = row['progress_done']
  const goal = row['progress_goal']

  return {
    id: String(row['id']),
    author: {
      id: String(row['user_id']),
      name: String(row['author_name'] ?? ''),
      handle: String(row['author_handle'] ?? ''),
      avatarUrl: row['author_avatar'] ? String(row['author_avatar']) : null,
    },
    caption: row['caption'] ? String(row['caption']) : null,
    day: String(row['day']).slice(0, 10) as DayKey,
    visibility: row['visibility'] === 'privada' ? 'privada' : 'seguidores',
    objectiveId: row['objective_id'] ? String(row['objective_id']) : null,
    objectiveTitle: row['objective_title'] ? String(row['objective_title']) : null,
    progress:
      done !== null && done !== undefined && goal !== null && goal !== undefined
        ? {
            done: Number(done),
            goal: Number(goal),
            unit: row['progress_unit'] ? String(row['progress_unit']) : null,
          }
        : null,
    media: toMedia(row['media']),
    likeCount: Number(row['like_count'] ?? 0),
    commentCount: Number(row['comment_count'] ?? 0),
    liked: row['liked'] === true,
    saved: row['saved'] === true,
    createdAt: new Date(String(row['created_at'])),
    editedAt: row['edited_at'] ? new Date(String(row['edited_at'])) : null,
  }
}

/**
 * O `jsonb` chega como objeto ou como texto, dependendo do driver. Tratar os
 * dois aqui evita que a tela quebre no dia em que a biblioteca mudar de ideia.
 */
function toMedia(value: unknown): PostMedia[] {
  const parsed = typeof value === 'string' ? safeParse(value) : value
  if (!Array.isArray(parsed)) return []

  return parsed
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      id: String(item['id']),
      path: String(item['path']),
      position: Number(item['position'] ?? 0),
      width: item['width'] ? Number(item['width']) : null,
      height: item['height'] ? Number(item['height']) : null,
    }))
    .sort((a, b) => a.position - b.position)
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

function toComment(postId: string) {
  return (row: Record<string, unknown>): PostComment => ({
    id: String(row['id']),
    postId,
    author: toCard(row),
    body: String(row['body'] ?? ''),
    createdAt: new Date(String(row['created_at'])),
    mine: row['mine'] === true,
    canDelete: row['can_delete'] === true,
  })
}

function toCard(row: Record<string, unknown>): ProfileCard {
  return {
    id: String(row['id'] ?? row['user_id'] ?? ''),
    name: String(row['name'] ?? ''),
    handle: String(row['handle'] ?? ''),
    avatarUrl: row['avatar_url'] ? String(row['avatar_url']) : null,
    bio: row['bio'] ? String(row['bio']) : null,
  }
}

function fail(error: PostgrestError, action: string): never {
  if (error.code === UNIQUE_VIOLATION) {
    throw new DomainError('Isso já estava registrado.')
  }
  if (error.code === FUNCTION_MISSING) {
    throw new DomainError('Esse recurso ainda não chegou ao servidor. Tenta de novo mais tarde.')
  }
  throw new InfrastructureError(`Falha ao ${action}.`, error)
}
