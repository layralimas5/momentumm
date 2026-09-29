import { useEffect, useState } from 'react'
import type { CalendarCell } from '@/domain/entities/calendar-day'
import { formatDayLong, type DayKey } from '@/domain/entities/day'
import type { Post } from '@/domain/entities/post'
import { container } from '@/infrastructure/container'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { toUserMessage } from '@/shared/errors'
import { PostCard } from './PostCard'
import { PostSkeleton } from './PostSkeleton'
import { usePostComposer } from './PostComposerProvider'
import { useSignedUrl } from './use-signed-media'

/**
 * O que acontece ao tocar num dia do calendário.
 *
 * A folha muda conforme o dia tem, e essa é a decisão inteira: uma folha fixa
 * com "ver publicação" desabilitado em vinte dias do mês seria uma folha que
 * ensina a não tocar.
 *
 *   com publicação   abre a publicação daquele dia, inteira, com curtir e
 *                    comentar. Com mais de uma, elas vêm empilhadas.
 *   com foto guardada abre a foto, e oferece trocar ou tirar.
 *   sem nada          oferece os dois caminhos: publicar um momento daquele
 *                     dia, ou só guardar uma foto pra você.
 *
 * ## Por que o álbum privado continua existindo
 *
 * Ele veio antes (migration 0060) e as pessoas já guardaram fotos nele. Nem
 * todo dia que vale lembrar é um dia que se quer contar, e essa diferença é
 * justamente o que separa o calendário de um perfil público. Publicar ganha
 * do álbum quando os dois existem no mesmo dia, porque a publicação é o
 * registro que tem legenda, objetivo e conversa em volta.
 */
export function CalendarDaySheet({
  cell,
  today,
  userId,
  readOnly,
  album,
  onClose,
}: {
  readonly cell: CalendarCell | null
  readonly today: DayKey
  readonly userId: string | null
  /** Calendário de outra pessoa: só leitura. */
  readonly readOnly: boolean
  /** As ações do álbum manual. `null` quando o calendário não é o teu. */
  readonly album: {
    has: boolean
    choose(day: DayKey): void
    remove(day: DayKey): void
  } | null
  readonly onClose: () => void
}) {
  const composer = usePostComposer()
  const [posts, setPosts] = useState<readonly Post[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const day = cell?.day ?? null
  const hasPost = cell?.postId !== null && cell?.postId !== undefined

  useEffect(() => {
    if (!day || !userId || !hasPost) {
      setPosts([])
      return
    }

    let alive = true
    setLoading(true)
    setError(null)

    void container.social
      .postsOfDay(userId, day)
      .then((list) => {
        if (alive) setPosts(list)
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
  }, [day, userId, hasPost])

  if (!cell || !day) return null

  return (
    <BottomSheet
      open
      title={formatDayLong(day, today)}
      description={describe(cell, readOnly)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {error ? <ErrorNote message={error} /> : null}

        {loading ? <PostSkeleton /> : null}

        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            today={today}
            onToggleLike={() => void toggleLike(post, setPosts)}
            onToggleSave={() => void toggleSave(post, setPosts)}
            onChanged={(next) =>
              setPosts((current) => current.map((item) => (item.id === next.id ? next : item)))
            }
            onRemoved={() => {
              setPosts((current) => current.filter((item) => item.id !== post.id))
              onClose()
            }}
          />
        ))}

        {cell.kind === 'album' && cell.coverPath ? (
          <AlbumPhoto path={cell.coverPath} alt={`Foto de ${formatDayLong(day, today)}`} />
        ) : null}

        {!readOnly ? (
          <div className="flex flex-col gap-1">
            <SheetAction
              icon={<Icon name="imagem" className="size-5" />}
              label={hasPost ? 'Publicar outro momento desse dia' : 'Publicar um momento'}
              hint="Foto, legenda e objetivo. Aparece no feed de quem te acompanha"
              tone="brand"
              onClick={() => {
                onClose()
                composer.open(day)
              }}
            />

            {album ? (
              <>
                <SheetAction
                  icon={<Icon name="celular" className="size-5" />}
                  label={album.has ? 'Trocar a foto guardada' : 'Só guardar uma foto'}
                  hint="Fica no teu calendário, e só você vê"
                  onClick={() => album.choose(day)}
                />
                {album.has ? (
                  <SheetAction
                    icon={<Icon name="lixeira" className="size-5" />}
                    label="Tirar a foto guardada"
                    hint="O dia continua marcado, só sem imagem"
                    onClick={() => {
                      album.remove(day)
                      onClose()
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </BottomSheet>
  )
}

function AlbumPhoto({ path, alt }: { readonly path: string; readonly alt: string }) {
  const url = useSignedUrl(path, 'album')

  if (!url) {
    return (
      <span
        aria-hidden="true"
        className="mx-auto aspect-square w-full max-w-72 animate-pulse rounded-2xl bg-surface-hi"
      />
    )
  }

  return <img src={url} alt={alt} className="mx-auto aspect-square w-full max-w-72 rounded-2xl object-cover" />
}

function describe(cell: CalendarCell, readOnly: boolean): string {
  if (cell.postCount > 1) return `${cell.postCount} publicações nesse dia.`
  if (cell.kind === 'publicacao') return 'O que você contou desse dia.'
  if (cell.kind === 'album') return 'A foto que guarda esse dia. Só você vê.'
  if (cell.kind === 'movimento') {
    return readOnly ? 'Esse dia teve registro.' : 'Esse dia andou. Falta a imagem dele.'
  }
  return readOnly ? 'Nada registrado nesse dia.' : 'Nada registrado ainda nesse dia.'
}

/*
  Curtir e salvar dentro da folha do dia: as mesmas chamadas do feed, sem o
  `usePostList` inteiro. A folha tem no máximo alguns cards do mesmo dia e não
  pagina, então a lista de otimismo cabe num `setPosts`.
*/
async function toggleLike(
  post: Post,
  setPosts: React.Dispatch<React.SetStateAction<readonly Post[]>>,
): Promise<void> {
  const next = !post.liked
  setPosts((current) =>
    current.map((item) =>
      item.id === post.id
        ? { ...item, liked: next, likeCount: Math.max(0, item.likeCount + (next ? 1 : -1)) }
        : item,
    ),
  )
  try {
    await (next ? container.social.like(post.id) : container.social.unlike(post.id))
  } catch {
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id ? { ...item, liked: post.liked, likeCount: post.likeCount } : item,
      ),
    )
  }
}

async function toggleSave(
  post: Post,
  setPosts: React.Dispatch<React.SetStateAction<readonly Post[]>>,
): Promise<void> {
  const next = !post.saved
  setPosts((current) =>
    current.map((item) => (item.id === post.id ? { ...item, saved: next } : item)),
  )
  try {
    await (next ? container.social.save(post.id) : container.social.unsave(post.id))
  } catch {
    setPosts((current) =>
      current.map((item) => (item.id === post.id ? { ...item, saved: post.saved } : item)),
    )
  }
}
