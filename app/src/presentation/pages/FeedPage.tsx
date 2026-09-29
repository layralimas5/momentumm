import { Link } from 'react-router-dom'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote } from '@/presentation/components/ui/States'
import { LogoMark, Wordmark } from '@/presentation/components/brand/Logo'
import { usePlanner } from '@/presentation/planner/use-planner'
import { FeedSentinel } from '@/presentation/social/FeedSentinel'
import { PostCard } from '@/presentation/social/PostCard'
import { PostSkeleton } from '@/presentation/social/PostSkeleton'
import { StoriesTray } from '@/presentation/social/StoriesTray'
import { SuggestedProfiles } from '@/presentation/social/SuggestedProfiles'
import { useFeed } from '@/presentation/social/use-post-list'
import { useFollowRequests } from '@/presentation/social/use-follow-requests'

/**
 * Feed.
 *
 * A pergunta desta tela é "o que as pessoas que eu acompanho estão vivendo".
 * A resposta é cronológica e nada mais: não existe ordenação por engajamento,
 * porque ordenar por engajamento é montar a tabela de classificação que o
 * produto recusa (ver CLAUDE.md) sem nunca chamá-la assim.
 *
 * ## A ordem da tela
 *
 * Cabeçalho (marca, pedidos, notificações), stories, publicações. É a ordem
 * de urgência: o pedido de alguém esperando resposta vem antes do conteúdo,
 * o story vence em 24 horas e a publicação fica.
 *
 * ## O vazio
 *
 * Feed vazio é o estado NORMAL de quem acabou de chegar, não um erro. Por isso
 * ele não pede desculpa: mostra o que dá pra fazer a respeito — quem seguir,
 * gente de verdade que já publicou — e, quando não há ninguém pra sugerir,
 * convida a publicar o primeiro momento. As duas saídas são ações, não avisos.
 */
export function FeedPage() {
  const planner = usePlanner()
  const feed = useFeed()
  const requests = useFollowRequests()

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <FeedHeader pending={requests.list.length} />

      <StoriesTray />

      {feed.error ? <ErrorNote message={feed.error} onRetry={feed.reload} /> : null}

      {feed.loading ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-6">
          <span className="sr-only">Carregando o feed</span>
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : feed.posts.length === 0 ? (
        <div className="flex flex-col gap-6">
          <EmptyState
            title="Teu feed começa aqui"
            description="Quando você seguir alguém, o que essa pessoa publicar aparece nesta tela. O que você publicar aparece também, pra você conferir."
          />
          <SuggestedProfiles />
        </div>
      ) : (
        <>
          <section aria-label="Publicações" className="flex flex-col gap-6">
            {feed.posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                today={planner.today}
                onToggleLike={() => feed.toggleLike(post.id)}
                onToggleSave={() => feed.toggleSave(post.id)}
                onChanged={feed.replace}
                onRemoved={() => feed.drop(post.id)}
              />
            ))}
          </section>

          {feed.loadingMore ? <PostSkeleton /> : null}

          <FeedSentinel onReach={feed.loadMore} disabled={!feed.hasMore || feed.loadingMore} />

          {/* A reserva do sentinela: teclado e navegador sem IntersectionObserver. */}
          {feed.hasMore && !feed.loadingMore ? (
            <button
              type="button"
              onClick={feed.loadMore}
              className="min-h-11 self-center text-sm font-medium text-brand-hi"
            >
              Ver mais publicações
            </button>
          ) : (
            <p className="py-2 text-center text-sm text-ink-faint">
              Você chegou ao fim. O resto acontece fora do app.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/**
 * O cabeçalho do Feed.
 *
 * Marca à esquerda, pedidos e avisos à direita. Mensagens NÃO entram nesta
 * versão: um ícone de conversa que abre uma tela dizendo "em breve" é pior do
 * que não ter o ícone, porque ele ocupa o lugar de cima e não cumpre nada. O
 * espaço fica livre pra quando existir.
 */
function FeedHeader({ pending }: { readonly pending: number }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur-md lg:static lg:mx-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
      <LogoMark className="size-7 shrink-0 lg:hidden" />
      <Wordmark className="hidden w-32 lg:block" />
      <span className="flex-1" />

      <Link
        to="/app/circulo"
        className="relative grid size-11 place-items-center rounded-full text-ink-muted transition-colors active:bg-surface"
      >
        <Icon name="pessoas" className="size-5" />
        {pending > 0 ? (
          <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[0.625rem] font-semibold leading-4 text-white tabular">
            {pending > 9 ? '9+' : pending}
          </span>
        ) : null}
        <span className="sr-only">
          {pending > 0
            ? `Pedidos pra te seguir: ${pending} esperando resposta`
            : 'Quem te acompanha'}
        </span>
      </Link>

      {/*
        O sino leva pros ajustes de aviso, que é o que existe hoje: o lembrete
        diário no celular. Uma caixa de notificações dentro do app é outra
        tela, com estado lido/não lido e uma fila por trás, e abrir um ícone
        pra uma tela vazia seria prometer o que não há.
      */}
      <Link
        to="/app/configuracoes"
        className="grid size-11 place-items-center rounded-full text-ink-muted transition-colors active:bg-surface"
      >
        <Icon name="sino" className="size-5" />
        <span className="sr-only">Ajustes de aviso</span>
      </Link>
    </header>
  )
}
