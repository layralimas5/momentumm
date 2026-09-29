import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import type { Profile } from '@/domain/entities/profile'
import { canSeeContent, isClosedProfile, NO_FOLLOW_STATE, type FollowState } from '@/domain/entities/social-graph'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { FollowButton } from '@/presentation/social/FollowButton'
import { FollowListSheet } from '@/presentation/social/FollowListSheet'
import { ProfileJourney } from '@/presentation/social/ProfileJourney'
import { ReportSheet } from '@/presentation/social/ReportSheet'
import { SocialStats } from '@/presentation/social/SocialStats'
import { useSocialNotify } from '@/presentation/social/PostComposerProvider'
import { usePlanner } from '@/presentation/planner/use-planner'
import { toUserMessage } from '@/shared/errors'

const NO_MOVED_DAYS = new Set<never>()

/**
 * O perfil de outra pessoa.
 *
 * É o lado público do mesmo perfil que a pessoa vê em `/app/perfil`, e a
 * diferença não é de layout, é de CONTEÚDO: aqui não entram momentum,
 * constância, objetivos ativos, conquistas nem nada que a pessoa não escolheu
 * mostrar. O que aparece é o cartão (nome, @, bio), os três números e a
 * jornada — calendário e publicações — e mesmo isso só quando o perfil permite.
 *
 * ## Fechado é um estado, não um erro
 *
 * Perfil fechado mostra o cabeçalho inteiro e explica por que a jornada não
 * está ali. Uma tela de erro diria que alguma coisa quebrou; o que está
 * acontecendo é a regra funcionando.
 *
 * O servidor decide de verdade: mesmo que esta tela erre e desenhe a grade, a
 * RLS devolve zero linhas. O `canSeeContent` daqui serve pra ESCOLHER a tela,
 * não pra proteger o dado.
 */
export function PublicProfilePage() {
  const { id = '' } = useParams<{ id: string }>()
  const { profile: me } = useAuth()
  const planner = usePlanner()
  const { notify, warn } = useSocialNotify()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [follow, setFollow] = useState<FollowState>(NO_FOLLOW_STATE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [listKind, setListKind] = useState<'seguidores' | 'seguindo' | null>(null)

  useEffect(() => {
    if (!id) return

    let alive = true
    setLoading(true)
    setError(null)

    void Promise.all([container.profiles.findById(id), container.social.followState(id)])
      .then(([found, state]) => {
        if (!alive) return
        setProfile(found)
        setFollow(state)
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
  }, [id])

  /* O próprio perfil tem tela própria, com edição e os números da evolução. */
  if (me && me.id === id) return <Navigate to="/app/perfil" replace />

  if (loading) return <LoadingBlock label="Carregando o perfil" />

  if (error) return <ErrorNote message={error} />

  if (!profile) {
    return (
      <EmptyState
        title="Perfil não encontrado"
        description="Essa conta não existe mais, ou o endereço está errado."
      />
    )
  }

  const closed = isClosedProfile(profile.visibility)
  const canSee = canSeeContent(profile.visibility, follow, false)

  const block = async () => {
    try {
      await container.social.block(profile.id)
      setFollow({ ...NO_FOLLOW_STATE, blocked: true })
      setMenuOpen(false)
      notify(`${profile.name} foi bloqueada.`)
    } catch (cause) {
      warn(toUserMessage(cause))
    }
  }

  const unblock = async () => {
    try {
      await container.social.unblock(profile.id)
      setFollow(await container.social.followState(profile.id))
      setMenuOpen(false)
      notify(`${profile.name} foi desbloqueada.`)
    } catch (cause) {
      warn(toUserMessage(cause))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <Avatar
            name={profile.name}
            src={profile.avatarUrl}
            className="size-20"
            textClassName="text-xl"
          />

          <div className="min-w-0 flex-1 pt-1">
            <h1 className="truncate text-lg font-semibold tracking-tight text-ink">
              {profile.name}
            </h1>
            <p className="truncate text-sm text-ink-faint">@{profile.handle}</p>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink-faint transition-colors active:bg-surface-hi"
          >
            <Icon name="maisOpcoes" className="size-5" strokeWidth={2.5} />
            <span className="sr-only">Opções do perfil</span>
          </button>
        </div>

        {profile.bio ? (
          <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink-muted">
            {profile.bio}
          </p>
        ) : null}

        <SocialStats
          userId={profile.id}
          onOpenFollowers={canSee ? () => setListKind('seguidores') : undefined}
          onOpenFollowing={canSee ? () => setListKind('seguindo') : undefined}
        />

        <FollowButton
          userId={profile.id}
          closedProfile={closed}
          onChange={setFollow}
        />
      </header>

      {follow.blocked ? (
        <EmptyState
          title="Você bloqueou esta pessoa"
          description="Vocês não veem o conteúdo um do outro. Dá pra desfazer pelo menu aqui em cima."
        />
      ) : canSee ? (
        <ProfileJourney
          userId={profile.id}
          today={planner.today}
          /* Movimento vem do planner, e o planner é o meu. O calendário de
             outra pessoa mostra o que ela publicou, nunca a rotina dela. */
          movedDays={NO_MOVED_DAYS}
          owner={false}
        />
      ) : (
        <EmptyState
          title="Este perfil é fechado"
          description={
            follow.requested
              ? 'Teu pedido está esperando resposta. Quando for aceito, a jornada dessa pessoa aparece aqui.'
              : 'Pra ver as publicações e o calendário, manda um pedido pra acompanhar.'
          }
        />
      )}

      <BottomSheet open={menuOpen} title={profile.name} onClose={() => setMenuOpen(false)}>
        <div className="flex flex-col gap-1">
          <SheetAction
            icon={<Icon name="bandeira" className="size-5" />}
            label="Denunciar perfil"
            hint="A gente revisa. Ninguém fica sabendo que foi você"
            onClick={() => setReporting(true)}
          />
          {follow.blocked ? (
            <SheetAction
              icon={<Icon name="visivel" className="size-5" />}
              label="Desbloquear"
              hint="Vocês voltam a poder se ver"
              onClick={() => void unblock()}
            />
          ) : (
            <SheetAction
              icon={<Icon name="bloquear" className="size-5" />}
              label="Bloquear"
              hint="Vocês param de se ver por aqui"
              tone="danger"
              onClick={() => setBlocking(true)}
            />
          )}
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={blocking}
        title={`Bloquear ${profile.name}?`}
        description="Vocês param de ver o conteúdo um do outro, e quem seguia quem deixa de seguir. Dá pra desfazer depois."
        confirmLabel="Bloquear"
        destructive
        onConfirm={() => void block()}
        onClose={() => setBlocking(false)}
      />

      <ReportSheet
        open={reporting}
        targetKind="pessoa"
        targetId={profile.id}
        onClose={() => setReporting(false)}
        onSent={() => {
          setReporting(false)
          setMenuOpen(false)
          notify('Denúncia enviada. Obrigada por avisar.')
        }}
      />

      {listKind ? (
        <FollowListSheet
          open
          userId={profile.id}
          kind={listKind}
          onClose={() => setListKind(null)}
        />
      ) : null}
    </div>
  )
}
