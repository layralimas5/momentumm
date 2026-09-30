import { CLUB_CATEGORY_LABELS } from '@/domain/entities/club'
import type { ClubInvitation } from '@/domain/entities/club-invite'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Button } from '@/presentation/components/ui/Button'
import { ProfileBanner } from '@/presentation/profile/ProfileBanner'
import { ErrorNote } from '@/presentation/components/ui/States'
import type { ClubInvitesState } from './use-club-invites'

/**
 * Os convites esperando resposta, no topo da lista de clubes.
 *
 * Duas saídas com o mesmo peso visual. "Recusar" não fica escondido num menu:
 * um convite que só oferece o sim é um convite que a pessoa fecha a tela pra
 * não responder, e aí ele fica pendurado pra sempre nos dois lados.
 */
export function ClubInviteList({
  invites,
  onAnswered,
}: {
  readonly invites: ClubInvitesState
  /** Aceitar muda a lista de clubes logo abaixo: quem a mantém recarrega. */
  readonly onAnswered?: (() => void) | undefined
}) {
  if (invites.invites.length === 0) return null

  return (
    <section aria-labelledby="convites-de-clube" className="flex flex-col gap-3">
      <h2
        id="convites-de-clube"
        className="text-sm font-semibold tracking-wide text-ink-muted uppercase"
      >
        Convites pra você
      </h2>

      {invites.error ? <ErrorNote message={invites.error} /> : null}

      {invites.invites.map((invite) => (
        <ClubInviteRow
          key={invite.id}
          invite={invite}
          busy={invites.answering !== null}
          answering={invites.answering === invite.id}
          onRespond={(accept) => {
            void invites.respond(invite.id, accept).then(() => onAnswered?.())
          }}
        />
      ))}
    </section>
  )
}

function ClubInviteRow({
  invite,
  busy,
  answering,
  onRespond,
}: {
  readonly invite: ClubInvitation
  readonly busy: boolean
  readonly answering: boolean
  readonly onRespond: (accept: boolean) => void
}) {
  return (
    <article className="surface-card overflow-hidden p-0">
      <div className="flex items-center gap-3 p-3">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl">
          <ProfileBanner banner={invite.clubCover} className="size-full" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{invite.clubName}</p>
          <p className="mt-0.5 truncate text-xs text-ink-faint">
            {CLUB_CATEGORY_LABELS[invite.clubCategory]}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <Avatar
              name={invite.inviterName}
              src={invite.inviterAvatar}
              className="size-5 text-[0.625rem]"
            />
            <span className="truncate">{invite.inviterName} te chamou</span>
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-t border-line px-3 py-2.5">
        <Button size="sm" loading={answering} disabled={busy} onClick={() => onRespond(true)}>
          Entrar no clube
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onRespond(false)}>
          Recusar
        </Button>
      </div>
    </article>
  )
}
