import type { RankedParticipant } from '@/domain/entities/challenge'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { cn } from '@/shared/lib/cn'

export interface PodiumPerson {
  readonly ranked: RankedParticipant
  readonly name: string
  readonly avatarUrl: string | null
  readonly isMe: boolean
}

/**
 * O pódio das três primeiras posições.
 *
 * A ordem na tela não é 1, 2, 3: é 2, 1, 3, com o primeiro no centro e mais
 * alto. É como um pódio é lido desde sempre, e ler a posição pelo LUGAR é mais
 * rápido do que ler pelo número, que continua ali, na medalha, pra quem
 * precisa conferir.
 *
 * Com menos de três pessoas o pódio não aparece: um degrau sozinho no meio da
 * tela é um troféu dado a quem não competiu com ninguém. A lista completa
 * abaixo cobre esse caso sem cerimônia.
 *
 * Empate mantém a mesma posição (a regra é do domínio, `rankParticipants`), e
 * por isso o pódio pode ter duas pessoas em primeiro: quem empatou está no
 * mesmo lugar, e desempatar por horário premiaria quem acordou cedo.
 */
export function ChallengePodium({ top }: { readonly top: readonly PodiumPerson[] }) {
  if (top.length < 3) return null

  const [first, second, third] = top

  return (
    <section
      aria-label="As três primeiras posições"
      className="rounded-card border border-line bg-surface px-3 pt-4 pb-3"
    >
      <ol className="flex items-end justify-center gap-2">
        {second ? <Step person={second} place={2} /> : null}
        {first ? <Step person={first} place={1} /> : null}
        {third ? <Step person={third} place={3} /> : null}
      </ol>
    </section>
  )
}

/** Altura do degrau por posição: o primeiro é o mais alto, e a diferença é visível. */
const HEIGHTS: Readonly<Record<number, string>> = {
  1: 'h-32',
  2: 'h-24',
  3: 'h-20',
}

const RINGS: Readonly<Record<number, string>> = {
  1: 'border-brand',
  2: 'border-line-hi',
  3: 'border-medal-deep',
}

const MEDALS: Readonly<Record<number, string>> = {
  1: 'bg-medal text-[#3a2a06]',
  2: 'bg-line-hi text-ink',
  3: 'bg-medal-deep text-white',
}

function Step({ person, place }: { readonly person: PodiumPerson; readonly place: number }) {
  const { ranked, name, avatarUrl, isMe } = person
  const days = ranked.progress.done

  return (
    <li className="flex w-[30%] flex-col items-center">
      {/* A coroa é só do primeiro, e é a única peça decorativa da tela. */}
      {place === 1 ? (
        <span aria-hidden="true" className="mb-1 text-xl leading-none">
          👑
        </span>
      ) : null}

      <span className="relative">
        <span
          className={cn(
            'grid place-items-center rounded-full border-2 bg-canvas',
            RINGS[place],
            place === 1 ? 'size-[4.5rem] p-1' : 'size-16 p-1',
            place === 1 && 'shadow-[0_0_24px_-6px_var(--color-brand)]',
          )}
        >
          <Avatar
            name={name}
            src={avatarUrl}
            className="size-full"
            textClassName={place === 1 ? 'text-xl' : 'text-lg'}
          />
        </span>

        <span
          aria-hidden="true"
          className={cn(
            'tabular absolute -bottom-2 left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full text-xs font-bold',
            MEDALS[place],
          )}
        >
          {place}º
        </span>
      </span>

      {/*
        Altura fixa pro bloco de texto: sem ela, um nome que quebra em duas
        linhas empurra o degrau pra baixo e o pódio deixa de ter base reta,
        que é a única coisa que faz três colunas parecerem um pódio.
      */}
      <span className="mt-4 flex h-11 w-full flex-col items-center justify-start">
        <span className="w-full truncate text-center text-sm font-semibold text-ink">{name}</span>
        <span className="tabular mt-0.5 text-xs text-ink-faint">
          {days} {days === 1 ? 'dia' : 'dias'}
        </span>
      </span>

      {/*
        O degrau. Ele é fundo, não conteúdo: mais escuro que o card e sem
        borda, pra dar a altura sem virar mais um retângulo pra ler.
      */}
      <span
        aria-hidden="true"
        className={cn(
          'mt-2 w-full rounded-t-xl',
          HEIGHTS[place],
          isMe ? 'bg-brand-dim/60' : 'bg-surface-hi',
        )}
      />
    </li>
  )
}
