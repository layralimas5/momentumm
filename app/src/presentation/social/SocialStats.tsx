import { cn } from '@/shared/lib/cn'
import { useSocialCounts } from './use-social-counts'

/**
 * Os três números do perfil: publicações, seguidores, seguindo.
 *
 * ## Por que eles existem aqui, num produto que recusa ranking
 *
 * O Momentumm não mostra pontuação de ninguém pra ninguém, e continua não
 * mostrando: não há score, não há posição, não há "top da semana". Estes três
 * são de outra natureza — são o CARTÃO do perfil, a resposta a "quem é essa
 * pessoa e com quem ela conversa", e é o que permite alguém decidir seguir.
 *
 * Eles também não entram no card do feed, de propósito: um "1.2k seguidores"
 * embaixo de cada publicação transformaria a rolagem numa comparação, que é
 * exatamente o que este produto não quer entre pessoas tentando mudar de vida.
 *
 * ## A contagem é do servidor
 *
 * Quem busca e por que é assunto de `useSocialCounts`. Aqui é só o desenho.
 * Publicações conta só o que o VISITANTE pode ver, então "12 publicações"
 * nunca aparece em cima de uma grade com 9.
 */
export function SocialStats({
  userId,
  onOpenFollowers,
  onOpenFollowing,
}: {
  readonly userId: string
  readonly onOpenFollowers?: (() => void) | undefined
  readonly onOpenFollowing?: (() => void) | undefined
}) {
  const counts = useSocialCounts(userId)

  return (
    <div className="flex items-center gap-1">
      <Stat value={counts.posts} label="Publicações" />
      <Stat
        value={counts.followers}
        label={counts.followers === 1 ? 'Seguidor' : 'Seguidores'}
        onClick={onOpenFollowers}
      />
      <Stat value={counts.following} label="Seguindo" onClick={onOpenFollowing} />
    </div>
  )
}

function Stat({
  value,
  label,
  onClick,
}: {
  readonly value: number
  readonly label: string
  readonly onClick?: (() => void) | undefined
}) {
  const body = (
    <>
      <span className="block text-base font-semibold text-ink tabular">
        {value.toLocaleString('pt-BR')}
      </span>
      <span className="block truncate text-xs text-ink-faint">{label}</span>
    </>
  )

  if (!onClick) {
    return <span className="min-w-0 flex-1 py-1 text-center">{body}</span>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-11 min-w-0 flex-1 rounded-lg py-1 text-center transition-colors active:bg-surface-hi',
      )}
    >
      {body}
      <span className="sr-only">Ver a lista</span>
    </button>
  )
}
