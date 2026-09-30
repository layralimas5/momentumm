import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Post } from '@/domain/entities/post'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote } from '@/presentation/components/ui/States'
import { usePlanner } from '@/presentation/planner/use-planner'
import { PostCard } from '@/presentation/social/PostCard'
import { PostSkeleton } from '@/presentation/social/PostSkeleton'
import { toUserMessage } from '@/shared/errors'

/**
 * Uma publicação, no endereço dela.
 *
 * É o destino do link que sai do botão "Compartilhar", e é por isso que ela
 * precisa existir como ROTA e não só como folha: um link que abre o feed no
 * topo não leva ninguém à foto que a pessoa mandou.
 *
 * ## Publicação que não abre
 *
 * Três motivos levam ao mesmo lugar — apagada, privada, ou de alguém que não
 * te deixa ver. A tela não distingue os três, e isso é deliberado: dizer
 * "existe, mas você não pode ver" confirma que existe, e confirmar é
 * justamente o que o perfil fechado não quer.
 */
export function PostPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const planner = usePlanner()

  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    let alive = true
    setLoading(true)
    setError(null)

    void container.social
      .post(id)
      .then((found) => {
        if (alive) setPost(found)
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
  }, [id])

  const toggleLike = async () => {
    if (!post) return
    const next = !post.liked
    setPost({ ...post, liked: next, likeCount: Math.max(0, post.likeCount + (next ? 1 : -1)) })
    try {
      await (next ? container.social.like(post.id) : container.social.unlike(post.id))
    } catch (cause) {
      setPost(post)
      setError(toUserMessage(cause))
    }
  }

  const toggleSave = async () => {
    if (!post) return
    const next = !post.saved
    setPost({ ...post, saved: next })
    try {
      await (next ? container.social.save(post.id) : container.social.unsave(post.id))
    } catch (cause) {
      setPost(post)
      setError(toUserMessage(cause))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start" onClick={() => navigate(-1)}>
        <Icon name="setaEsq" className="size-4" />
        Voltar
      </Button>

      {error ? <ErrorNote message={error} /> : null}

      {loading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Carregando a publicação</span>
          <PostSkeleton />
        </div>
      ) : post ? (
        <PostCard
          post={post}
          today={planner.today}
          onToggleLike={() => void toggleLike()}
          onToggleSave={() => void toggleSave()}
          onChanged={setPost}
          onRemoved={() => navigate('/app/feed', { replace: true })}
        />
      ) : (
        <EmptyState
          title="Esta publicação não está disponível"
          description="Ela pode ter sido apagada, ou ser de um perfil que você não acompanha."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/app/feed')}>
              Ir para o feed
            </Button>
          }
        />
      )}
    </div>
  )
}
