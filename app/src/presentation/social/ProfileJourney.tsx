import { useRef, useState } from 'react'
import type { CalendarCell } from '@/domain/entities/calendar-day'
import { addDays, type DayKey } from '@/domain/entities/day'
import { addMonths, startOfMonthKey } from '@/domain/entities/month'
import type { Post } from '@/domain/entities/post'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote } from '@/presentation/components/ui/States'
import { useDayPhotos } from '@/presentation/profile/use-day-photos'
import { cn } from '@/shared/lib/cn'
import { CalendarDaySheet } from './CalendarDaySheet'
import { FeedSentinel } from './FeedSentinel'
import { JourneyCalendar } from './JourneyCalendar'
import { PostCard } from './PostCard'
import { PostGrid, PostGridSkeleton } from './PostGrid'
import { usePostComposer } from './PostComposerProvider'
import { useCalendar } from './use-calendar'
import { useProfilePosts } from './use-post-list'

const VIEWS = ['calendario', 'publicacoes'] as const
type JourneyView = (typeof VIEWS)[number]

const VIEW_LABELS: Readonly<Record<JourneyView, string>> = {
  calendario: 'Calendário',
  publicacoes: 'Publicações',
}

/**
 * As duas formas de olhar a mesma jornada.
 *
 *   Calendário   por DIA. É a leitura que só existe aqui, e é ela que
 *                transforma registro comum em percepção de trajetória.
 *   Publicações  a grade de sempre, por ordem de publicação.
 *
 * O calendário abre primeiro, e isso é a escolha de produto inteira: a grade
 * responde "o que eu postei", uma pergunta que todo app responde; o calendário
 * responde "como foram os meus meses", que é a pergunta que traz a pessoa de
 * volta. Abrir na grade seria abrir na resposta comum.
 *
 * O componente serve os dois perfis, o próprio e o dos outros. A diferença é
 * `readOnly`: no calendário alheio dá pra abrir o dia, nunca registrar nele, e
 * o álbum privado (que é só do dono) nem é carregado.
 */
export function ProfileJourney({
  userId,
  today,
  movedDays,
  owner,
}: {
  readonly userId: string | null
  readonly today: DayKey
  /** Dias em que alguma coisa se moveu. Vem do planner; só o dono tem isso. */
  readonly movedDays: ReadonlySet<DayKey>
  /** É o meu perfil. */
  readonly owner: boolean
}) {
  const [view, setView] = useState<JourneyView>('calendario')
  const [month, setMonth] = useState(() => startOfMonthKey(today))
  const [openCell, setOpenCell] = useState<CalendarCell | null>(null)
  const [openPost, setOpenPost] = useState<Post | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingDay = useRef<DayKey | null>(null)

  const composer = usePostComposer()
  const calendar = useCalendar(userId, month, today, movedDays)
  const posts = useProfilePosts(userId, view === 'publicacoes')

  /* O álbum privado só existe pro dono: a política do `user-media` (0014) não
     deixa ninguém assinar a pasta de outra pessoa, então pedir isso num perfil
     alheio seria uma chamada que só pode falhar. */
  const album = useDayPhotos(
    owner ? month : today,
    owner ? addDays(addMonths(month, 1), -1) : today,
  )

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Como ver a jornada" className="flex gap-1 rounded-xl bg-surface-hi p-1">
        {VIEWS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={view === option}
            onClick={() => setView(option)}
            className={cn(
              'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors',
              view === option ? 'bg-surface-top text-ink' : 'text-ink-faint active:text-ink-muted',
            )}
          >
            <Icon name={option === 'calendario' ? 'calendario' : 'grade'} className="size-4" />
            {VIEW_LABELS[option]}
          </button>
        ))}
      </div>

      {view === 'calendario' ? (
        <JourneyCalendar
          view={calendar}
          month={month}
          today={today}
          onMonthChange={setMonth}
          onPick={setOpenCell}
          readOnly={!owner}
        />
      ) : (
        <PublicationsView posts={posts} owner={owner} onOpen={setOpenPost} />
      )}

      <CalendarDaySheet
        cell={openCell}
        today={today}
        userId={userId}
        readOnly={!owner}
        album={
          owner
            ? {
                has: openCell ? album.photos.has(openCell.day) : false,
                choose: (day) => {
                  pendingDay.current = day
                  fileRef.current?.click()
                },
                remove: (day) => void album.remove(day),
              }
            : null
        }
        onClose={() => setOpenCell(null)}
      />

      {/*
        Um input só, escondido, reaproveitado por todas as células: trinta e
        cinco inputs de arquivo numa tela seriam trinta e cinco nós ociosos e
        exatamente o mesmo comportamento.
      */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          const day = pendingDay.current
          event.target.value = ''
          pendingDay.current = null
          if (file && day) {
            void album.save(day, file).then(() => calendar.reload())
            setOpenCell(null)
          }
        }}
      />

      {album.error ? <ErrorNote message={album.error} /> : null}

      <BottomSheet
        open={openPost !== null}
        title="Publicação"
        hideTitle
        onClose={() => setOpenPost(null)}
      >
        {openPost ? (
          <PostCard
            post={openPost}
            today={today}
            onToggleLike={() => {
              posts.toggleLike(openPost.id)
              setOpenPost({
                ...openPost,
                liked: !openPost.liked,
                likeCount: Math.max(0, openPost.likeCount + (openPost.liked ? -1 : 1)),
              })
            }}
            onToggleSave={() => {
              posts.toggleSave(openPost.id)
              setOpenPost({ ...openPost, saved: !openPost.saved })
            }}
            onChanged={(next) => {
              posts.replace(next)
              setOpenPost(next)
            }}
            onRemoved={() => {
              posts.drop(openPost.id)
              setOpenPost(null)
              calendar.reload()
            }}
          />
        ) : null}
      </BottomSheet>

      {/* O criador entra por aqui quando a grade está vazia. */}
      {owner && view === 'publicacoes' && !posts.loading && posts.posts.length === 0 ? (
        <button
          type="button"
          onClick={() => composer.open()}
          className="min-h-11 self-center text-sm font-medium text-brand-hi"
        >
          Publicar o primeiro momento
        </button>
      ) : null}
    </div>
  )
}

function PublicationsView({
  posts,
  owner,
  onOpen,
}: {
  readonly posts: ReturnType<typeof useProfilePosts>
  readonly owner: boolean
  readonly onOpen: (post: Post) => void
}) {
  if (posts.loading) return <PostGridSkeleton />

  if (posts.error) {
    return <ErrorNote message={posts.error} onRetry={posts.reload} />
  }

  if (posts.posts.length === 0) {
    return (
      <EmptyState
        title={owner ? 'Você ainda não publicou nada' : 'Nada publicado por aqui'}
        description={
          owner
            ? 'Uma foto do teu dia entra no feed de quem te acompanha e preenche o dia certo do teu calendário.'
            : 'Quando essa pessoa publicar, aparece aqui.'
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <PostGrid posts={posts.posts} onOpen={onOpen} />

      {posts.loadingMore ? <PostGridSkeleton count={3} /> : null}

      <FeedSentinel onReach={posts.loadMore} disabled={!posts.hasMore || posts.loadingMore} />

      {posts.hasMore && !posts.loadingMore ? (
        <button
          type="button"
          onClick={posts.loadMore}
          className="min-h-11 self-center text-sm font-medium text-brand-hi"
        >
          Ver mais
        </button>
      ) : null}
    </div>
  )
}
