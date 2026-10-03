import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AchievementView } from '@/domain/entities/evolution'
import { isPro, type PlanTier } from '@/domain/entities/plan'
import type { Profile } from '@/domain/entities/profile'
import type { SocialCounts } from '@/domain/entities/social-graph'
import { StatusTag } from '@/presentation/components/ds/Badges'
import { Card, Eyebrow } from '@/presentation/components/ds/Card'
import { SoftButton } from '@/presentation/components/ds/Controls'
import { AnimatedNumber } from '@/presentation/components/ds/Progress'
import { VerifiedBadge } from '@/presentation/components/brand/VerifiedBadge'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Icon, isIconName, type IconName } from '@/presentation/components/ui/Icon'
import { Medal3D } from '@/presentation/evolution/Medal3D'
import { cn } from '@/shared/lib/cn'

/** O cartão de membro: quem é, em que nível está e o que está vivendo agora. */
export function IdentityCard({
  profile,
  plan,
  counts,
  onEdit,
  onStatus,
  onFollowers,
  onFollowing,
  social,
}: {
  readonly profile: Profile
  readonly plan: PlanTier
  readonly counts: SocialCounts
  readonly onEdit: () => void
  readonly onStatus: () => void
  readonly onFollowers: () => void
  readonly onFollowing: () => void
  readonly social: boolean
}) {
  const pro = isPro(plan)

  return (
    <Card className="flex flex-col items-center text-center">
      <div className="relative">
        <span className="block rounded-full p-1 shadow-[var(--shadow-float)]">
          <Avatar name={profile.name} src={profile.avatarUrl} className="size-20" textClassName="text-3xl" />
        </span>
        {/*
          O selo PRO duas vezes, como no perfil de sempre: na foto, que é o que
          sobra quando o card aparece pequeno; ao lado do nome, lido junto com
          quem a pessoa é. Conta grátis não tem selo nenhum.
        */}
        {pro ? (
          <span aria-hidden="true" className="absolute right-0.5 bottom-1 grid size-7 place-items-center rounded-full bg-surface">
            <VerifiedBadge className="size-6" />
          </span>
        ) : null}
      </div>

      <h2 className="mt-3 flex items-center gap-1.5 text-xl font-bold tracking-tight text-ink">
        <span className="truncate">{profile.name}</span>
        {pro ? (
          <>
            <VerifiedBadge className="size-5" />
            <span className="sr-only">Conta PRO</span>
          </>
        ) : null}
      </h2>
      <p className="text-sm text-ink-faint">@{profile.handle}</p>
      {profile.bio ? <p className="mt-1 max-w-xs text-sm text-pretty text-ink-muted">{profile.bio}</p> : null}

      <button
        type="button"
        onClick={onStatus}
        className="well press mt-3 inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full px-3.5 text-xs font-medium text-ink-muted"
      >
        {profile.status ? (
          <>
            {profile.status.emoji ? <span aria-hidden="true">{profile.status.emoji}</span> : (
              <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
            )}
            <span className="truncate">{profile.status.text ?? 'Status'}</span>
            <span className="sr-only">. Editar status</span>
          </>
        ) : (
          <>
            <Icon name="mais" className="size-3.5" />
            Adicionar status
          </>
        )}
      </button>

      {social ? (
        <div className="mt-4 flex items-center gap-5 text-sm">
          <button type="button" onClick={onFollowers} className="text-ink-muted">
            <strong className="font-semibold text-ink tabular">{counts.followers}</strong> seguidores
          </button>
          <button type="button" onClick={onFollowing} className="text-ink-muted">
            <strong className="font-semibold text-ink tabular">{counts.following}</strong> seguindo
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onEdit}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-hi"
      >
        <Icon name="editar" className="size-4" />
        Editar perfil
      </button>
    </Card>
  )
}

export function MetricTile({
  label,
  icon,
  value,
  suffix,
  hint,
}: {
  readonly label: string
  readonly icon: IconName
  readonly value: number | string
  readonly suffix?: string
  readonly hint: string
}) {
  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow text-[0.66rem] text-ink-muted">{label}</span>
        <Icon name={icon} className="size-4 text-brand-hi" />
      </div>
      <p className="flex items-baseline gap-1 text-ink">
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} className="text-[1.3rem] leading-none font-semibold" />
        ) : (
          <span className="text-[1.3rem] leading-none font-semibold tabular">{value}</span>
        )}
        {suffix ? <span className="text-sm text-ink-faint">{suffix}</span> : null}
      </p>
      <span className="truncate text-xs text-ink-faint">{hint}</span>
    </div>
  )
}

/**
 * A relíquia: a conquista mais rara e mais recente vira objeto de coleção.
 * Ela é real (vem do motor de evolução), nunca uma edição numerada inventada.
 */
export function RelicCard({
  achievement,
  unlocked,
  total,
  onShare,
}: {
  readonly achievement: AchievementView | null
  readonly unlocked: number
  readonly total: number
  readonly onShare: () => void
}) {
  if (!achievement) {
    return (
      <Card className="flex items-center gap-4">
        <Medal3D icon="trofeu" metal="prata" title="Relíquia bloqueada" caption="A primeira conquista libera" locked size={72} />
        <div className="min-w-0">
          <Eyebrow>Relíquias</Eyebrow>
          <p className="mt-1 text-sm text-pretty text-ink-muted">
            A primeira conquista vira a sua relíquia. Ela aparece sozinha conforme os números crescem.
          </p>
        </div>
      </Card>
    )
  }

  const rare = achievement.rarity === 'rara'
  const icon: IconName = isIconName(achievement.icon) ? achievement.icon : 'trofeu'

  return (
    <Card aria-labelledby="reliquia">
      <div className="flex items-center justify-between gap-3">
        <StatusTag tone="brand" className="tracking-[0.12em] uppercase">
          Relíquia ativa
        </StatusTag>
        <span className="eyebrow text-[0.68rem] text-brand-hi">{rare ? 'Grau raro' : 'Grau comum'}</span>
      </div>

      <div className="relative mt-3 grid place-items-center overflow-hidden rounded-[1.15rem] bg-[radial-gradient(60%_60%_at_50%_45%,rgb(91_76_245/0.35),transparent_70%),linear-gradient(160deg,#1b1a2e,#0d0d16)] pt-6 pb-9">
        <Medal3D
          icon={icon}
          metal={rare ? 'ouro' : 'prata'}
          title={achievement.name}
          caption={
            achievement.unlockedAt
              ? `Conquistada em ${achievement.unlockedAt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')}`
              : 'Conquista'
          }
          size={150}
        />
        <span className="absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[0.7rem] font-semibold text-white backdrop-blur-md">
          <Icon name="trofeu" className="size-3.5 text-medal-hi" />
          {unlocked} de {total} conquistas
        </span>
        <span className="absolute bottom-3 left-3 text-[0.65rem] text-white/60">Arraste pra girar</span>
      </div>

      <h2 id="reliquia" className="mt-4 text-lg font-semibold tracking-tight text-ink">
        {achievement.name}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-pretty text-ink-muted">{achievement.description}</p>

      <SoftButton onClick={onShare} className="mt-4">
        <Icon name="compartilhar" className="size-4" />
        Compartilhar no Stories
      </SoftButton>
    </Card>
  )
}

/** Um card 9:16 do Share Studio: a prévia do que vira imagem. */
export function ShareTemplateCard({
  kicker,
  icon,
  value,
  caption,
  onClick,
  tone = 'light',
}: {
  readonly kicker: string
  readonly icon: IconName
  readonly value: ReactNode
  readonly caption: string
  readonly onClick: () => void
  readonly tone?: 'light' | 'dark'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'press flex aspect-[9/16] w-28 shrink-0 snap-start flex-col justify-between rounded-[1.15rem] p-3 text-left',
        tone === 'dark' ? 'bg-[linear-gradient(160deg,#1b1a2e,#0d0d16)] text-white shadow-[var(--shadow-float)]' : 'card',
      )}
    >
      <span className={cn('eyebrow text-[0.6rem]', tone === 'dark' ? 'text-white/70' : 'text-brand-hi')}>{kicker}</span>
      <span className="flex flex-col items-center gap-2 text-center">
        <span
          className={cn(
            'grid size-9 place-items-center rounded-full',
            tone === 'dark' ? 'bg-white/10 text-white' : 'well text-brand-hi',
          )}
        >
          <Icon name={icon} className="size-5" />
        </span>
        <span className="text-xl leading-none font-bold tabular">{value}</span>
        <span className={cn('text-[0.68rem]', tone === 'dark' ? 'text-white/70' : 'text-ink-faint')}>{caption}</span>
      </span>
      <span className={cn('flex justify-between text-[0.6rem]', tone === 'dark' ? 'text-white/60' : 'text-ink-faint')}>
        <span>Momentumm</span>
        <span>9:16</span>
      </span>
    </button>
  )
}

/** Uma linha de preferência: ícone, título, uma frase e o controle à direita. */
export function PreferenceRow({
  icon,
  title,
  hint,
  to,
  onClick,
  control,
  danger = false,
}: {
  readonly icon: IconName
  readonly title: string
  readonly hint?: string
  readonly to?: string
  readonly onClick?: () => void
  readonly control?: ReactNode
  readonly danger?: boolean
}) {
  const body = (
    <>
      <span className={cn('well grid size-10 shrink-0 place-items-center rounded-full', danger ? 'text-danger' : 'text-ink-muted')}>
        <Icon name={icon} className="size-[1.1rem]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-medium', danger ? 'text-danger' : 'text-ink')}>{title}</span>
        {hint ? <span className="block truncate text-xs text-ink-faint">{hint}</span> : null}
      </span>
    </>
  )

  const className = 'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left'

  if (control) {
    return (
      <li className={className}>
        {body}
        {control}
      </li>
    )
  }

  return (
    <li>
      {to ? (
        <Link to={to} className={cn(className, 'press')}>
          {body}
          <Icon name="seta" className="size-4 text-ink-faint" />
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={cn(className, 'press')}>
          {body}
          {danger ? null : <Icon name="seta" className="size-4 text-ink-faint" />}
        </button>
      )}
    </li>
  )
}
