import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { formatDayLong, type DayKey } from '@/domain/entities/day'
import { progressLabel, shortAgo, type Post } from '@/domain/entities/post'
import { commentsLabel, likesLabel } from '@/domain/entities/post-comment'
import { StatusTag } from '@/presentation/components/ds/Badges'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { CommentsSheet } from './CommentsSheet'
import { PostMenu } from './PostMenu'
import { PostPhoto } from './PostPhoto'
import { profilePath } from './profile-path'

/**
 * A publicação no Círculo. O feed valoriza a conquista: o objetivo vira
 * etiqueta, o progresso vira placa sobre a foto, e a reação é uma chama (a
 * mesma da sequência), não um coração de rede social comum.
 */
export function PostCard({
  post,
  today,
  onToggleLike,
  onToggleSave,
  onChanged,
  onRemoved,
}: {
  readonly post: Post
  readonly today: DayKey
  readonly onToggleLike: () => void
  readonly onToggleSave: () => void
  readonly onChanged: (post: Post) => void
  readonly onRemoved: () => void
}) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const progress = progressLabel(post.progress)
  const author = profilePath(post.author.id)

  return (
    <article className="card flex flex-col gap-4 p-4 sm:p-5">
      <header className="flex items-center gap-3">
        <Link to={author} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar
            name={post.author.name}
            src={post.author.avatarUrl}
            className="size-11 ring-2 ring-surface shadow-[var(--shadow-card)]"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{post.author.name}</span>
            <span className="block truncate text-xs text-ink-faint">
              {post.objectiveTitle ?? `@${post.author.handle}`}
            </span>
          </span>
        </Link>
        <time
          dateTime={post.createdAt.toISOString()}
          title={post.createdAt.toLocaleString('pt-BR')}
          className="shrink-0 text-xs text-ink-faint"
        >
          {shortAgo(post.createdAt)}
        </time>
        <PostMenu post={post} onChanged={onChanged} onRemoved={onRemoved} />
      </header>

      {post.objectiveTitle || progress ? (
        <div className="flex flex-wrap items-center gap-2">
          {post.objectiveTitle ? (
            <StatusTag icon="bussola" className="uppercase tracking-wide">
              {post.objectiveTitle}
            </StatusTag>
          ) : null}
          {progress ? <StatusTag tone="brand">{progress}</StatusTag> : null}
        </div>
      ) : null}

      {post.media.length > 0 ? (
        <div className="relative overflow-hidden rounded-[1.25rem]">
          <PostPhoto media={post.media} alt={post.caption ?? `Publicação de ${post.author.name}`} />
          {progress && post.objectiveTitle ? (
            <span className="pointer-events-none absolute bottom-3 left-3 flex max-w-[85%] items-center gap-2 rounded-full bg-black/55 px-3.5 py-2 text-xs font-semibold tracking-wide text-white backdrop-blur-md">
              <Icon name="tendencia" className="size-4" strokeWidth={2} />
              <span className="truncate tabular">{progress}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {post.caption ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">{post.caption}</p>
      ) : null}

      <Actions
        post={post}
        onToggleLike={onToggleLike}
        onToggleSave={onToggleSave}
        onComment={() => setCommentsOpen(true)}
      />

      <p className="-mt-1 px-1 text-xs text-ink-faint">
        {formatDayLong(post.day, today)}
        {post.editedAt ? <span aria-hidden="true"> · editado</span> : null}
      </p>

      <CommentsSheet
        open={commentsOpen}
        post={post}
        onClose={() => setCommentsOpen(false)}
        onCountChange={(count) => onChanged({ ...post, commentCount: count })}
      />
    </article>
  )
}

function Actions({
  post,
  onToggleLike,
  onToggleSave,
  onComment,
}: {
  readonly post: Post
  readonly onToggleLike: () => void
  readonly onToggleSave: () => void
  readonly onComment: () => void
}) {
  const reduceMotion = useReducedMotion()

  const share = async () => {
    const url = `${window.location.origin}/app/publicacao/${post.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Momentumm', text: post.caption ?? '', url })
        return
      }
      await navigator.clipboard.writeText(url)
    } catch {
      // Compartilhar cancelado pela pessoa: não é erro.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <motion.button
        type="button"
        onClick={onToggleLike}
        aria-pressed={post.liked}
        {...(reduceMotion ? {} : { whileTap: { scale: 1.12 } })}
        className={cn(
          'chip flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors',
          post.liked ? 'text-flame' : 'text-ink-muted',
        )}
      >
        <Icon name="fogo" className="size-5" filled={post.liked} strokeWidth={1.9} />
        <span className="tabular">{post.likeCount}</span>
        <span className="sr-only">
          {post.liked ? 'Tirar a chama' : 'Dar chama'}, {likesLabel(post.likeCount)}
        </span>
      </motion.button>

      <button
        type="button"
        onClick={onComment}
        className="chip flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-ink-muted"
      >
        <Icon name="comentario" className="size-5" strokeWidth={1.9} />
        <span className="tabular">{post.commentCount}</span>
        <span className="sr-only">Comentar, {commentsLabel(post.commentCount)}</span>
      </button>

      <button
        type="button"
        onClick={onToggleSave}
        aria-pressed={post.saved}
        className={cn(
          'chip ml-auto grid size-11 place-items-center rounded-full transition-colors',
          post.saved ? 'text-brand-hi' : 'text-ink-muted',
        )}
      >
        <Icon name="salvar" className="size-5" filled={post.saved} strokeWidth={1.9} />
        <span className="sr-only">{post.saved ? 'Tirar dos salvos' : 'Salvar'}</span>
      </button>

      <button
        type="button"
        onClick={() => void share()}
        className="chip grid size-11 place-items-center rounded-full text-ink-muted"
      >
        <Icon name="compartilhar" className="size-5" strokeWidth={1.9} />
        <span className="sr-only">Compartilhar</span>
      </button>
    </div>
  )
}
