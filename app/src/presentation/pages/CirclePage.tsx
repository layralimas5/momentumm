import { Link, useSearchParams } from 'react-router-dom'
import { CirclePeople } from '@/presentation/circle/CirclePeople'
import { ClubCard } from '@/presentation/clubs/ClubCard'
import { useClubs } from '@/presentation/clubs/use-clubs'
import { IconWell } from '@/presentation/components/ds/Card'
import { FilterPills } from '@/presentation/components/ds/Controls'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { usePlanner } from '@/presentation/planner/use-planner'
import { FeedSentinel } from '@/presentation/social/FeedSentinel'
import { PostCard } from '@/presentation/social/PostCard'
import { PostSkeleton } from '@/presentation/social/PostSkeleton'
import { StoriesTray } from '@/presentation/social/StoriesTray'
import { SuggestedProfiles } from '@/presentation/social/SuggestedProfiles'
import { useFollowRequests } from '@/presentation/social/use-follow-requests'
import { useFeed } from '@/presentation/social/use-post-list'

type CircleTab = 'feed' | 'clubes' | 'pessoas'

const TABS: readonly { readonly value: CircleTab; readonly label: string }[] = [
  { value: 'feed', label: 'Meu Círculo' },
  { value: 'clubes', label: 'Clubes' },
  { value: 'pessoas', label: 'Pessoas' },
]

/**
 * Círculo: uma comunidade de execução, não uma rede aberta. O feed valoriza a
 * conquista; clubes e pessoas são as outras duas pílulas da mesma tela.
 */
export function CirclePage() {
  const [params, setParams] = useSearchParams()
  const requests = useFollowRequests()
  const raw = params.get('aba')
  const tab: CircleTab = raw === 'clubes' || raw === 'pessoas' ? raw : 'feed'

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-center gap-2">
        <FilterPills
          label="Seção do Círculo"
          options={TABS.map((entry) => ({
            ...entry,
            label: entry.value === 'pessoas' && requests.list.length > 0 ? `Pessoas · ${requests.list.length}` : entry.label,
          }))}
          value={tab}
          onChange={(next) => setParams(next === 'feed' ? {} : { aba: next }, { replace: true })}
          className="min-w-0 flex-1"
        />
        <Link to="/app/desafios" className="chip press grid size-11 shrink-0 place-items-center rounded-full text-ink-muted">
          <Icon name="trofeu" className="size-5" />
          <span className="sr-only">Desafios e ranking</span>
        </Link>
      </div>

      {tab === 'feed' ? <CircleFeed /> : null}
      {tab === 'clubes' ? <CircleClubs /> : null}
      {tab === 'pessoas' ? <CirclePeople /> : null}
    </div>
  )
}

function CircleFeed() {
  const planner = usePlanner()
  const feed = useFeed()

  return (
    <>
      <StoriesTray />

      {feed.error ? <ErrorNote message={feed.error} onRetry={feed.reload} /> : null}

      {feed.loading ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-5">
          <span className="sr-only">Carregando o Círculo</span>
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : feed.posts.length === 0 ? (
        <div className="flex flex-col gap-5">
          <EmptyState
            title="Seu Círculo começa aqui"
            description="Quando alguém do seu círculo provar o que fez, aparece nesta tela. O que você provar aparece também."
          />
          <SuggestedProfiles />
        </div>
      ) : (
        <>
          <section aria-label="Publicações" className="flex flex-col gap-5">
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

          {feed.hasMore && !feed.loadingMore ? (
            <button type="button" onClick={feed.loadMore} className="min-h-11 self-center text-sm font-medium text-brand-hi">
              Ver mais publicações
            </button>
          ) : (
            <div className="card flex items-center gap-3.5 p-4">
              <IconWell name="escudo" />
              <div className="min-w-0">
                <p className="eyebrow text-[0.75rem] text-ink">✓ Você está em dia</p>
                <p className="mt-0.5 text-sm text-ink-faint">Você viu tudo o que o seu Círculo provou. O resto acontece fora do app.</p>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

function CircleClubs() {
  const clubs = useClubs()

  if (clubs.loading) return <LoadingBlock label="Carregando os clubes" />

  return (
    <div className="flex flex-col gap-5">
      {clubs.error ? <ErrorNote message={clubs.error} onRetry={() => void clubs.reload()} /> : null}

      <section aria-labelledby="meus-clubes" className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 id="meus-clubes" className="eyebrow text-[0.78rem] text-ink">
            Seus clubes ({clubs.mine.length})
          </h2>
          <Link to="/app/clubes" className="text-sm font-medium text-brand-hi">
            {clubs.canCreate ? 'Criar ou ver todos' : 'Ver todos'}
          </Link>
        </div>
        {clubs.mine.length === 0 ? (
          <p className="well rounded-[1.15rem] px-4 py-5 text-sm text-pretty text-ink-muted">
            Clube é um grupo com ranking em volta de uma disciplina. Entre em um abaixo ou crie o seu.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {clubs.mine.map((club) => (
              <li key={club.id}>
                <ClubCard club={club} to={`/app/clubes/${club.id}`} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {clubs.discover.length > 0 ? (
        <section aria-labelledby="descobrir-clubes" className="flex flex-col gap-3">
          <h2 id="descobrir-clubes" className="eyebrow px-1 text-[0.78rem] text-ink-muted">
            Para entrar
          </h2>
          <ul className="flex flex-col gap-3">
            {clubs.discover.map((club) => (
              <li key={club.id}>
                <ClubCard
                  club={club}
                  to={`/app/clubes/${club.id}`}
                  action={
                    <button
                      type="button"
                      disabled={clubs.acting}
                      onClick={() => void clubs.join(club.id)}
                      className="chip press rounded-full px-3.5 py-2 text-sm font-semibold text-brand-hi"
                    >
                      Entrar
                    </button>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
