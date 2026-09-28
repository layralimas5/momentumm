import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { shortAgo, type Post } from '@/domain/entities/post'
import { MAX_COMMENT_LENGTH, type PostComment } from '@/domain/entities/post-comment'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote } from '@/presentation/components/ui/States'
import { toUserMessage } from '@/shared/errors'
import { useSocialNotify } from './PostComposerProvider'
import { profilePath } from './profile-path'
import { ReportSheet } from './ReportSheet'

const PAGE = 20

/**
 * Os comentários de uma publicação.
 *
 * ## Em folha, e não em tela
 *
 * A publicação continua visível atrás: a conversa é sobre a foto, e mandar a
 * pessoa pra outra rota pra ler o comentário faz ela perder de vista o que
 * está sendo comentado.
 *
 * ## Do mais antigo pro mais novo
 *
 * Ao contrário do feed. Conversa se lê na ordem em que aconteceu, e quem chega
 * depois de dez comentários quer o começo, não o fim. O campo de escrever fica
 * preso embaixo (`footer` do sheet) pra não sumir na rolagem.
 *
 * ## O comentário aparece antes do servidor responder
 *
 * Ele entra na lista assim que o servidor confirma, e o campo já limpa antes:
 * escrever, enviar e ver o texto parado no campo por um segundo é a interação
 * que faz a pessoa enviar duas vezes. Se falhar, o texto volta pro campo com o
 * motivo, em vez de sumir.
 */
export function CommentsSheet({
  open,
  post,
  onClose,
  onCountChange,
}: {
  readonly open: boolean
  readonly post: Post
  readonly onClose: () => void
  readonly onCountChange: (count: number) => void
}) {
  const { profile } = useAuth()
  const { warn } = useSocialNotify()

  const [comments, setComments] = useState<readonly PostComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [reporting, setReporting] = useState<string | null>(null)
  const listEnd = useRef<HTMLDivElement>(null)

  const load = useCallback(
    async (after: Date | null) => {
      const page = await container.social.comments(post.id, after, PAGE)
      setHasMore(page.length === PAGE)
      return page
    },
    [post.id],
  )

  useEffect(() => {
    if (!open) return

    let alive = true
    setLoading(true)
    setError(null)

    void load(null)
      .then((page) => {
        if (alive) setComments(page)
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
  }, [open, load])

  const loadMore = async () => {
    const last = comments[comments.length - 1]
    if (!last) return
    try {
      const page = await load(last.createdAt)
      setComments((current) => [...current, ...page])
    } catch (cause) {
      setError(toUserMessage(cause))
    }
  }

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return

    setSending(true)
    setText('')
    try {
      const created = await container.social.comment(post.id, body)
      setComments((current) => [...current, created])
      onCountChange(post.commentCount + 1)
      // Rola até o comentário novo: ele nasce no fim da lista, e sem isso a
      // pessoa escreve, envia e não vê nada acontecer.
      requestAnimationFrame(() => listEnd.current?.scrollIntoView({ block: 'end' }))
    } catch (cause) {
      setText(body)
      setError(toUserMessage(cause))
    } finally {
      setSending(false)
    }
  }

  const remove = async (comment: PostComment) => {
    const before = comments
    setComments((current) => current.filter((item) => item.id !== comment.id))
    onCountChange(Math.max(0, post.commentCount - 1))

    try {
      await container.social.removeComment(comment.id)
    } catch (cause) {
      setComments(before)
      onCountChange(post.commentCount)
      warn(toUserMessage(cause))
    }
  }

  return (
    <>
      <BottomSheet
        open={open && reporting === null}
        title="Comentários"
        onClose={onClose}
        footer={
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
            className="flex items-end gap-2"
          >
            <Avatar name={profile?.name ?? ''} src={profile?.avatarUrl ?? null} className="size-9" />
            <input
              value={text}
              maxLength={MAX_COMMENT_LENGTH}
              onChange={(event) => setText(event.target.value)}
              placeholder="Escreve um comentário"
              aria-label="Escrever um comentário"
              className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface-hi px-4 text-ink placeholder:text-ink-faint focus:border-brand"
            />
            <button
              type="submit"
              disabled={text.trim().length === 0 || sending}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors active:bg-brand-hi disabled:opacity-40"
            >
              <Icon name="seta" className="size-5" strokeWidth={2.25} />
              <span className="sr-only">Enviar comentário</span>
            </button>
          </form>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <ErrorNote message={error} onRetry={() => setError(null)} retryLabel="Ok" /> : null}

          {loading ? (
            <div role="status" aria-live="polite" className="flex flex-col gap-3">
              <span className="sr-only">Carregando os comentários</span>
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className="h-11 animate-pulse rounded-xl bg-surface-hi"
                />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <EmptyState
              title="Nenhum comentário ainda"
              description="Seja a primeira pessoa a dizer alguma coisa sobre esse momento."
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {comments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  onRemove={() => void remove(comment)}
                  onReport={() => setReporting(comment.id)}
                />
              ))}
            </ul>
          )}

          {hasMore ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="min-h-11 self-center text-sm font-medium text-brand-hi"
            >
              Ver mais comentários
            </button>
          ) : null}

          <div ref={listEnd} />
        </div>
      </BottomSheet>

      <ReportSheet
        open={reporting !== null}
        targetKind="comentario"
        targetId={reporting ?? ''}
        onClose={() => setReporting(null)}
        onSent={() => setReporting(null)}
      />
    </>
  )
}

function CommentRow({
  comment,
  onRemove,
  onReport,
}: {
  readonly comment: PostComment
  readonly onRemove: () => void
  readonly onReport: () => void
}) {
  return (
    <li className="flex items-start gap-3">
      <Link to={profilePath(comment.author.id)} className="shrink-0">
        <Avatar name={comment.author.name} src={comment.author.avatarUrl} className="size-9" />
        <span className="sr-only">Abrir o perfil de {comment.author.name}</span>
      </Link>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">
          <Link to={profilePath(comment.author.id)} className="font-medium">
            {comment.author.name}
          </Link>{' '}
          <span className="whitespace-pre-wrap">{comment.body}</span>
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          <time dateTime={comment.createdAt.toISOString()}>{shortAgo(comment.createdAt)}</time>
        </p>
      </div>

      {/*
        Apagar aparece pra quem escreveu e pra quem publicou; denunciar, pro
        resto. Um botão de apagar desabilitado seria um convite a tentar.
      */}
      {comment.canDelete ? (
        <button
          type="button"
          onClick={onRemove}
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink-faint transition-colors active:bg-surface-hi active:text-danger"
        >
          <Icon name="lixeira" className="size-4" />
          <span className="sr-only">Apagar o comentário de {comment.author.name}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onReport}
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink-faint transition-colors active:bg-surface-hi"
        >
          <Icon name="bandeira" className="size-4" />
          <span className="sr-only">Denunciar o comentário de {comment.author.name}</span>
        </button>
      )}
    </li>
  )
}
