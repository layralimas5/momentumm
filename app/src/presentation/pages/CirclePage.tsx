import { Link } from 'react-router-dom'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel, PanelHeader } from '@/presentation/components/ui/Surface'
import { CircleMomentCard } from '@/presentation/circle/CircleMomentCard'
import { FriendSearch } from '@/presentation/circle/FriendSearch'
import { useCircle, type CirclePerson } from '@/presentation/circle/use-circle'
import { usePlanner } from '@/presentation/planner/use-planner'
import { useState } from 'react'
import { PageHeader } from './PageHeader'

/**
 * Círculo.
 *
 * O oposto de um feed genérico: só entra quem foi aceito dos dois lados, e só
 * aparece o que a pessoa marcou explicitamente pra mostrar. Sem seguidor, sem
 * sugestão de quem seguir, sem contagem de audiência e sem comentário — o
 * único gesto é o apoio.
 *
 * A ordem da página segue a urgência: pedido esperando resposta primeiro (é a
 * única coisa aqui que outra pessoa está aguardando), depois o que os amigos
 * compartilharam, e por último a manutenção do círculo — buscar e listar.
 */
export function CirclePage() {
  const circle = useCircle()
  const planner = usePlanner()
  const [removing, setRemoving] = useState<CirclePerson | null>(null)

  if (circle.loading) return <LoadingBlock label="Carregando teu círculo" />

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:gap-6">
      <PageHeader
        title="Círculo"
        description="As pessoas que você escolheu acompanhar, e só o que elas decidiram mostrar."
      />

      {circle.error ? <ErrorNote message={circle.error} /> : null}

      {circle.incoming.length > 0 ? (
        <Panel tone="brand">
          <PanelHeader
            title={circle.incoming.length === 1 ? 'Um pedido esperando' : 'Pedidos esperando'}
            icon="sino"
          />
          <ul className="mt-4 flex flex-col gap-2">
            {circle.incoming.map((item) => (
              <li
                key={item.friendship.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface/60 px-3.5 py-2.5"
              >
                <Avatar name={item.person.name} src={item.person.avatarUrl} className="size-10" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {item.person.name}
                  </span>
                  <span className="block truncate text-xs text-ink-faint">
                    @{item.person.handle}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={circle.acting}
                    onClick={() => void circle.respond(item.friendship.id, true)}
                  >
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={circle.acting}
                    onClick={() => void circle.respond(item.friendship.id, false)}
                  >
                    Recusar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
        <section aria-label="O que o teu círculo compartilhou" className="flex flex-col gap-4">
          {circle.feed.length === 0 ? (
            <EmptyState
              title={
                circle.friends.length === 0
                  ? 'Teu círculo ainda está vazio'
                  : 'Nada compartilhado por enquanto'
              }
              description={
                circle.friends.length === 0
                  ? 'Busca alguém pelo nome ou pelo @ e envia um pedido. Nada seu fica visível até você marcar um momento pra mostrar.'
                  : 'Teus amigos ainda não marcaram nenhum momento pra mostrar. Você também escolhe o que compartilhar, momento a momento, no teu perfil.'
              }
              action={
                <Link
                  to="/app/perfil"
                  className="text-sm font-medium text-brand-hi hover:text-brand-ink"
                >
                  Escolher o que compartilhar
                </Link>
              }
            />
          ) : (
            circle.feed.map((item) => (
              <CircleMomentCard
                key={item.event.id}
                item={item}
                today={planner.today}
                onSupport={(eventId, supported) => void circle.support(eventId, supported)}
              />
            ))
          )}
        </section>

        <div className="flex flex-col gap-5 lg:gap-6">
          <Panel>
            <PanelHeader title="Adicionar ao círculo" icon="busca" />
            <div className="mt-4">
              <FriendSearch circle={circle} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title={`Amigos${circle.friends.length > 0 ? ` · ${circle.friends.length}` : ''}`}
              icon="jornada"
            />

            {circle.friends.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                Ninguém no círculo ainda. Amizade aqui é combinada dos dois lados.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-line">
                {circle.friends.map((item) => (
                  <li key={item.friendship.id} className="flex items-center gap-3 py-2.5">
                    <Link
                      to={`/app/circulo/${item.person.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <Avatar
                        name={item.person.name}
                        src={item.person.avatarUrl}
                        className="size-10"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {item.person.name}
                        </span>
                        <span className="block truncate text-xs text-ink-faint">
                          @{item.person.handle}
                        </span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setRemoving(item)}
                      className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-hi hover:text-ink"
                    >
                      <Icon name="fechar" className="size-4" />
                      <span className="sr-only">Remover {item.person.name} do círculo</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {circle.outgoing.length > 0 ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs tracking-wide text-ink-faint uppercase">Pedidos enviados</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {circle.outgoing.map((item) => (
                    <li key={item.friendship.id} className="flex items-center gap-3">
                      <Avatar
                        name={item.person.name}
                        src={item.person.avatarUrl}
                        className="size-8"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                        {item.person.name}
                      </span>
                      <button
                        type="button"
                        disabled={circle.acting}
                        onClick={() => void circle.remove(item.friendship.id)}
                        className="shrink-0 rounded-md px-1 text-sm text-ink-faint transition-colors hover:text-ink"
                      >
                        Cancelar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={removing !== null}
        title="Remover do círculo?"
        description={
          removing
            ? `${removing.person.name} deixa de ver o que você compartilha, e você deixa de ver o que ${removing.person.name.split(' ')[0]} compartilha. Dá pra adicionar de novo depois.`
            : ''
        }
        confirmLabel="Remover"
        onConfirm={() => {
          if (removing) void circle.remove(removing.friendship.id)
          setRemoving(null)
        }}
        onClose={() => setRemoving(null)}
      />
    </div>
  )
}
