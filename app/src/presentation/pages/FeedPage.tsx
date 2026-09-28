import { Link } from 'react-router-dom'
import { CircleMomentCard } from '@/presentation/circle/CircleMomentCard'
import { useCircle } from '@/presentation/circle/use-circle'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { usePlanner } from '@/presentation/planner/use-planner'
import { PageHeader } from './PageHeader'

/**
 * Feed.
 *
 * A pergunta desta tela é "o que as pessoas estão vivendo". A do Círculo é
 * "quem são essas pessoas". Eram a mesma página, e a lista de amigos, os
 * pedidos e a busca dividiam a rolagem com o conteúdo: numa tela de celular o
 * conteúdo perdia, porque ele é o que fica embaixo.
 *
 * O feed em si não mudou de regra nenhuma. Ele continua lendo o MESMO
 * `useCircle`, que continua trazendo só momentos que alguém marcou
 * explicitamente pra mostrar, de gente que aceitou amizade dos dois lados.
 * Nenhum dado novo passou a aparecer por esta tela existir.
 *
 * ## O que ainda não está aqui
 *
 * Publicação escrita pela pessoa, Stories e comentário não existem ainda: o
 * que o feed mostra hoje são os momentos que o produto registra sozinho
 * (rotina fechada, objetivo avançado, marco, review, retomada). Enquanto
 * publicar não existir de verdade, esta tela não oferece o botão de publicar:
 * um "+" que abre uma folha vazia promete um recurso e ensina que o botão não
 * funciona.
 */
export function FeedPage() {
  const circle = useCircle()
  const planner = usePlanner()

  if (circle.loading) return <LoadingBlock label="Carregando o feed" />

  const semAmigos = circle.friends.length === 0

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 lg:gap-6">
      <PageHeader
        title="Feed"
        description="Os momentos que o teu círculo decidiu mostrar."
        action={
          <Link to="/app/circulo" className="shrink-0">
            <Button variant="secondary" size="sm">
              <Icon name="jornada" className="size-4" />
              Meu círculo
            </Button>
          </Link>
        }
      />

      {circle.error ? <ErrorNote message={circle.error} /> : null}

      {/*
        Pedido esperando resposta é a única coisa nesta tela que outra pessoa
        está aguardando, então ele passa na frente do conteúdo. O gesto inteiro
        continua no Círculo: aqui é só o aviso de que ele existe.
      */}
      {circle.incoming.length > 0 ? (
        <Link
          to="/app/circulo"
          className="flex items-center gap-3 rounded-card border border-brand/40 bg-brand-dim/30 px-4 py-3 transition-colors active:bg-brand-dim/50"
        >
          <Icon name="sino" className="size-5 shrink-0 text-brand-ink" />
          <span className="min-w-0 flex-1 text-sm text-ink">
            {circle.incoming.length === 1
              ? 'Uma pessoa pediu pra entrar no teu círculo.'
              : `${circle.incoming.length} pessoas pediram pra entrar no teu círculo.`}
          </span>
          <Icon name="seta" className="size-4 shrink-0 text-ink-faint" />
        </Link>
      ) : null}

      <section aria-label="O que o teu círculo compartilhou" className="flex flex-col gap-4">
        {circle.feed.length === 0 ? (
          <EmptyState
            title={semAmigos ? 'Teu círculo ainda está vazio' : 'Nada compartilhado por enquanto'}
            description={
              semAmigos
                ? 'Busca alguém pelo nome ou pelo @ e envia um pedido. Nada seu fica visível até você marcar um momento pra mostrar.'
                : 'Teus amigos ainda não marcaram nenhum momento pra mostrar. Você também escolhe o que compartilhar, momento a momento, no teu perfil.'
            }
            action={
              <Link
                to={semAmigos ? '/app/circulo' : '/app/perfil'}
                className="text-sm font-medium text-brand-hi hover:text-brand-ink"
              >
                {semAmigos ? 'Encontrar gente' : 'Escolher o que compartilhar'}
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
    </div>
  )
}
