import type { Profile } from '@/domain/entities/profile'
import type { SocialCounts } from '@/domain/entities/social-graph'
import { isPro } from '@/domain/entities/plan'
import { filledSocials, socialDisplay, socialUrl, SOCIAL_LABELS } from '@/domain/entities/social-link'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { VerifiedBadge } from '@/presentation/components/brand/VerifiedBadge'
import { cn } from '@/shared/lib/cn'

const SOCIAL_ICONS: Readonly<Record<'instagram' | 'tiktok' | 'linkedin', IconName>> = {
  instagram: 'instagram',
  tiktok: 'tiktok',
  linkedin: 'linkedin',
}

interface ProfileIdentityCardProps {
  readonly profile: Profile
  /**
   * Publicações, seguidores e seguindo, os três do servidor.
   *
   * "Momentos" saiu daqui. Ele contava o que o APP grava sozinho (dia fechado,
   * objetivo avançado, recorde), e esse número não tinha como bater com o que
   * a grade logo abaixo mostra — o que a pessoa PUBLICOU. Dois números
   * parecidos e diferentes na mesma tela é como um app começa a discordar de
   * si mesmo. Os momentos continuam inteiros, na aba de atividades.
   */
  readonly counts: SocialCounts
  /**
   * A moldura Aurora, desbloqueada no PRO a partir do nível 7. Um anel com
   * brilho, não um enfeite a mais: o anel comum já existe pra todo mundo, e o
   * que muda é a luz.
   */
  readonly aurora?: boolean
  readonly onEdit: () => void
  readonly onShare: () => void
  /** Abre a lista. Sem callback, o número é só informação. */
  readonly onOpenFollowers?: (() => void) | undefined
  readonly onOpenFollowing?: (() => void) | undefined
}

/**
 * O cartão de visita do perfil.
 *
 * É a única parte da tela que fala com quem está de fora: foto, nome, @, o que
 * a pessoa está construindo, onde encontrá-la e três números. Tudo o que é
 * medida de evolução, momentum, constância, conquistas, fica nas abas
 * abaixo, porque isso é sobre o caminho, e o cartão é sobre quem caminha.
 *
 * Os três números são contagens reais, vindas do servidor: publicações que o
 * visitante pode ver, quem segue e quem é seguido. Nenhum deles é uma porta —
 * quem decide o que se vê é a RLS, e contagem é vitrine.
 */
export function ProfileIdentityCard({
  profile,
  counts,
  aurora = false,
  onEdit,
  onShare,
  onOpenFollowers,
  onOpenFollowing,
}: ProfileIdentityCardProps) {
  const socials = filledSocials(profile.socials)
  // O selo diz PRO, não "verificado": este produto não verifica identidade de
  // ninguém, e um selo azul que não significa o que todo mundo acha que
  // significa é uma mentira pequena que o app conta todo dia.
  const pro = isPro(profile.plan)

  return (
    <section aria-labelledby="perfil-nome" className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-start gap-4">
        {/*
          O anel em volta da foto. É a única moldura do app e ela não é enfeite:
          marca de quem é o perfil na tela, do mesmo jeito que o dia de hoje é o
          único com anel no calendário logo abaixo.
        */}
        <span className="relative shrink-0">
          <span
            className={cn(
              'grid size-24 place-items-center rounded-full border-2 p-1',
              aurora
                ? 'border-brand-hi shadow-[0_0_26px_-4px_var(--color-brand)]'
                : 'border-brand',
            )}
          >
            <Avatar
              name={profile.name}
              src={profile.avatarUrl}
              className="size-full"
              textClassName="text-2xl"
            />
          </span>
          {/*
            O mesmo selo duas vezes, e não é redundância: no avatar ele marca a
            foto, que é o que sobra quando o card aparece pequeno em outro
            lugar; ao lado do nome ele é lido junto com quem a pessoa é. O
            disco de fundo existe pra ele não encostar na borda do anel.
          */}
          {pro ? (
            <span
              aria-hidden="true"
              className="absolute right-1 bottom-1.5 grid size-7 place-items-center rounded-full bg-surface"
            >
              <VerifiedBadge className="size-6" />
            </span>
          ) : null}
        </span>

        <div className="min-w-0 flex-1 pt-1">
          <h1
            id="perfil-nome"
            className="flex items-center gap-1.5 text-xl leading-tight font-bold tracking-tight text-ink"
          >
            <span className="truncate">{profile.name}</span>
            {pro ? (
              <>
                <VerifiedBadge className="size-5" />
                <span className="sr-only">Conta PRO</span>
              </>
            ) : null}
          </h1>
          <p className="mt-0.5 truncate text-sm text-ink-faint">@{profile.handle}</p>

          <dl className="mt-4 flex items-center">
            <Count label="Publicações" value={counts.posts} />
            <Divider />
            <Count
              label={counts.followers === 1 ? 'Seguidor' : 'Seguidores'}
              value={counts.followers}
              onOpen={onOpenFollowers}
            />
            <Divider />
            <Count label="Seguindo" value={counts.following} onOpen={onOpenFollowing} />
          </dl>
        </div>
      </div>

      {profile.bio ? (
        <p className="mt-4 text-center text-sm text-pretty text-ink-muted">{profile.bio}</p>
      ) : null}

      {/*
        As redes numa faixa, não numa pilha.

        Com quebra de linha, três @ de tamanho normal viravam três linhas
        inteiras no meio do cartão, mais alto que a bio e que os botões. Em
        faixa eles ocupam uma linha só, e o corte do último diz que dá pra
        arrastar. A margem negativa deixa o primeiro chip alinhado com o resto
        do cartão mesmo com o respiro de rolagem.
      */}
      {socials.length > 0 ? (
        <ul className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {socials.map(({ network, handle }) => (
            <li key={network} className="shrink-0">
              <a
                href={socialUrl(network, handle)}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface-hi/50 px-3',
                  'text-sm whitespace-nowrap text-ink-muted transition-colors active:bg-surface-hi',
                )}
              >
                <Icon name={SOCIAL_ICONS[network]} className="size-4 shrink-0 text-ink-faint" />
                {socialDisplay(network, handle)}
                <span className="sr-only">no {SOCIAL_LABELS[network]}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <ActionButton icon="compartilhar" label="Compartilhar" onClick={onShare} />
        <ActionButton icon="editar" label="Editar perfil" onClick={onEdit} />
      </div>
    </section>
  )
}

/**
 * O número em cima, o rótulo embaixo.
 *
 * Seguidores e Seguindo agora ABREM a lista, porque a tela passou a existir e
 * a pergunta "quem pode ver quem" foi respondida no servidor: quem enxerga o
 * perfil enxerga as listas dele. Publicações não abre nada — a grade já está
 * logo abaixo, e um toque que rola a página dois centímetros é um toque que
 * não valia a pena.
 */
function Count({
  label,
  value,
  onOpen,
}: {
  readonly label: string
  readonly value: number
  readonly onOpen?: (() => void) | undefined
}) {
  /*
    `min-w-0` e `truncate`: sem os dois, um item `flex-1` não encolhe abaixo da
    largura do próprio texto (o `min-width: auto` do flexbox), e "Seguidores"
    empurrava a linha inteira dois pixels pra fora num aparelho de 320px — o
    bastante pra a página ganhar rolagem horizontal.
  */
  const body = (
    <>
      <dt className="truncate text-xs text-ink-faint">{label}</dt>
      <dd className="tabular mt-0.5 text-lg leading-none font-semibold text-ink">{value}</dd>
    </>
  )

  if (!onOpen) return <div className="min-w-0 flex-1 text-left">{body}</div>

  return (
    <button
      type="button"
      onClick={onOpen}
      className="min-h-11 min-w-0 flex-1 rounded-lg text-left transition-colors active:bg-surface-hi"
    >
      {body}
      <span className="sr-only">. Ver a lista</span>
    </button>
  )
}

function Divider() {
  return <span aria-hidden="true" className="h-8 w-px shrink-0 bg-line" />
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  readonly icon: IconName
  readonly label: string
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface-hi/50',
        'text-sm font-medium text-ink transition-colors active:bg-surface-hi',
      )}
    >
      <Icon name={icon} className="size-4 text-ink-muted" />
      {label}
    </button>
  )
}
