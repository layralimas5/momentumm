import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FollowListKind, ProfileCard } from '@/domain/entities/social-graph'
import { container } from '@/infrastructure/container'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { EmptyState, ErrorNote } from '@/presentation/components/ui/States'
import { toUserMessage } from '@/shared/errors'
import { FollowButton } from './FollowButton'
import { profilePath } from './profile-path'

const PAGE = 30

const TITLES: Readonly<Record<FollowListKind, string>> = {
  seguidores: 'Seguidores',
  seguindo: 'Seguindo',
}

/**
 * Quem segue, e quem é seguido.
 *
 * ## A lista respeita o perfil
 *
 * Quem pode ver o PERFIL pode ver as listas dele (a regra mora em
 * `follow_list`, no servidor). Perfil fechado esconde as duas, como esconde o
 * resto — e é por isso que a folha pode dar lista vazia mesmo num perfil com
 * seguidores: a resposta honesta ali é "não dá pra ver", não um número falso.
 *
 * ## Por que ela não existia antes
 *
 * `FollowRepository` (migration 0060) não tinha método de listagem, e o
 * comentário dizia o motivo: enquanto não houvesse a tela, um método que
 * trouxesse a lista seria superfície aberta sem uso, e a pergunta "quem pode
 * ver isso" precisaria ser respondida de novo no dia em que ela aparecesse. A
 * tela existe agora, e a resposta está acima.
 */
export function FollowListSheet({
  open,
  userId,
  kind,
  onClose,
}: {
  readonly open: boolean
  readonly userId: string
  readonly kind: FollowListKind
  readonly onClose: () => void
}) {
  const [people, setPeople] = useState<readonly ProfileCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (!open) return

    let alive = true
    setLoading(true)
    setError(null)

    void container.social
      .followList(userId, kind, 0)
      .then((list) => {
        if (!alive) return
        setPeople(list)
        setHasMore(list.length === PAGE)
      })
      .catch((cause: unknown) => {
        if (alive) setError(toUserMessage(cause))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [open, userId, kind])

  const loadMore = async () => {
    try {
      const next = await container.social.followList(userId, kind, people.length)
      setPeople((current) => [...current, ...next])
      setHasMore(next.length === PAGE)
    } catch (cause) {
      setError(toUserMessage(cause))
    }
  }

  return (
    <BottomSheet open={open} title={TITLES[kind]} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {error ? <ErrorNote message={error} /> : null}

        {loading ? (
          <div role="status" aria-live="polite" className="flex flex-col gap-3">
            <span className="sr-only">Carregando</span>
            {[0, 1, 2].map((index) => (
              <span key={index} aria-hidden="true" className="h-14 animate-pulse rounded-xl bg-surface-hi" />
            ))}
          </div>
        ) : people.length === 0 ? (
          <EmptyState
            title={kind === 'seguidores' ? 'Ninguém ainda' : 'Não segue ninguém ainda'}
            description={
              kind === 'seguidores'
                ? 'Quem começar a acompanhar aparece aqui.'
                : 'Quando essa lista tiver gente, ela aparece aqui.'
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {people.map((person) => (
              <li key={person.id} className="flex items-center gap-3 py-2.5">
                <Link
                  to={profilePath(person.id)}
                  onClick={onClose}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <Avatar name={person.name} src={person.avatarUrl} className="size-11" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{person.name}</span>
                    <span className="block truncate text-xs text-ink-faint">@{person.handle}</span>
                  </span>
                </Link>
                <FollowButton userId={person.id} size="sm" />
              </li>
            ))}
          </ul>
        )}

        {hasMore ? (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="min-h-11 self-center text-sm font-medium text-brand-hi"
          >
            Ver mais
          </button>
        ) : null}
      </div>
    </BottomSheet>
  )
}
