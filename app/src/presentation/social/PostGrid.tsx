import type { Post } from '@/domain/entities/post'
import { coverOf } from '@/domain/entities/post'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { useSignedUrls } from './use-signed-media'

/**
 * A grade tradicional de publicações do perfil.
 *
 * Ela existe ao lado do calendário porque as duas respondem perguntas
 * diferentes: a grade responde "o que eu publiquei", em ordem; o calendário
 * responde "como foi esse mês", em dias. A grade é a leitura que todo mundo já
 * conhece, e é por isso que ela NÃO é a aba padrão — o calendário é a leitura
 * que só existe aqui.
 *
 * Três colunas e quadrado, como manda o hábito. A capa é a primeira foto da
 * publicação, a mesma que vai pro calendário: duas capas diferentes pro mesmo
 * post fariam a pessoa procurar duas vezes.
 *
 * Publicação sem foto (só legenda) aparece como um cartão de texto: sumir com
 * ela faria a contagem de publicações não bater com o que a grade mostra.
 */
export function PostGrid({
  posts,
  onOpen,
}: {
  readonly posts: readonly Post[]
  readonly onOpen: (post: Post) => void
}) {
  const urls = useSignedUrls(
    posts.map((post) => coverOf(post)?.path).filter((path): path is string => Boolean(path)),
  )

  return (
    <ul className="-mx-0.5 grid grid-cols-3 gap-0.5">
      {posts.map((post) => {
        const cover = coverOf(post)
        const url = cover ? (urls.get(cover.path) ?? null) : null

        return (
          <li key={post.id}>
            <button
              type="button"
              onClick={() => onOpen(post)}
              className="relative block aspect-square w-full overflow-hidden bg-surface-hi transition-opacity active:opacity-80"
            >
              {cover ? (
                url ? (
                  <img
                    src={url}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                ) : (
                  <span aria-hidden="true" className="block size-full animate-pulse bg-surface-top/60" />
                )
              ) : (
                <span className="flex size-full items-center p-2">
                  <span className="line-clamp-4 text-left text-[0.6875rem] leading-snug text-ink-muted">
                    {post.caption}
                  </span>
                </span>
              )}

              {post.media.length > 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 rounded bg-black/55 px-1 text-[0.5625rem] font-semibold text-white tabular backdrop-blur-sm"
                >
                  {post.media.length}
                </span>
              ) : null}

              {post.visibility === 'privada' ? (
                <span
                  aria-hidden="true"
                  className="absolute left-1 top-1 grid size-4 place-items-center rounded bg-black/55 text-white backdrop-blur-sm"
                >
                  <Icon name="cadeado" className="size-2.5" strokeWidth={2.5} />
                </span>
              ) : null}

              <span className="sr-only">
                Abrir a publicação de {post.day}
                {post.caption ? `: ${post.caption.slice(0, 60)}` : ''}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** A grade enquanto carrega: nove quadrados do tamanho certo, nada se move. */
export function PostGridSkeleton({ count = 9 }: { readonly count?: number }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-3 gap-0.5">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={cn('aspect-square animate-pulse bg-surface-hi')} />
      ))}
    </div>
  )
}
