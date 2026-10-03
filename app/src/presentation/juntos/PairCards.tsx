import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { dayKeyToDate, formatDayLabel, type DayKey } from '@/domain/entities/day'
import type { EncouragementSpec, PairMember, PairReading } from '@/domain/entities/pair'
import { StatusTag } from '@/presentation/components/ds/Badges'
import { Card } from '@/presentation/components/ds/Card'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/** A pessoa da dupla: foto com anel aceso quando avançou hoje. */
function MemberBubble({ member }: { readonly member: PairMember }) {
  const reduce = useReducedMotion()
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <span className="relative">
        <span
          className={cn(
            'block rounded-full p-[3px]',
            member.advancedToday ? 'bg-gradient-to-br from-brand to-brand-deep' : 'bg-line-hi',
          )}
        >
          <span className="block rounded-full bg-surface p-[2px]">
            <Avatar name={member.name} src={member.avatarUrl} className="size-16" textClassName="text-xl" />
          </span>
        </span>
        {member.advancedToday ? (
          <motion.span
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full bg-positive text-white ring-2 ring-surface"
          >
            <Icon name="check" className="size-3.5" strokeWidth={3} />
          </motion.span>
        ) : null}
      </span>
      <span className="max-w-full truncate text-sm font-semibold text-ink">
        {member.isMe ? 'Você' : member.name.split(' ')[0]}
      </span>
      <span className={cn('text-xs', member.advancedToday ? 'text-positive-ink' : 'text-ink-faint')}>
        {member.advancedToday ? 'Avançou hoje' : 'Ainda não hoje'}
      </span>
    </div>
  )
}

/** O topo da dupla: as duas pessoas, a chama do meio e a leitura do dia. */
export function PairHero({
  me,
  partner,
  reading,
  daysTogether,
}: {
  readonly me: PairMember | undefined
  readonly partner: PairMember | undefined
  readonly reading: PairReading
  readonly daysTogether: number
}) {
  return (
    <Card tone="float" className="overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        {me ? <MemberBubble member={me} /> : <span />}
        <div className="flex flex-col items-center pt-5" aria-hidden={daysTogether === 0}>
          <span className="flex items-center gap-1 rounded-full bg-flame-dim px-2.5 py-1 text-xs font-bold text-flame tabular">
            <Icon name="fogo" className="size-3.5" filled strokeWidth={2} />
            {daysTogether}D
          </span>
          <span className="mt-1 text-[0.65rem] text-ink-faint">em dupla</span>
          <span aria-hidden="true" className="mt-2 h-px w-12 bg-gradient-to-r from-transparent via-brand to-transparent" />
        </div>
        {partner ? <MemberBubble member={partner} /> : <span />}
      </div>

      <div className="well mt-5 rounded-2xl px-4 py-3 text-center">
        <p className="text-[0.95rem] font-semibold text-balance text-ink">{reading.headline}</p>
        <p className="mt-0.5 text-sm text-pretty text-ink-muted">{reading.note}</p>
      </div>
    </Card>
  )
}

const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const

/** A semana lado a lado: um ponto de cada pessoa por dia, aceso quando avançou. */
export function PairWeek({
  me,
  partner,
  today,
  maxDays,
  lockedNote,
}: {
  readonly me: PairMember
  readonly partner: PairMember
  readonly today: DayKey
  readonly maxDays: number
  readonly lockedNote?: ReactNode
}) {
  const mine = me.days.slice(-maxDays)
  const theirs = new Map(partner.days.map((item) => [item.day, item.advanced]))
  const both = mine.filter((item) => item.advanced && theirs.get(item.day)).length

  return (
    <Card aria-labelledby="semana-dupla">
      <div className="flex items-center justify-between gap-3">
        <h2 id="semana-dupla" className="eyebrow text-[0.72rem] text-ink-muted">
          Semana da dupla
        </h2>
        <span className="text-xs text-ink-faint tabular">
          {both} {both === 1 ? 'dia' : 'dias'} com a dupla inteira
        </span>
      </div>

      <ol className="mt-4 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${mine.length}, minmax(0, 1fr))` }}>
        {mine.map((item) => {
          const partnerAdvanced = theirs.get(item.day) ?? false
          const together = item.advanced && partnerAdvanced
          const isToday = item.day === today
          return (
            <li
              key={item.day}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl py-2.5',
                together ? 'bg-brand-dim' : 'chip',
                isToday && 'ring-2 ring-brand/40',
              )}
            >
              <span className={cn('text-[0.62rem] font-semibold', isToday ? 'text-brand-hi' : 'text-ink-faint')}>
                {WEEKDAY_INITIALS[dayKeyToDate(item.day).getDay()]}
              </span>
              <Dot on={item.advanced} label={`Você, ${formatDayLabel(item.day, today)}`} />
              <Dot on={partnerAdvanced} label={`${partner.name}, ${formatDayLabel(item.day, today)}`} partner />
            </li>
          )
        })}
      </ol>

      <div className="mt-3 flex items-center gap-4 text-xs text-ink-faint" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-brand" /> Você
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-axis-custom-2" /> {partner.name.split(' ')[0]}
        </span>
      </div>

      {lockedNote}
    </Card>
  )
}

function Dot({ on, label, partner = false }: { readonly on: boolean; readonly label: string; readonly partner?: boolean }) {
  return (
    <span
      className={cn('block size-3 rounded-full', on ? (partner ? 'bg-axis-custom-2' : 'bg-brand') : 'well')}
      title={`${label}: ${on ? 'avançou' : 'sem registro'}`}
    >
      <span className="sr-only">
        {label}: {on ? 'avançou' : 'sem registro'}
      </span>
    </span>
  )
}

/** Um gesto de incentivo: emoji grande, nome e o estado do dia. */
export function EncouragementTile({
  spec,
  suggested,
  sent,
  disabled,
  busy,
  onSend,
}: {
  readonly spec: EncouragementSpec
  readonly suggested: boolean
  readonly sent: boolean
  readonly disabled: boolean
  readonly busy: boolean
  readonly onSend: () => void
}) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      onClick={onSend}
      disabled={disabled || sent || busy}
      title={spec.hint}
      {...(reduce ? {} : { whileTap: { scale: 0.94 } })}
      className={cn(
        'relative flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-center transition-colors',
        sent ? 'bg-brand-dim' : suggested && !disabled ? 'card-float ring-2 ring-brand/50' : 'card',
        (disabled || busy) && !sent && 'opacity-50',
      )}
    >
      {suggested && !sent && !disabled ? (
        <StatusTag tone="solid" className="absolute -top-2 left-1/2 -translate-x-1/2 text-[0.6rem]">
          Sugerido
        </StatusTag>
      ) : null}
      <span aria-hidden="true" className="text-3xl leading-none">
        {spec.emoji}
      </span>
      <span className="text-[0.8rem] leading-tight font-semibold whitespace-nowrap text-ink">{spec.label}</span>
      <span className={cn('text-[0.68rem]', sent ? 'font-semibold text-brand-ink' : 'text-ink-faint')}>
        {sent ? 'Enviado ✓' : busy ? 'Enviando…' : 'Mandar'}
      </span>
    </motion.button>
  )
}
