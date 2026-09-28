import { useCallback, useEffect, useRef, useState } from 'react'
import type { Post } from '@/domain/entities/post'
import type { PostPage } from '@/domain/repositories/social-repository'
import { container } from '@/infrastructure/container'
import { toUserMessage } from '@/shared/errors'
import { useSocialRevision } from './PostComposerProvider'

export interface PostListView {
  readonly posts: readonly Post[]
  readonly loading: boolean
  readonly loadingMore: boolean
  readonly error: string | null
  readonly hasMore: boolean
  loadMore(): void
  reload(): void
  /** Curtir e salvar, otimistas: a tela muda no toque e volta se o servidor recusar. */
  toggleLike(postId: string): void
  toggleSave(postId: string): void
  /** Troca uma publicação no lugar dela. Usado depois de comentar e de editar. */
  replace(post: Post): void
  drop(postId: string): void
}

/**
 * Uma lista paginada de publicações, com as interações otimistas.
 *
 * Feed, grade do perfil e salvos são três perguntas diferentes pro mesmo
 * servidor, e a diferença entre elas cabe numa função. Três hooks completos
 * teriam três paginações, três `toggleLike` e três jeitos de errar.
 *
 * ## Por que otimista
 *
 * Curtir é o gesto mais repetido de um feed e o mais barato de desfazer. Uma
 * espera de rede entre o toque e o coração acender é a diferença entre "o app
 * responde" e "o app pensa", e o pior caso — o servidor recusar — devolve o
 * estado anterior e mostra o motivo. Publicar NÃO é otimista, porque o custo
 * de errar ali é a pessoa achar que postou e não ter postado.
 *
 * ## Por que o cursor e não a página
 *
 * Com "página 2", uma publicação nova no topo empurra tudo e a segunda página
 * repete a primeira. O cursor é o `created_at` da última linha, e o tempo não
 * muda de lugar.
 */
export function usePostList(
  load: (cursor: Date | null) => Promise<PostPage>,
  enabled = true,
): PostListView {
  const [posts, setPosts] = useState<readonly Post[]>([])
  const [cursor, setCursor] = useState<Date | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(enabled)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const revision = useSocialRevision()
  /* A função de carga muda de identidade a cada render de quem chama; a ref
     guarda a mais recente sem fazer o efeito rodar por causa disso. */
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    if (!enabled) {
      setPosts([])
      setLoading(false)
      return
    }

    let alive = true
    setLoading(true)
    setError(null)

    void loadRef
      .current(null)
      .then((page) => {
        if (!alive) return
        setPosts(page.posts)
        setCursor(page.cursor)
        setHasMore(page.cursor !== null)
      })
      .catch((cause: unknown) => {
        if (alive) setError(toUserMessage(cause))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [enabled, revision, tick])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading || !cursor) return
    setLoadingMore(true)

    void loadRef
      .current(cursor)
      .then((page) => {
        /*
          Concatena filtrando o que já está na lista. Sem isso, uma publicação
          criada entre a primeira página e a segunda faria uma linha aparecer
          duas vezes — e duas linhas com a mesma `key` é um card que o React
          reusa errado.
        */
        setPosts((current) => {
          const seen = new Set(current.map((post) => post.id))
          return [...current, ...page.posts.filter((post) => !seen.has(post.id))]
        })
        setCursor(page.cursor)
        setHasMore(page.cursor !== null)
      })
      .catch((cause: unknown) => setError(toUserMessage(cause)))
      .finally(() => setLoadingMore(false))
  }, [cursor, hasMore, loading, loadingMore])

  const reload = useCallback(() => setTick((value) => value + 1), [])

  const patch = useCallback((postId: string, change: (post: Post) => Post) => {
    setPosts((current) => current.map((post) => (post.id === postId ? change(post) : post)))
  }, [])

  const toggleLike = useCallback(
    (postId: string) => {
      const current = posts.find((post) => post.id === postId)
      if (!current) return
      const next = !current.liked

      patch(postId, (post) => ({
        ...post,
        liked: next,
        likeCount: Math.max(0, post.likeCount + (next ? 1 : -1)),
      }))

      const call = next ? container.social.like(postId) : container.social.unlike(postId)
      void call.catch((cause: unknown) => {
        // Volta ao que era e conta o porquê: um coração que acende e some sem
        // explicação ensina a desconfiar do botão.
        patch(postId, (post) => ({
          ...post,
          liked: current.liked,
          likeCount: current.likeCount,
        }))
        setError(toUserMessage(cause))
      })
    },
    [posts, patch],
  )

  const toggleSave = useCallback(
    (postId: string) => {
      const current = posts.find((post) => post.id === postId)
      if (!current) return
      const next = !current.saved

      patch(postId, (post) => ({ ...post, saved: next }))

      const call = next ? container.social.save(postId) : container.social.unsave(postId)
      void call.catch((cause: unknown) => {
        patch(postId, (post) => ({ ...post, saved: current.saved }))
        setError(toUserMessage(cause))
      })
    },
    [posts, patch],
  )

  const replace = useCallback((post: Post) => {
    setPosts((current) => current.map((item) => (item.id === post.id ? post : item)))
  }, [])

  const drop = useCallback((postId: string) => {
    setPosts((current) => current.filter((post) => post.id !== postId))
  }, [])

  return {
    posts,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    reload,
    toggleLike,
    toggleSave,
    replace,
    drop,
  }
}

/** O feed: quem eu sigo, mais eu. */
export function useFeed(): PostListView {
  return usePostList(useCallback((cursor: Date | null) => container.social.feed(cursor, 8), []))
}

export function useProfilePosts(userId: string | null, enabled = true): PostListView {
  return usePostList(
    useCallback(
      (cursor: Date | null) =>
        userId
          ? container.social.postsOf(userId, cursor, 12)
          : Promise.resolve({ posts: [], cursor: null }),
      [userId],
    ),
    enabled && userId !== null,
  )
}

export function useSavedPosts(enabled = true): PostListView {
  return usePostList(
    useCallback((cursor: Date | null) => container.social.savedPosts(cursor, 12), []),
    enabled,
  )
}
