import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  canAdminister,
  CLUB_CATEGORY_LABELS,
  CLUB_PRIVACY_LABELS,
  isClubRunning,
  type Club,
  type ClubMember,
  type ClubRankedMember,
} from '@/domain/entities/club'
import { isPro } from '@/domain/entities/plan'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, Tag } from '@/presentation/components/ui/Surface'
import { ClubInviteSheet } from '@/presentation/clubs/ClubInviteSheet'
import { ProfileBanner } from '@/presentation/profile/ProfileBanner'
import { toUserMessage } from '@/shared/errors'
import { cn } from '@/shared/lib/cn'

/**
 * O clube por dentro: capa, quem está e o ranking.
 *
 * O ranking soma os dias cumpridos nos desafios DESTE clube, e só isso
 * atravessa a fronteira. Nenhum hábito, nenhuma ação, nenhum registro de
 * ninguém: o número que cada pessoa publica ao entrar num desafio é tudo o que
 * o clube enxerga dela.
 *
 * ## O dono sem assinatura
 *
 * Se o PRO cair, o clube continua inteiro pra todo mundo. O dono deixa de
 * administrar, não edita, não arquiva, não convida, e é avisado disso no
 * topo, com o caminho de volta. Nada é apagado e ninguém é expulso: destruir a
 * comunidade de um grupo por causa de um boleto seria cobrar de terceiros uma
 * dívida que não é deles.
 */
export function ClubDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [club, setClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<readonly ClubMember[]>([])
  const [ranking, setRanking] = useState<readonly ClubRankedMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      const found = await container.clubs.findById(id)
      setClub(found)
      if (!found) return

      const [pessoas, tabela] = await Promise.all([
        container.clubs.listMembers(id),
        container.clubs.ranking(id).catch(() => []),
      ])
      setMembers(pessoas)
      setRanking(tabela)
    } catch (cause) {
      setError(toUserMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (club) track('club_ranking_viewed', 'desafios', { count: members.length })
  }, [club?.id, members.length])

  if (loading) return <LoadingBlock label="Abrindo o clube" />

  if (!club) {
    return (
      <ErrorNote
        message="Esse clube não existe ou não está aberto pra você."
        onRetry={() => navigate('/app/clubes')}
      />
    )
  }

  const sou = members.some((member) => member.userId === user?.id)
  const dono = club.ownerId === user?.id
  const administra = canAdminister(club, user?.id ?? null, profile ? isPro(profile.plan) : false)

  const sair = async () => {
    if (!user) return
    setLeaving(false)
    try {
      await container.clubs.leave(club.id, user.id)
      track('club_left', 'desafios')
      navigate('/app/clubes')
    } catch (cause) {
      setError(toUserMessage(cause))
    }
  }

  const entrar = async () => {
    if (!user) return
    try {
      await container.clubs.join(club.id, user.id)
      track('club_joined', 'desafios')
      await load()
    } catch (cause) {
      setError(toUserMessage(cause))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {error ? <ErrorNote message={error} /> : null}

      <Panel flush>
        <ProfileBanner banner={club.cover} className="h-28 sm:h-36" />
        <div className="p-5">
          <h1 className="text-xl leading-tight font-bold tracking-tight text-balance text-ink">
            {club.name}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Tag>{CLUB_CATEGORY_LABELS[club.category]}</Tag>
            <Tag tone={club.privacy === 'aberto' ? 'positive' : 'neutral'}>
              {CLUB_PRIVACY_LABELS[club.privacy]}
            </Tag>
            <span className="tabular text-sm text-ink-faint">
              {members.length} {members.length === 1 ? 'pessoa' : 'pessoas'}
            </span>
          </div>

          {club.description ? (
            <p className="mt-3 text-sm text-pretty text-ink-muted">{club.description}</p>
          ) : null}

          {!isClubRunning(club) ? (
            <p className="mt-4 rounded-xl border border-line bg-surface-hi/60 px-3.5 py-3 text-sm text-ink-muted">
              Este clube foi arquivado. O histórico continua aqui, e ninguém foi removido.
            </p>
          ) : null}

          {/*
            O dono que perdeu a assinatura. O aviso é pra ele e só pra ele: os
            membros não precisam saber da vida financeira de ninguém, e o clube
            funciona igual pra eles.
          */}
          {dono && !administra && isClubRunning(club) ? (
            <div className="mt-4 rounded-xl border border-brand/30 bg-brand-dim/30 px-3.5 py-3">
              <p className="text-sm font-medium text-ink">
                Seu clube continua no ar, a administração é que está pausada.
              </p>
              <p className="mt-1 text-sm text-pretty text-ink-muted">
                Ninguém foi removido e nada foi apagado. Com o PRO de volta, você edita, convida e
                arquiva como antes.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  track('club_creation_upgrade_clicked', 'desafios')
                  navigate('/app/assinatura')
                }}
              >
                Voltar pro PRO
              </Button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {/*
              Chamar gente vem antes de sair: é a ação que faz o clube existir,
              e ela é do dono. Quem perdeu a assinatura não vê o botão, a
              política recusaria a escrita de qualquer forma.
            */}
            {administra ? (
              <Button size="sm" onClick={() => setInviting(true)}>
                <Icon name="mais" className="size-4" />
                Chamar gente
              </Button>
            ) : null}

            {sou ? (
              <Button variant="secondary" size="sm" onClick={() => setLeaving(true)}>
                <Icon name="saida" className="size-4" />
                Sair do clube
              </Button>
            ) : club.privacy === 'aberto' && isClubRunning(club) ? (
              <Button size="sm" onClick={() => void entrar()}>
                Entrar no clube
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Ranking do clube"
          icon="trofeu"
          hint="Dias cumpridos nos desafios daqui. Ninguém vê o que o outro fez, só que fez."
        />

        {ranking.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            Ainda não há desafio deste clube com dias cumpridos. Quando houver, a tabela aparece
            sozinha.
          </p>
        ) : (
          <ol className="mt-4 flex flex-col divide-y divide-line">
            {ranking.map((row) => {
              const eu = row.userId === user?.id
              return (
                <li key={row.userId} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      'tabular w-5 shrink-0 text-sm font-semibold',
                      eu ? 'text-brand-hi' : 'text-ink-faint',
                    )}
                  >
                    {row.position}
                  </span>
                  <Avatar name={row.name} src={row.avatarUrl} className="size-9" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {row.name}
                    {eu ? <span className="font-semibold text-brand-hi"> (Você)</span> : null}
                  </span>
                  <span className="tabular shrink-0 text-sm text-ink-muted">
                    {row.days} {row.days === 1 ? 'dia' : 'dias'}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </Panel>

      <ClubInviteSheet
        open={inviting}
        club={club}
        members={members}
        onClose={() => {
          setInviting(false)
          // Convite não coloca ninguém dentro, mas quem entrou pelo link
          // enquanto a folha estava aberta entra nesta lista.
          void load()
        }}
      />

      <ConfirmDialog
        open={leaving}
        title="Sair do clube?"
        description="Você deixa de ver o ranking e os desafios daqui. Dá pra voltar se o clube for aberto."
        confirmLabel="Sair"
        onConfirm={() => void sair()}
        onClose={() => setLeaving(false)}
      />
    </div>
  )
}
