import { formatDayLabel, type DayKey } from '@/domain/entities/day'
import type { PairMember } from '@/domain/entities/pair'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * Uma pessoa da dupla: quem é, se avançou hoje e os últimos sete dias.
 *
 * Os sete dias são pontos cheios e vazios, sem número e sem porcentagem. A
 * comparação entre as duas pessoas acontece de qualquer jeito — é o motivo de
 * a dupla existir —, mas ela é sobre presença, não sobre desempenho. Um "78%
 * contra 54%" transformaria accountability em placar, e placar entre amigas
 * que estão tentando mudar de vida termina com uma delas saindo.
 */
export function PairStrip({
  member,
  today,
  highlight = false,
}: {
  readonly member: PairMember
  readonly today: DayKey
  /** Destaque discreto pra linha de quem está olhando. */
  readonly highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3.5 py-3',
        highlight ? 'border-line-hi bg-surface-hi' : 'border-line bg-surface',
      )}
    >
      <Avatar name={member.name} src={member.avatarUrl} className="size-10 shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {member.name}
          {member.isMe ? <span className="ml-1.5 font-normal text-ink-faint">(você)</span> : null}
        </p>

        <p
          className={cn(
            'mt-0.5 flex items-center gap-1.5 text-sm',
            member.advancedToday ? 'text-positive' : 'text-ink-faint',
          )}
        >
          {member.advancedToday ? (
            <>
              <Icon name="check" className="size-3.5" strokeWidth={2.5} />
              Avançou hoje
            </>
          ) : (
            <>
              <span aria-hidden="true" className="size-3.5 rounded-full border border-current" />
              Ainda não avançou hoje
            </>
          )}
        </p>
      </div>

      {/* Sete dias. O rótulo acessível diz a data e o estado; o desenho, só o estado. */}
      <ul className="flex shrink-0 items-center gap-1" aria-label={`Últimos dias de ${member.name}`}>
        {member.days.map((item) => (
          <li key={item.day}>
            <span
              title={`${formatDayLabel(item.day, today)}: ${item.advanced ? 'avançou' : 'sem registro'}`}
              className={cn(
                'block size-2.5 rounded-full',
                item.advanced ? 'bg-brand-hi' : 'bg-line-hi',
              )}
            >
              <span className="sr-only">
                {formatDayLabel(item.day, today)}: {item.advanced ? 'avançou' : 'sem registro'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
