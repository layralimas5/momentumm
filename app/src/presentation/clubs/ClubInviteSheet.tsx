import { useState } from 'react'
import type { Club, ClubMember } from '@/domain/entities/club'
import { track } from '@/infrastructure/analytics/track'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { useCircle } from '@/presentation/circle/use-circle'
import { cn } from '@/shared/lib/cn'

/**
 * Chamar gente pro clube.
 *
 * Duas portas, e elas resolvem problemas diferentes:
 *
 *   do círculo   quem já está no app e você já acompanha entra com um toque.
 *                É o caminho de todo dia, e o único que existe em clube por
 *                convite — lá, ninguém entra sozinho.
 *   pelo link    serve pra quem está fora do teu círculo, e por isso só
 *                aparece em clube ABERTO: mandar o endereço de um clube
 *                fechado seria mandar uma porta que não abre.
 *
 * Adicionar alguém é escrita do DONO, e o banco cobra assinatura pra isso. A
 * folha nem chega a abrir pra quem não administra — mas se chegasse, a
 * política recusaria do mesmo jeito.
 */
export function ClubInviteSheet({
  open,
  club,
  members,
  onClose,
  onInvite,
}: {
  readonly open: boolean
  readonly club: Club
  readonly members: readonly ClubMember[]
  readonly onClose: () => void
  readonly onInvite: (userId: string) => Promise<void>
}) {
  const circle = useCircle()
  const [busy, setBusy] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const dentro = new Set(members.map((member) => member.userId))
  const convidaveis = circle.friends.filter((friend) => !dentro.has(friend.person.id))

  const convidar = async (userId: string) => {
    setBusy(userId)
    try {
      await onInvite(userId)
    } finally {
      setBusy(null)
    }
  }

  const compartilhar = async () => {
    const url = `${window.location.origin}/app/clubes/${club.id}`
    const texto = `Entra no ${club.name} comigo no Momentumm: ${url}`

    try {
      if (navigator.share) {
        await navigator.share({ title: club.name, text: texto })
        track('club_joined', 'desafios', { result: 'link_compartilhado' })
        return
      }
    } catch {
      // Cancelou a folha nativa: não é erro, e não vira aviso na tela.
      return
    }

    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      title="Chamar gente pro clube"
      description={
        club.privacy === 'aberto'
          ? 'Adicione quem já está no teu círculo, ou mande o link pra qualquer pessoa.'
          : 'Neste clube ninguém entra sozinho: só quem você adicionar.'
      }
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 pb-1">
        {club.privacy === 'aberto' ? (
          <div>
            <Button size="lg" variant="secondary" className="w-full" onClick={() => void compartilhar()}>
              <Icon name="compartilhar" className="size-4" />
              Compartilhar o link do clube
            </Button>
            <p aria-live="polite" className="mt-1.5 min-h-5 text-center text-xs text-ink-faint">
              {copiado ? 'Link copiado. É só colar na conversa.' : ''}
            </p>
          </div>
        ) : null}

        <section>
          <h3 className="text-[0.6875rem] font-medium tracking-[0.12em] text-ink-faint uppercase">
            Do seu círculo
          </h3>

          {circle.loading ? (
            <p className="mt-2 text-sm text-ink-muted">Carregando teu círculo…</p>
          ) : convidaveis.length === 0 ? (
            <p className="mt-2 text-sm text-pretty text-ink-muted">
              {circle.friends.length === 0
                ? 'Teu círculo está vazio por enquanto. Quem você adicionar lá aparece aqui.'
                : 'Todo mundo do teu círculo já está neste clube.'}
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {convidaveis.map((friend) => (
                <li
                  key={friend.person.id}
                  className="flex items-center gap-3 rounded-xl px-1 py-2"
                >
                  <Avatar
                    name={friend.person.name}
                    src={friend.person.avatarUrl}
                    className="size-10"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {friend.person.name}
                    </span>
                    <span className="block truncate text-xs text-ink-faint">
                      @{friend.person.handle}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className={cn(busy === friend.person.id && 'opacity-60')}
                    disabled={busy !== null}
                    loading={busy === friend.person.id}
                    onClick={() => void convidar(friend.person.id)}
                  >
                    Adicionar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-pretty text-ink-faint">
          Quem entra vê o nome, a foto e os dias cumpridos de cada pessoa nos desafios daqui. Nada
          além disso atravessa: hábito, ação e registro continuam sendo de quem os fez.
        </p>
      </div>
    </BottomSheet>
  )
}
