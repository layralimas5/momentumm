import { useState } from 'react'
import { track } from '@/infrastructure/analytics/track'
import { ClubCard } from '@/presentation/clubs/ClubCard'
import { ClubComposer } from '@/presentation/clubs/ClubComposer'
import { useClubs } from '@/presentation/clubs/use-clubs'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { PageHeader } from './PageHeader'

/**
 * Clubes: os meus em cima, os que dá pra descobrir embaixo.
 *
 * A ordem responde a pergunta na velocidade em que ela é feita. Quem já está
 * em algum abre a tela pra voltar pra lá; quem não está em nenhum precisa
 * encontrar o primeiro — e por isso a descoberta existe mesmo quando a lista
 * de cima está vazia, em vez de um estado vazio que só oferece criar.
 *
 * O botão de criar aparece pra todo mundo, inclusive no gratuito. Escondê-lo
 * de quem não assina ensinaria que aquilo não é pra ela; o convite ao PRO mora
 * um toque adiante, depois de ela ver o que o recurso é.
 */
export function ClubsPage() {
  const clubs = useClubs()
  const [composing, setComposing] = useState(false)

  const open = () => {
    if (!clubs.canCreate) track('club_creation_paywall_viewed', 'desafios')
    setComposing(true)
  }

  if (clubs.loading) return <LoadingBlock label="Carregando os clubes" />

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 lg:gap-6">
      <PageHeader
        title="Clubes"
        description="Gente com o mesmo objetivo, acompanhando o progresso junto."
        action={
          <Button size="sm" onClick={open}>
            <Icon name="mais" className="size-4" />
            Criar clube
          </Button>
        }
      />

      {clubs.error ? <ErrorNote message={clubs.error} onRetry={() => void clubs.reload()} /> : null}

      <section aria-labelledby="meus-clubes" className="flex flex-col gap-3">
        <h2 id="meus-clubes" className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
          Meus clubes
        </h2>

        {clubs.mine.length === 0 ? (
          <EmptyState
            title="Você ainda não está em nenhum clube"
            description="Entre num aberto aqui embaixo pra ver como funciona, ou crie o seu."
          />
        ) : (
          clubs.mine.map((club) => (
            <ClubCard key={club.id} club={club} to={`/app/clubes/${club.id}`} />
          ))
        )}
      </section>

      <section aria-labelledby="descobrir" className="flex flex-col gap-3">
        <h2 id="descobrir" className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
          Descobrir
        </h2>

        {clubs.discover.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nenhum clube aberto por enquanto. Os clubes por convite não aparecem aqui — e é essa a
            diferença entre os dois.
          </p>
        ) : (
          clubs.discover.map((club) => (
            <ClubCard
              key={club.id}
              club={club}
              to={`/app/clubes/${club.id}`}
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={clubs.acting}
                  onClick={() => void clubs.join(club.id)}
                >
                  Entrar
                </Button>
              }
            />
          ))
        )}
      </section>

      <ClubComposer
        open={composing}
        canCreate={clubs.canCreate}
        onClose={() => setComposing(false)}
        onCreate={clubs.create}
      />
    </div>
  )
}
