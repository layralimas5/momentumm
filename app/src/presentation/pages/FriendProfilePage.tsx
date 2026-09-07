import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { circleFeed, type CircleFeedItem } from '@/domain/entities/circle-feed'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { CircleMomentCard } from '@/presentation/circle/CircleMomentCard'
import { useCircle } from '@/presentation/circle/use-circle'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel } from '@/presentation/components/ui/Surface'
import { usePlanner } from '@/presentation/planner/use-planner'
import { toUserMessage } from '@/shared/errors'

/**
 * O perfil de um amigo.
 *
 * Mostra o cartão de visita e os momentos que essa pessoa compartilhou. Só
 * isso.
 *
 * O que NÃO aparece aqui é a parte importante: objetivos, hábitos, notas,
 * check-ins, constância e Momentum Score. Nada disso foi compartilhado — é o
 * planejamento da vida de alguém, e o fato de vocês serem amigos não torna
 * isso público. E o Momentum fica de fora também pelo outro motivo: ele é a
 * comparação da pessoa com ela mesma, e colocá-lo lado a lado no perfil de
 * cada amigo é montar um ranking sem chamar de ranking.
 */
export function FriendProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const planner = usePlanner()
  const circle = useCircle()
  const navigate = useNavigate()

  const [items, setItems] = useState<readonly CircleFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    if (!user || !id) return
    setLoading(true)
    try {
      setItems(circleFeed(await container.journeyEvents.listByAuthor(user.id, id)))
      setError(null)
    } catch (cause) {
      setError(toUserMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [user, id])

  useEffect(() => {
    void load()
  }, [load])

  const friend = circle.friends.find((item) => item.person.id === id)

  if (circle.loading || loading) return <LoadingBlock label="Carregando o perfil" />

  /*
    Sem amizade aceita não há perfil pra mostrar. É o mesmo veredito da RLS,
    dito na tela: quem não é do círculo simplesmente não tem o que ver aqui.
  */
  if (!friend) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <BackLink />
        <EmptyState
          title="Essa pessoa não está no teu círculo"
          description="Só dá pra ver os momentos de quem aceitou o teu pedido — e de quem você aceitou."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/app/circulo')}>
              Voltar pro círculo
            </Button>
          }
        />
      </div>
    )
  }

  const { person } = friend
  const firstName = person.name.split(' ')[0] ?? person.name

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <BackLink />

      {error ? <ErrorNote message={error} /> : null}

      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar
            name={person.name}
            src={person.avatarUrl}
            className="size-16 sm:size-20"
            textClassName="text-lg sm:text-xl"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {person.name}
            </h2>
            <p className="truncate text-sm text-ink-faint">@{person.handle}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setRemoving(true)}>
            Remover do círculo
          </Button>
        </div>
      </Panel>

      <section aria-label={`Momentos de ${firstName}`} className="flex flex-col gap-4">
        {items.length === 0 ? (
          <EmptyState
            title={`${firstName} ainda não compartilhou nada`}
            description="Cada pessoa escolhe momento a momento o que mostra pro círculo. O que não foi marcado continua privado."
          />
        ) : (
          items.map((item) => (
            <CircleMomentCard
              key={item.event.id}
              item={item}
              today={planner.today}
              showAuthor={false}
              onSupport={(eventId, supported) => {
                // A lista desta tela é local, então a resposta imediata também
                // precisa ser: o hook do círculo cuida da lista dele, não desta.
                setItems((current) =>
                  current.map((entry) =>
                    entry.event.id === eventId
                      ? {
                          ...entry,
                          supportedByMe: supported,
                          supports: Math.max(0, entry.supports + (supported ? 1 : -1)),
                        }
                      : entry,
                  ),
                )
                void circle.support(eventId, supported)
              }}
            />
          ))
        )}
      </section>

      <ConfirmDialog
        open={removing}
        title="Remover do círculo?"
        description={`${person.name} deixa de ver o que você compartilha, e você deixa de ver o que ${firstName} compartilha. Dá pra adicionar de novo depois.`}
        confirmLabel="Remover"
        onConfirm={() => {
          void circle.remove(friend.friendship.id)
          navigate('/app/circulo')
        }}
        onClose={() => setRemoving(false)}
      />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/app/circulo"
      className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-ink-faint transition-colors hover:text-ink-muted"
    >
      <Icon name="setaEsq" className="size-4" />
      Círculo
    </Link>
  )
}
