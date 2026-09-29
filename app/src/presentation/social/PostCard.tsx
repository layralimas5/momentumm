import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { formatDayLong, type DayKey } from '@/domain/entities/day'
import { progressLabel, shortAgo, type Post } from '@/domain/entities/post'
import { commentsLabel, likesLabel } from '@/domain/entities/post-comment'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { CommentsSheet } from './CommentsSheet'
import { PostMenu } from './PostMenu'
import { PostPhoto } from './PostPhoto'
import { profilePath } from './profile-path'

/**
 * Uma publicação no feed.
 *
 * A hierarquia é a do pedido, e ela tem razão de ser: cabeçalho (quem e
 * quando), foto (o que), objetivo e progresso (por quê), legenda (a palavra
 * dela), ações (o que eu faço a respeito).
 *
 * ## O que este card NÃO mostra
 *
 * Não existe contagem de seguidores do autor, nem pontuação, nem posição em
 * ranking. O Momentumm recusa tabela de classificação (ver CLAUDE.md), e um
 * "1.2k seguidores" embaixo do nome monta a tabela sem nunca chamá-la assim,
 * num produto onde as pessoas estão tentando mudar de vida.
 *
 * O que aparece é o AVANÇO — "1.240 de 1.800 páginas" — porque é a comparação
 * da pessoa com ela mesma, que é a única que o produto aceita.
 *
 * ## A curtida é otimista
 *
 * O coração acende no toque; quem cuida de desfazer se o servidor recusar é o
 * `usePostList`. A animação é um pulo curto, e ela some inteira com
 * `prefers-reduced-motion`: um coração que salta é charme, e charme não pode
 * ser o motivo de alguém sentir enjoo ao rolar o feed.
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
    <article className="flex flex-col gap-3 border-b border-line pb-5 last:border-b-0 sm:rounded-card sm:border sm:px-4 sm:pt-4">
      <header className="flex items-center gap-3">
        <Link to={author} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={post.author.name} src={post.author.avatarUrl} className="size-10" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{post.author.name}</span>
            <span className="block truncate text-xs text-ink-faint">
              @{post.author.handle}
              <span aria-hidden="true"> · </span>
              <time dateTime={post.createdAt.toISOString()} title={post.createdAt.toLocaleString('pt-BR')}>
                {shortAgo(post.createdAt)}
              </time>
            </span>
          </span>
        </Link>

        <PostMenu post={post} onChanged={onChanged} onRemoved={onRemoved} />
      </header>

      {post.media.length > 0 ? (
        <PostPhoto media={post.media} alt={post.caption ?? `Publicação de ${post.author.name}`} />
      ) : null}

      {/*
        O objetivo e o progresso ficam ACIMA da legenda, e em voz baixa: eles
        são o contexto do que a foto mostra, não a notícia. A notícia é a frase
        que a pessoa escreveu.
      */}
      {post.objectiveTitle || progress ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {post.objectiveTitle ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-brand-ink">
              <Icon name="objetivo" className="size-4" />
              {post.objectiveTitle}
            </span>
          ) : null}
          {progress ? (
            <span className="text-sm text-ink-muted tabular">
              {post.objectiveTitle ? <span aria-hidden="true">· </span> : null}
              {progress}
            </span>
          ) : null}
        </div>
      ) : null}

      {post.caption ? (
        <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink">
          {post.caption}
        </p>
      ) : null}

      <Actions
        post={post}
        onToggleLike={onToggleLike}
        onToggleSave={onToggleSave}
        onComment={() => setCommentsOpen(true)}
      />

      {/*
        O dia da publicação, e não a hora. É o dia que o calendário usa, e
        dizê-lo aqui é o que amarra o card ao álbum: "isto está em 12 de
        setembro no meu perfil".
      */}
      <p className="text-xs text-ink-faint">
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
      // Cancelar o share sheet levanta AbortError, e cancelar não é erro.
    }
  }

  return (
    <div className="flex items-center gap-1">
      <motion.button
        type="button"
        onClick={onToggleLike}
        aria-pressed={post.liked}
        {...(reduceMotion ? {} : { whileTap: { scale: 1.25 } })}
        className={cn(
          'flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors',
          post.liked ? 'text-danger' : 'text-ink-muted active:text-ink',
        )}
      >
        <Icon name="coracao" className="size-[1.375rem]" filled={post.liked} strokeWidth={1.9} />
        {post.likeCount > 0 ? <span className="tabular">{post.likeCount}</span> : null}
        <span className="sr-only">
          {post.liked ? 'Descurtir' : 'Curtir'}
          {post.likeCount > 0 ? `, ${likesLabel(post.likeCount)}` : ''}
        </span>
      </motion.button>

      <button
        type="button"
        onClick={onComment}
        className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-muted transition-colors active:text-ink"
      >
        <Icon name="comentario" className="size-[1.375rem]" strokeWidth={1.9} />
        {post.commentCount > 0 ? <span className="tabular">{post.commentCount}</span> : null}
        <span className="sr-only">
          Comentar{post.commentCount > 0 ? `, ${commentsLabel(post.commentCount)}` : ''}
        </span>
      </button>

      <button
        type="button"
        onClick={() => void share()}
        className="flex min-h-11 items-center rounded-lg px-2 text-ink-muted transition-colors active:text-ink"
      >
        <Icon name="compartilhar" className="size-[1.375rem]" strokeWidth={1.9} />
        <span className="sr-only">Compartilhar</span>
      </button>

      {/* Salvar fica na ponta direita, separado das outras três: as três
          primeiras falam com o autor, e salvar é só entre a pessoa e ela. */}
      <button
        type="button"
        onClick={onToggleSave}
        aria-pressed={post.saved}
        className={cn(
          'ml-auto flex min-h-11 items-center rounded-lg px-2 transition-colors',
          post.saved ? 'text-brand-hi' : 'text-ink-muted active:text-ink',
        )}
      >
        <Icon name="salvar" className="size-[1.375rem]" filled={post.saved} strokeWidth={1.9} />
        <span className="sr-only">{post.saved ? 'Tirar dos salvos' : 'Salvar'}</span>
      </button>
    </div>
  )
}
