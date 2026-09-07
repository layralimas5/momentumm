import { Link } from 'react-router-dom'
import { circleHeadline, type CircleFeedItem } from '@/domain/entities/circle-feed'
import { formatDayLabel, type DayKey } from '@/domain/entities/day'
import { JOURNEY_EVENT_TYPE_LABELS } from '@/domain/entities/journey-event'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Icon } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'

interface CircleMomentCardProps {
  readonly item: CircleFeedItem
  readonly today: DayKey
  readonly onSupport: (eventId: string, supported: boolean) => void
  /** No perfil do amigo o autor já está no topo da página. */
  readonly showAuthor?: boolean
}

/**
 * Um momento de um amigo.
 *
 * O card mostra o que a pessoa escolheu mostrar e nada além. Não existe menu de
 * três pontinhos, não existe caixa de comentário e não existe número de
 * seguidor — o único gesto possível é o apoio, e ele não gera notificação nem
 * ranking.
 *
 * O Momentum aparece como VARIAÇÃO ("+7"), nunca como pontuação absoluta. O
 * score é a comparação da pessoa com ela mesma; exibir "84" ao lado de "61"
 * num feed criaria a tabela de classificação que o produto recusa, mesmo sem
 * nunca chamar de tabela.
 */
export function CircleMomentCard({
  item,
  today,
  onSupport,
  showAuthor = true,
}: CircleMomentCardProps) {
  const { event, author } = item
  const firstName = author.name.split(' ')[0] ?? author.name

  return (
    <article className="surface-card flex flex-col gap-3 p-4">
      {showAuthor ? (
        <header className="flex items-center gap-3">
          <Link to={`/app/circulo/${author.id}`} className="flex min-w-0 items-center gap-3">
            <Avatar name={author.name} src={author.avatarUrl} className="size-10" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">
                {circleHeadline(event, firstName)}
              </span>
              <span className="block truncate text-xs text-ink-faint">
                @{author.handle} · {formatDayLabel(event.day, today)}
              </span>
            </span>
          </Link>
        </header>
      ) : (
        <p className="text-xs text-ink-faint">{formatDayLabel(event.day, today)}</p>
      )}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{event.title}</h3>
        {event.completionPercentage !== null ? (
          <span className="tabular text-sm text-ink-muted">
            {Math.round(event.completionPercentage * 100)}%
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tag>{JOURNEY_EVENT_TYPE_LABELS[event.type]}</Tag>
        {event.momentumChange !== null && event.momentumChange !== 0 ? (
          <Tag tone={event.momentumChange > 0 ? 'positive' : 'neutral'}>
            Momentum {event.momentumChange > 0 ? '+' : '−'}
            {Math.abs(event.momentumChange)}
          </Tag>
        ) : null}
        {event.metadata.daysAway ? (
          <Tag tone="warn">depois de {event.metadata.daysAway} dias</Tag>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <SupportButton item={item} onSupport={onSupport} />
        {showAuthor ? (
          <Link
            to={`/app/circulo/${author.id}`}
            className="rounded-md text-sm text-ink-faint transition-colors hover:text-ink-muted"
          >
            Ver perfil
          </Link>
        ) : null}
      </div>
    </article>
  )
}

/**
 * O apoio.
 *
 * Um gesto só, sem variedade de emoji. Curtida com seis carinhas vira métrica
 * de popularidade, e popularidade entre pessoas que estão tentando mudar de
 * vida é o começo do ranking que este produto recusa.
 */
function SupportButton({
  item,
  onSupport,
}: {
  readonly item: CircleFeedItem
  readonly onSupport: (eventId: string, supported: boolean) => void
}) {
  const { supportedByMe, supports } = item

  return (
    <button
      type="button"
      aria-pressed={supportedByMe}
      onClick={() => onSupport(item.event.id, !supportedByMe)}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors',
        supportedByMe
          ? 'border-brand/40 bg-brand-dim/40 text-brand-ink'
          : 'border-line text-ink-muted hover:border-line-hi hover:text-ink active:bg-surface-hi',
      )}
    >
      <Icon
        name="raio"
        className={cn('size-4', supportedByMe && 'text-brand-hi')}
        strokeWidth={supportedByMe ? 2.5 : 1.75}
      />
      {supportedByMe ? 'Apoiando' : 'Apoiar'}
      {supports > 0 ? <span className="tabular text-ink-faint">{supports}</span> : null}
    </button>
  )
}
