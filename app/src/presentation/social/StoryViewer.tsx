import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { timeLeftLabel, type Story, type StoryRing } from '@/domain/entities/story'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Icon } from '@/presentation/components/ui/Icon'
import { toUserMessage } from '@/shared/errors'
import { cn } from '@/shared/lib/cn'
import { profilePath } from './profile-path'
import { ReportSheet } from './ReportSheet'
import { useSignedUrl } from './use-signed-media'

/** Quanto tempo uma foto fica na tela antes de passar sozinha. */
const PHOTO_MS = 5000

/**
 * O visualizador de stories, em tela cheia.
 *
 * ## A navegação
 *
 * Toque na metade direita avança, na esquerda volta, e ao fim de uma pessoa
 * ele passa pra próxima — é a gramática que todo mundo já tem no dedo, e
 * inventar outra aqui não traria nada. O que ELE acrescenta são os caminhos que
 * o gesto não cobre: setas do teclado, `Escape` pra fechar, e botões de verdade
 * pra quem usa leitor de tela. Uma navegação que só existe no toque exclui
 * exatamente quem mais precisa de alternativa.
 *
 * ## A barra de progresso
 *
 * Uma por story, como todo mundo faz, e ela é a única animação que sobra com
 * `prefers-reduced-motion`: sem ela não dá pra saber quantos faltam. O que some
 * é o movimento da transição entre um e outro.
 *
 * ## Vídeo manda no tempo
 *
 * Foto passa em cinco segundos; vídeo passa quando acaba. Um cronômetro fixo
 * cortaria o vídeo no meio, e um vídeo que termina e fica parado na tela faz a
 * pessoa achar que travou.
 */
export function StoryViewer({
  rings,
  startAt,
  onClose,
  onSeen,
}: {
  readonly rings: readonly StoryRing[]
  readonly startAt: number
  readonly onClose: () => void
  readonly onSeen: (userId: string) => void
}) {
  const [ringIndex, setRingIndex] = useState(startAt)
  const [stories, setStories] = useState<readonly Story[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [reporting, setReporting] = useState(false)

  const ring = rings[ringIndex]

  /* Carrega os stories da pessoa atual e começa no primeiro não visto: quem
     já viu três de cinco quer o quarto, não o primeiro de novo. */
  useEffect(() => {
    if (!ring) return
    let alive = true
    setLoading(true)
    setError(null)

    void container.social
      .storiesOf(ring.userId)
      .then((list) => {
        if (!alive) return
        setStories(list)
        const firstUnseen = list.findIndex((story) => !story.seen)
        setIndex(firstUnseen >= 0 ? firstUnseen : 0)
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
  }, [ring])

  const current = stories[index] ?? null

  const nextRing = useCallback(() => {
    if (ringIndex + 1 < rings.length) {
      setRingIndex(ringIndex + 1)
      return
    }
    onClose()
  }, [ringIndex, rings.length, onClose])

  const advance = useCallback(() => {
    if (index + 1 < stories.length) {
      setIndex(index + 1)
      return
    }
    if (ring) onSeen(ring.userId)
    nextRing()
  }, [index, stories.length, ring, onSeen, nextRing])

  const back = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1)
      return
    }
    if (ringIndex > 0) setRingIndex(ringIndex - 1)
  }, [index, ringIndex])

  /* Marca como visto assim que o story aparece. Falhar aqui não trava nada: o
     pior caso é o anel continuar aceso na próxima carga. */
  useEffect(() => {
    if (!current || current.seen) return
    void container.social.markStorySeen(current.id)
  }, [current])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') advance()
      if (event.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, back, onClose])

  if (!ring) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Stories de ${ring.name}`}
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <Progress
        count={stories.length}
        index={index}
        paused={paused || loading}
        duration={current?.kind === 'video' ? null : PHOTO_MS}
        onDone={advance}
      />

      <header className="relative z-10 flex items-center gap-3 px-4 pt-3">
        <Link to={profilePath(ring.userId)} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar name={ring.name} src={ring.avatarUrl} className="size-9" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-white">{ring.name}</span>
            {current ? (
              <span className="block text-xs text-white/70">{timeLeftLabel(current)}</span>
            ) : null}
          </span>
        </Link>

        <StoryMenu
          story={current}
          onReport={() => setReporting(true)}
          onRemoved={() => {
            setStories((list) => list.filter((item) => item.id !== current?.id))
            if (stories.length <= 1) nextRing()
          }}
        />

        <button
          type="button"
          onClick={onClose}
          className="grid size-11 shrink-0 place-items-center rounded-full text-white/80 active:bg-white/10"
        >
          <Icon name="fechar" className="size-5" strokeWidth={2.25} />
          <span className="sr-only">Fechar os stories</span>
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        {error ? (
          <p role="alert" className="grid h-full place-items-center px-8 text-center text-sm text-white/80">
            {error}
          </p>
        ) : current ? (
          <Frame
            story={current}
            paused={paused}
            onEnded={advance}
          />
        ) : loading ? (
          <span role="status" className="grid h-full place-items-center">
            <span className="sr-only">Carregando</span>
            <span
              aria-hidden="true"
              className="size-7 animate-spin rounded-full border-2 border-white/30 border-t-white"
            />
          </span>
        ) : (
          <p className="grid h-full place-items-center px-8 text-center text-sm text-white/80">
            Esses stories já expiraram.
          </p>
        )}

        {/*
          As duas metades invisíveis do toque. São `button` de verdade, com
          rótulo: quem usa leitor de tela navega por eles, e quem usa o dedo
          nem sabe que existem.
        */}
        <button
          type="button"
          onClick={back}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerCancel={() => setPaused(false)}
          className="absolute inset-y-0 left-0 w-1/3"
        >
          <span className="sr-only">Story anterior</span>
        </button>
        <button
          type="button"
          onClick={advance}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerCancel={() => setPaused(false)}
          className="absolute inset-y-0 right-0 w-2/3"
        >
          <span className="sr-only">Próximo story</span>
        </button>
      </div>

      {current?.caption ? (
        <p className="relative z-10 px-6 pb-8 pt-4 text-center text-[0.9375rem] leading-relaxed text-white drop-shadow">
          {current.caption}
        </p>
      ) : (
        <div className="pb-6" />
      )}

      <ReportSheet
        open={reporting}
        targetKind="story"
        targetId={current?.id ?? ''}
        onClose={() => setReporting(false)}
        onSent={() => setReporting(false)}
      />
    </div>,
    document.body,
  )
}

function Frame({
  story,
  paused,
  onEnded,
}: {
  readonly story: Story
  readonly paused: boolean
  readonly onEnded: () => void
}) {
  const url = useSignedUrl(story.path)
  const video = useRef<HTMLVideoElement>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    const element = video.current
    if (!element) return
    if (paused) element.pause()
    else void element.play().catch(() => undefined)
  }, [paused, url])

  if (!url) {
    return (
      <span role="status" className="grid h-full place-items-center">
        <span className="sr-only">Carregando a imagem</span>
        <span
          aria-hidden="true"
          className="size-7 animate-spin rounded-full border-2 border-white/30 border-t-white"
        />
      </span>
    )
  }

  if (broken) {
    return (
      <p className="grid h-full place-items-center px-8 text-center text-sm text-white/80">
        Não consegui abrir esse story.
      </p>
    )
  }

  if (story.kind === 'video') {
    return (
      <video
        ref={video}
        src={url}
        autoPlay
        playsInline
        onEnded={onEnded}
        onError={() => setBroken(true)}
        className="size-full object-contain"
      />
    )
  }

  return (
    <img
      src={url}
      alt={story.caption ?? 'Story'}
      onError={() => setBroken(true)}
      className="size-full object-contain"
    />
  )
}

/**
 * As barrinhas de cima.
 *
 * A que está passando anima a largura; as anteriores ficam cheias, as
 * seguintes vazias. Com `prefers-reduced-motion` a animação vira um salto
 * discreto no fim do tempo: a barra continua dizendo quantos faltam, que é a
 * informação, sem o movimento contínuo, que é o enfeite.
 */
function Progress({
  count,
  index,
  paused,
  duration,
  onDone,
}: {
  readonly count: number
  readonly index: number
  readonly paused: boolean
  /** `null` quando quem manda no tempo é o vídeo. */
  readonly duration: number | null
  readonly onDone: () => void
}) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (duration === null || paused) return
    const timer = window.setTimeout(onDone, duration)
    return () => window.clearTimeout(timer)
  }, [duration, paused, onDone, index])

  if (count === 0) return null

  return (
    <div aria-hidden="true" className="flex gap-1 px-3 pt-3">
      {Array.from({ length: count }, (_, position) => {
        const running = position === index
        /* Passado e atual ficam cheios; o atual chega lá ao longo do tempo. */
        const width = position <= index ? '100%' : '0%'
        const timed = running && duration !== null && !reduceMotion

        return (
          <span key={position} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
            <motion.span
              className="block h-full bg-white"
              initial={{ width: running ? '0%' : width }}
              animate={{ width }}
              transition={timed ? { duration: duration / 1000, ease: 'linear' } : { duration: 0 }}
            />
          </span>
        )
      })}
    </div>
  )
}

function StoryMenu({
  story,
  onReport,
  onRemoved,
}: {
  readonly story: Story | null
  readonly onReport: () => void
  readonly onRemoved: () => void
}) {
  const { profile } = useAuth()
  if (!story) return null

  const mine = profile?.id === story.userId

  if (mine) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        {/* Quantos viram, e só pro dono: a RLS de `story_views` não devolve
            isso pra mais ninguém. */}
        <span className="flex items-center gap-1.5 rounded-full px-2 text-xs text-white/70 tabular">
          <Icon name="visivel" className="size-4" />
          {story.views}
        </span>
        <button
          type="button"
          onClick={() => {
            void container.social.removeStory(story.id).then(onRemoved)
          }}
          className="grid size-11 place-items-center rounded-full text-white/80 active:bg-white/10"
        >
          <Icon name="lixeira" className="size-4" />
          <span className="sr-only">Apagar este story</span>
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onReport}
      className={cn('grid size-11 shrink-0 place-items-center rounded-full text-white/80 active:bg-white/10')}
    >
      <Icon name="bandeira" className="size-4" />
      <span className="sr-only">Denunciar este story</span>
    </button>
  )
}
