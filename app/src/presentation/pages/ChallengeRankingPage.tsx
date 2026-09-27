import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { requiredDays } from '@/domain/entities/challenge'
import { challengeShareEvent } from '@/domain/share/journey-event-builders'
import { track } from '@/infrastructure/analytics/track'
import { useAuth } from '@/presentation/auth/use-auth'
import { ChallengePodium, type PodiumPerson } from '@/presentation/challenges/ChallengePodium'
import { useChallenges } from '@/presentation/challenges/use-challenges'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { usePlanner } from '@/presentation/planner/use-planner'
import { useDashboard } from '@/presentation/planner/use-dashboard'
import { useShareStudio } from '@/presentation/share/ShareStudioProvider'
import { cn } from '@/shared/lib/cn'

/**
 * O ranking do desafio, em tela cheia.
 *
 * Ele existia como uma lista dentro da página do desafio, abaixo das regras e
 * do progresso — e é a parte que as pessoas abrem o app pra ver. Aqui ele tem a
 * tela inteira: pódio em cima, classificação completa embaixo.
 *
 * ## O que é comparado, e o que nunca será
 *
 * Só o DIA CUMPRIDO, que é o número que as pessoas combinaram entre si. Nada de
 * Momentumm, constância, volume ou XP: score é a comparação de alguém com ela
 * mesma, e transportá-lo pra uma tabela entre amigos é exatamente o ranking que
 * este produto recusa. Pela mesma razão, ninguém vê aqui o que a outra pessoa
 * faz — o dia cumprido chega publicado, e o que há por trás dele continua sendo
 * assunto de quem cumpriu.
 *
 * A sua linha é destacada e o pódio só aparece com três pessoas ou mais. Um
 * pódio de dois é um retrato de quem ganhou de uma pessoa só.
 */
export function ChallengeRankingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const challenges = useChallenges()
  const planner = usePlanner()
  const dashboard = useDashboard()
  const share = useShareStudio()

  const view = id ? challenges.viewOf(id) : null

  /*
    Uma marcação por abertura, com quantas pessoas estavam na tabela. É o que
    responde se o ranking é olhado de verdade — e se ele é olhado mais quando
    há mais gente dentro, que é a pergunta por trás de crescer o grupo.
  */
  useEffect(() => {
    if (view) track('friend_ranking_viewed', 'desafios', { count: view.people })
  }, [view?.challenge.id, view?.people])

  /*
    Cada linha do ranking com o nome e a foto de quem é. A busca por pessoa é
    feita uma vez aqui, e não dentro do desenho de cada linha: com dez
    participantes seriam dez buscas por render, e a lista redesenha a cada dia
    marcado por qualquer um.
  */
  const people = useMemo<PodiumPerson[]>(() => {
    if (!view) return []

    return view.ranking.map((ranked) => {
      const isMe = ranked.progress.participant.userId === user?.id
      const person = challenges.personOf(ranked.progress.participant.userId)
      /*
        O seu nome é o SEU nome, e o "(Você)" vem depois dele na lista. A busca
        por pessoa não devolve a própria conta — ela serve pra dar nome aos
        outros —, e sem este cuidado a linha saía como "Você (Você)".
      */
      return {
        ranked,
        isMe,
        name: isMe ? (profile?.name ?? 'Você') : (person?.name ?? 'Alguém do círculo'),
        avatarUrl: isMe ? (profile?.avatarUrl ?? null) : (person?.avatarUrl ?? null),
      }
    })
  }, [view, user?.id, profile, challenges])

  if (challenges.loading) return <LoadingBlock label="Carregando o ranking" />

  if (!view) {
    return (
      <ErrorNote
        message="Esse desafio não existe mais ou você saiu dele."
        onRetry={() => navigate('/app/desafios')}
      />
    )
  }

  const close = () => navigate(`/app/desafios/${view.challenge.id}`)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header className="flex items-center gap-3">
        <RoundButton icon="fechar" label="Fechar o ranking" onClick={close} />

        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-xl leading-tight font-bold tracking-tight text-ink">Ranking</h1>
          <p className="mt-0.5 truncate text-sm text-ink-faint">{view.challenge.name}</p>
        </div>

        {user && view.progress ? (
          <RoundButton
            icon="compartilhar"
            label="Compartilhar o ranking"
            onClick={() =>
              share.open(
                challengeShareEvent({
                  userId: user.id,
                  today: planner.today,
                  challengeId: view.challenge.id,
                  name: view.challenge.name,
                  axis: view.challenge.axis,
                  doneDays: view.progress?.done ?? 0,
                  requiredDays: requiredDays(view.challenge),
                  people: view.people,
                  momentum: dashboard.momentum,
                }),
              )
            }
          />
        ) : (
          <span className="size-11 shrink-0" />
        )}
      </header>

      <ChallengePodium top={people.slice(0, 3)} />

      <section aria-labelledby="ranking-completo">
        <h2 id="ranking-completo" className="text-lg font-bold tracking-tight text-ink">
          Ranking completo
        </h2>

        <ol className="mt-3 overflow-hidden rounded-card border border-line bg-surface">
          {people.map((person, index) => (
            <li
              key={person.ranked.progress.participant.id}
              className={cn(
                'flex items-center gap-3 px-3.5 py-3',
                index > 0 && 'border-t border-line',
                // A sua linha acende. Sem isso, achar-se numa lista de dez
                // pessoas exige ler nome por nome.
                person.isMe && 'bg-brand-dim/25 ring-1 ring-brand/60 ring-inset',
              )}
            >
              <span
                className={cn(
                  'tabular w-6 shrink-0 text-center text-base font-semibold',
                  person.isMe ? 'text-brand-hi' : 'text-ink-faint',
                )}
              >
                {person.ranked.position}
              </span>

              <span
                className={cn(
                  'grid shrink-0 place-items-center rounded-full border-2 p-0.5',
                  ringOf(person.ranked.position, person.isMe),
                )}
              >
                <Avatar name={person.name} src={person.avatarUrl} className="size-9" />
              </span>

              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {person.name}
                {person.isMe ? (
                  <span className="font-semibold text-brand-hi"> (Você)</span>
                ) : null}
              </span>

              <span
                className={cn(
                  'tabular shrink-0 text-sm',
                  person.isMe ? 'font-semibold text-ink' : 'text-ink-muted',
                )}
              >
                {person.ranked.progress.done}{' '}
                {person.ranked.progress.done === 1 ? 'dia' : 'dias'}
              </span>
            </li>
          ))}
        </ol>

        {/*
          O que o número quer dizer. Sem esta linha, "42 dias" num desafio de 90
          parece um total absoluto, e não o quanto falta.
        */}
        <p className="mt-3 px-1 text-sm text-ink-faint">
          Dias cumpridos de {requiredDays(view.challenge)} combinados. Ninguém vê o que o outro
          fez — só que fez.
        </p>
      </section>
    </div>
  )
}

/** Anel do avatar por posição: ouro, prata, bronze, e o roxo pra você. */
function ringOf(position: number, isMe: boolean): string {
  if (isMe) return 'border-brand'
  if (position === 1) return 'border-medal'
  if (position === 2) return 'border-line-hi'
  if (position === 3) return 'border-medal-deep'
  return 'border-transparent'
}

function RoundButton({
  icon,
  label,
  onClick,
}: {
  readonly icon: 'fechar' | 'compartilhar'
  readonly label: string
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-muted transition-colors active:bg-surface-hi"
    >
      <Icon name={icon} className="size-5" />
      <span className="sr-only">{label}</span>
    </button>
  )
}
