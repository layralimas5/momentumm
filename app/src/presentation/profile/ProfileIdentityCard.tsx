import type { FollowCounts } from '@/domain/entities/follow'
import type { Profile } from '@/domain/entities/profile'
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
  readonly counts: FollowCounts
  /**
   * Quantos momentos a jornada registrou.
   *
   * O rótulo é "Momentos" e não "Posts" porque é isso que eles são: marcos que
   * o app grava quando um dia fecha, um objetivo avança ou um recorde cai.
   * Chamar de post daria a entender que existe um lugar onde eles foram
   * publicados, e esse lugar é escolha de cada momento, um a um.
   */
  readonly moments: number
  /**
   * A moldura Aurora, desbloqueada no PRO a partir do nível 7. Um anel com
   * brilho, não um enfeite a mais: o anel comum já existe pra todo mundo, e o
   * que muda é a luz.
   */
  readonly aurora?: boolean
  readonly onEdit: () => void
  readonly onShare: () => void
}

/**
 * O cartão de visita do perfil.
 *
 * É a única parte da tela que fala com quem está de fora: foto, nome, @, o que
 * a pessoa está construindo, onde encontrá-la e três números. Tudo o que é
 * medida de evolução, momentum, constância, conquistas, fica nas abas
 * abaixo, porque isso é sobre o caminho, e o cartão é sobre quem caminha.
 *
 * Os três números são contagens reais: momentos publicados, quem segue e quem é
 * seguido. Nenhum deles é uma porta, seguir não abre perfil privado, e a
 * regra mora no banco, não aqui.
 */
export function ProfileIdentityCard({
  profile,
  counts,
  moments,
  aurora = false,
  onEdit,
  onShare,
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
            <Count label="Momentos" value={moments} />
            <Divider />
            <Count label="Seguidores" value={counts.followers} />
            <Divider />
            <Count label="Seguindo" value={counts.following} />
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
 * O número em cima, o rótulo embaixo, e nenhum dos dois é link.
 *
 * Tocar em "Seguidores" abriria a lista de quem segue, e essa tela não existe:
 * ela pede uma conversa inteira sobre quem pode ver quem. Enquanto não existir,
 * o número é informação, não promessa.
 */
function Count({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="flex-1 text-left">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="tabular mt-0.5 text-lg leading-none font-semibold text-ink">{value}</dd>
    </div>
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
