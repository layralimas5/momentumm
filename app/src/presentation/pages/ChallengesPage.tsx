import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { describeChallenge } from '@/domain/entities/challenge'
import { ChallengeCard } from '@/presentation/challenges/ChallengeCard'
import { ChallengeDialog } from '@/presentation/challenges/ChallengeDialog'
import { useChallenges } from '@/presentation/challenges/use-challenges'
import { Button } from '@/presentation/components/ui/Button'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel, PanelHeader } from '@/presentation/components/ui/Surface'
import { usePlanner } from '@/presentation/planner/use-planner'
import { PageHeader } from './PageHeader'

/**
 * Desafios.
 *
 * A ordem da página segue a urgência, como no Círculo: convite esperando
 * resposta primeiro — é a única coisa aqui que outra pessoa está aguardando —,
 * depois o que está rodando, e por último o que já terminou.
 *
 * Não existe lista de desafios pra descobrir, sugestão de desafio popular nem
 * contagem de participantes de desafio alheio. Desafio aqui nasce de um
 * convite entre duas pessoas que já são amigas.
 */
export function ChallengesPage() {
  const challenges = useChallenges()
  const planner = usePlanner()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  if (challenges.loading) return <LoadingBlock label="Carregando teus desafios" />

  const nothing =
    challenges.active.length === 0 &&
    challenges.invites.length === 0 &&
    challenges.finished.length === 0

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:gap-6">
      <PageHeader
        title="Desafios"
        description="Combinados curtos com quem já está no teu círculo. Privados, e medidos pelo que você já faz."
        action={<Button onClick={() => setCreating(true)}>Criar desafio</Button>}
      />

      {challenges.error ? <ErrorNote message={challenges.error} /> : null}

      {challenges.invites.length > 0 ? (
        <Panel tone="brand">
          <PanelHeader
            title={challenges.invites.length === 1 ? 'Um convite esperando' : 'Convites esperando'}
            icon="sino"
          />
          <ul className="mt-4 flex flex-col gap-3">
            {challenges.invites.map((view) => {
              const owner = challenges.personOf(view.challenge.ownerId)
              return (
                <li
                  key={view.challenge.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface/60 px-3.5 py-3"
                >
                  <Avatar
                    name={owner?.name ?? 'Alguém'}
                    src={owner?.avatarUrl ?? null}
                    className="size-10"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {view.challenge.name}
                    </span>
                    <span className="block truncate text-xs text-ink-faint">
                      {owner ? `${owner.name.split(' ')[0]} chamou você · ` : ''}
                      {describeChallenge(view.challenge, null)}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      disabled={challenges.acting}
                      onClick={() => {
                        if (view.me) void challenges.respond(view.me.id, true)
                      }}
                    >
                      Topar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={challenges.acting}
                      onClick={() => {
                        if (view.me) void challenges.respond(view.me.id, false)
                      }}
                    >
                      Agora não
                    </Button>
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>
      ) : null}

      {nothing ? (
        <EmptyState
          title="Nenhum desafio por aqui"
          description="Um desafio é um combinado curto: treinar 20 dias no mês, ler 30 minutos por dia. Ele conta pelo hábito que você já tem, então não vira uma segunda lista pra cumprir."
          action={<Button onClick={() => setCreating(true)}>Criar o primeiro</Button>}
        />
      ) : null}

      {challenges.active.length > 0 ? (
        <section aria-label="Desafios em andamento" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
            Em andamento
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {challenges.active.map((view) => (
              <ChallengeCard key={view.challenge.id} view={view} today={planner.today} />
            ))}
          </div>
        </section>
      ) : null}

      {challenges.finished.length > 0 ? (
        <section aria-label="Desafios encerrados" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
            Encerrados
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {challenges.finished.map((view) => (
              <ChallengeCard key={view.challenge.id} view={view} today={planner.today} />
            ))}
          </div>
        </section>
      ) : null}

      <ChallengeDialog
        open={creating}
        challenges={challenges}
        onClose={() => setCreating(false)}
        onCreated={(id) => navigate(`/app/desafios/${id}`)}
      />
    </div>
  )
}
