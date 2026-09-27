import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { LimitCheck } from '@/domain/entities/plan'
import { inviteMessage, inviteUrl } from '@/domain/entities/referral'
import { track } from '@/infrastructure/analytics/track'
import { useAuth } from '@/presentation/auth/use-auth'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, PanelHeader } from '@/presentation/components/ui/Surface'
import type { CirclePerson } from '@/presentation/circle/use-circle'
import { cn } from '@/shared/lib/cn'

/**
 * O círculo em três lugares, e o convite no lugar vazio.
 *
 * É a peça que faz o produto crescer, e ela existe por uma razão anterior à
 * aquisição: quem está sozinho no app não tem como saber que acompanhar o
 * progresso com alguém muda alguma coisa. Três lugares — você e mais dois —
 * é o tamanho em que companhia ainda é companhia, e é o que o gratuito
 * oferece.
 *
 * Os lugares vazios são mostrados como lugares, não como erro: um círculo
 * pontilhado com "Convide alguém" convida; uma tela dizendo "você não tem
 * amigos" acusa.
 *
 * Quando o círculo enche, o convite dá lugar ao PRO — e essa é a única
 * cobrança da tela. Sem pop-up, sem interromper nada: a pessoa chegou no teto
 * usando o recurso, que é o momento em que a conversa sobre plano faz sentido.
 */
export function InviteFriendCard({
  friends,
  limit,
}: {
  readonly friends: readonly CirclePerson[]
  readonly limit: LimitCheck
}) {
  const { profile } = useAuth()
  const [copied, setCopied] = useState(false)

  if (!profile) return null

  const url = inviteUrl(window.location.origin, profile.handle)
  const empty = Math.max(0, limit.max - friends.length)

  const share = async () => {
    track('friend_invite_started', 'circulo', { count: friends.length })
    const text = inviteMessage(profile.name.split(' ')[0] ?? profile.name, url)

    /*
      A folha nativa primeiro: é ela que abre o WhatsApp, e o WhatsApp é por
      onde este convite vai na prática. Sem suporte (ou se a pessoa cancelar),
      cai pra área de transferência, que funciona em qualquer lugar.
    */
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Momentumm', text })
        track('friend_invite_shared', 'circulo', { result: 'nativo' })
        return
      }
    } catch {
      // Cancelou a folha: não é erro, e não vira aviso na tela.
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
      track('friend_invite_shared', 'circulo', { result: 'copiado' })
    } catch {
      setCopied(false)
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Seu círculo"
        icon="jornada"
        hint={
          limit.reached
            ? 'Completo no plano gratuito.'
            : `Você e mais ${limit.max}. Progresso é melhor quando alguém acompanha com você.`
        }
      />

      <ul className="mt-4 flex items-start justify-center gap-4">
        <Seat name={profile.name} avatarUrl={profile.avatarUrl} label="Você" isMe />
        {friends.slice(0, limit.max).map((item) => (
          <Seat
            key={item.friendship.id}
            name={item.person.name}
            avatarUrl={item.person.avatarUrl}
            label={`@${item.person.handle}`}
          />
        ))}
        {Array.from({ length: empty }, (_, index) => (
          <EmptySeat key={index} onClick={() => void share()} />
        ))}
      </ul>

      {limit.reached ? (
        <div className="mt-5 rounded-2xl border border-brand/30 bg-brand-dim/30 px-4 py-3.5">
          <p className="text-sm font-semibold text-ink">Seu círculo está completo</p>
          <p className="mt-1 text-sm text-pretty text-ink-muted">
            Continue com quem já está aqui — ou desbloqueie círculos maiores e desafios em grupo
            com o PRO.
          </p>
          <Link
            to="/app/assinatura"
            onClick={() => track('free_friend_limit_reached', 'circulo', { count: friends.length })}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-hi"
          >
            Conhecer o PRO
            <Icon name="seta" className="size-4" />
          </Link>
        </div>
      ) : (
        <>
          <Button size="lg" className="mt-5 w-full" onClick={() => void share()}>
            <Icon name="compartilhar" className="size-4" />
            Convidar amigo
          </Button>
          <p aria-live="polite" className="mt-2 min-h-5 text-center text-xs text-ink-faint">
            {copied ? 'Link copiado. É só colar na conversa.' : ''}
          </p>
        </>
      )}
    </Panel>
  )
}

function Seat({
  name,
  avatarUrl,
  label,
  isMe = false,
}: {
  readonly name: string
  readonly avatarUrl: string | null
  readonly label: string
  readonly isMe?: boolean
}) {
  return (
    <li className="flex w-16 flex-col items-center gap-1.5">
      <span
        className={cn(
          'grid place-items-center rounded-full border-2 p-0.5',
          isMe ? 'border-brand' : 'border-line-hi',
        )}
      >
        <Avatar name={name} src={avatarUrl} className="size-12" textClassName="text-sm" />
      </span>
      <span className="w-full truncate text-center text-xs font-medium text-ink">{name}</span>
      <span className="w-full truncate text-center text-[0.625rem] text-ink-faint">{label}</span>
    </li>
  )
}

/** O lugar que ainda não tem ninguém. É um convite, não uma falta. */
function EmptySeat({ onClick }: { readonly onClick: () => void }) {
  return (
    <li className="flex w-16 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className="grid size-[3.5rem] place-items-center rounded-full border-2 border-dashed border-line-hi text-ink-faint transition-colors active:bg-surface-hi active:text-ink"
      >
        <Icon name="mais" className="size-5" />
        <span className="sr-only">Convidar alguém pro círculo</span>
      </button>
      <span className="text-center text-xs text-ink-faint">Convide</span>
    </li>
  )
}
