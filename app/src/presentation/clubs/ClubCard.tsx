import { Link } from 'react-router-dom'
import { CLUB_CATEGORY_LABELS, type Club } from '@/domain/entities/club'
import { Icon } from '@/presentation/components/ui/Icon'
import { ProfileBanner } from '@/presentation/profile/ProfileBanner'
import { cn } from '@/shared/lib/cn'

/**
 * O clube numa linha de lista.
 *
 * A capa é a mesma peça do perfil, e não é só reaproveitamento: é ela que faz
 * dez clubes numa lista serem distinguíveis de relance, antes de qualquer
 * palavra ser lida. Sem capa, uma lista de comunidades vira uma lista de
 * títulos em cinza.
 */
export function ClubCard({
  club,
  members,
  to,
  action,
}: {
  readonly club: Club
  /** Quantas pessoas estão dentro. Omitido quando a lista não tem esse dado. */
  readonly members?: number
  readonly to: string
  /** Botão à direita, "Entrar", quando a lista é de descoberta. */
  readonly action?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'surface-card flex items-center gap-3 overflow-hidden p-0 transition-colors',
        'active:bg-surface-hi',
      )}
    >
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl">
          <ProfileBanner banner={club.cover} className="size-full" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{club.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
            <span>{CLUB_CATEGORY_LABELS[club.category]}</span>
            {members !== undefined ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular">
                  {members} {members === 1 ? 'pessoa' : 'pessoas'}
                </span>
              </>
            ) : null}
            {club.privacy === 'convite' ? (
              <>
                <span aria-hidden="true">·</span>
                <Icon name="cadeado" className="size-3" />
              </>
            ) : null}
          </span>
        </span>
      </Link>

      <span className="shrink-0 pr-3">
        {action ?? <Icon name="seta" className="size-4 text-ink-faint" />}
      </span>
    </div>
  )
}
