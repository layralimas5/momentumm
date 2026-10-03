import { useState } from 'react'
import type { StoryRing } from '@/domain/entities/story'
import { StreakBadge } from '@/presentation/components/ds/Badges'
import { usePlanner } from '@/presentation/planner/use-planner'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { usePostComposer } from './PostComposerProvider'
import { StoryViewer } from './StoryViewer'
import { useStoryTray } from './use-stories'

/**
 * A tira de stories, logo abaixo do cabeçalho do Feed.
 *
 * O primeiro item é SEMPRE a pessoa: com story no ar ele abre o dela, sem
 * story ele é o "+" de adicionar. É a posição que todo mundo já procura, e
 * fixá-la significa que o gesto não muda conforme os amigos postam.
 *
 * ## O anel
 *
 * Aro em cor de marca quando há story não visto, aro apagado quando já foi
 * visto, nenhum aro no botão de adicionar. Só a cor não bastaria (ela some no
 * sol e some no daltonismo), então o estado também vai no rótulo do leitor de
 * tela, em palavra.
 *
 * ## Quando ela não existe
 *
 * Sem ninguém com story no ar, a tira mostra só o próprio "+". Uma tira vazia
 * com uma frase explicando por que está vazia ocuparia a primeira dobra do
 * feed pra dizer que não há nada — e o que tem que ocupar a primeira dobra é o
 * conteúdo.
 */
export function StoriesTray() {
  const composer = usePostComposer()
  const planner = usePlanner()
  const tray = useStoryTray()
  const [openAt, setOpenAt] = useState<number | null>(null)

  /* A ordem de navegação do visualizador: eu primeiro, depois os outros. */
  const order: readonly StoryRing[] = tray.mine ? [tray.mine, ...tray.rings] : tray.rings

  if (tray.loading) {
    return (
      <div aria-hidden="true" className="flex gap-4 overflow-hidden py-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className="size-[4.5rem] shrink-0 animate-pulse rounded-full bg-surface-hi" />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="-mx-4 flex snap-x gap-3.5 overflow-x-auto px-4 pt-1 pb-2 no-scrollbar sm:-mx-6 sm:px-6">
        {/* "+ Provar": publicar a prova do dia é a primeira bolinha, sempre. */}
        <div className="flex w-[4.5rem] shrink-0 snap-start flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => composer.openStory()}
            className="well press grid size-[4.5rem] place-items-center rounded-full text-brand-hi"
          >
            <Icon name="camera" className="size-6" />
            <span className="sr-only">Provar: publicar um story do que você fez</span>
          </button>
          <span aria-hidden="true" className="text-xs font-medium text-ink-muted">
            + Provar
          </span>
        </div>

        {tray.mine ? (
          <Ring ring={tray.mine} label="Você" streak={planner.streak.current} onOpen={() => setOpenAt(0)} />
        ) : null}

        {tray.rings.map((ring, index) => (
          <Ring
            key={ring.userId}
            ring={ring}
            label={ring.name.split(' ')[0] ?? ring.name}
            onOpen={() => setOpenAt(tray.mine ? index + 1 : index)}
          />
        ))}
      </div>

      {openAt !== null ? (
        <StoryViewer rings={order} startAt={openAt} onClose={() => setOpenAt(null)} onSeen={tray.markSeen} />
      ) : null}
    </>
  )
}

function Ring({
  ring,
  label,
  streak,
  onOpen,
}: {
  readonly ring: StoryRing
  readonly label: string
  /** Só a própria sequência é conhecida aqui: a dos outros não vem no story. */
  readonly streak?: number
  readonly onOpen: () => void
}) {
  const unseen = ring.unseen > 0

  return (
    <div className="flex w-[4.5rem] shrink-0 snap-start flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'relative grid size-[4.5rem] place-items-center rounded-full p-[3px]',
          unseen ? 'bg-gradient-to-br from-brand to-brand-deep' : 'bg-line-hi',
        )}
      >
        <span className="grid size-full place-items-center rounded-full bg-surface p-[2px]">
          <Avatar name={ring.name} src={ring.avatarUrl} className="size-full" textClassName="text-base" />
        </span>
        {streak !== undefined && streak > 0 ? (
          <StreakBadge days={streak} size="sm" className="chip absolute -bottom-1.5 left-1/2 -translate-x-1/2" />
        ) : null}
        <span className="sr-only">
          {unseen ? `Ver o story de ${label}, tem coisa nova` : `Rever o story de ${label}`}
        </span>
      </button>
      <span aria-hidden="true" className="w-full truncate text-center text-xs text-ink-muted">
        {label}
      </span>
    </div>
  )
}
