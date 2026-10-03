import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'
import { CheckButton } from './Controls'

/**
 * Uma linha do dia: caixa, atividade, XP, contexto e etiqueta. Nada além.
 * A descrição longa mora no editor, não na lista.
 */
export function ActivityItem({
  title,
  done,
  skipped = false,
  onToggle,
  xp,
  meta,
  tag,
  busy = false,
  onOpen,
}: {
  readonly title: string
  readonly done: boolean
  readonly skipped?: boolean
  readonly onToggle: () => void
  readonly xp?: number
  readonly meta?: ReactNode
  readonly tag?: ReactNode
  readonly busy?: boolean
  readonly onOpen?: () => void
}) {
  const resolved = done || skipped

  return (
    <li className="card flex items-center gap-3.5 rounded-[1.15rem] px-3.5 py-2.5">
      <CheckButton
        done={done}
        onToggle={onToggle}
        label={done ? `Desmarcar ${title}` : `Concluir ${title}`}
        disabled={busy}
        {...(xp ? { xp } : {})}
      />
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="min-w-0 flex-1 text-left disabled:cursor-default"
      >
        <span
          className={cn(
            'block truncate text-[0.9rem] font-medium transition-colors',
            resolved ? 'text-ink-faint line-through decoration-ink-faint/60' : 'text-ink',
          )}
        >
          {title}
        </span>
        {xp || meta ? (
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-faint">
            {xp ? <span className="font-semibold text-brand-hi tabular">+{xp} XP</span> : null}
            {xp && meta ? <span aria-hidden="true">·</span> : null}
            {meta ? <span className="flex min-w-0 items-center gap-1 truncate">{meta}</span> : null}
          </span>
        ) : null}
      </button>
      {tag ? <div className="shrink-0">{tag}</div> : null}
    </li>
  )
}

export type TimelineState = 'done' | 'now' | 'next'

/** Um ponto da linha do tempo vertical: hora, marcador, bloco. */
export function TimelineItem({
  time,
  title,
  subtitle,
  state,
  tag,
  last = false,
}: {
  readonly time: string
  readonly title: string
  readonly subtitle?: string | null
  readonly state: TimelineState
  readonly tag?: ReactNode
  readonly last?: boolean
}) {
  const reduce = useReducedMotion()
  const now = state === 'now'

  return (
    <li className="grid grid-cols-[3.25rem_1.25rem_minmax(0,1fr)] gap-x-3">
      <span className={cn('pt-3 text-right text-sm tabular', now ? 'font-semibold text-brand-hi' : 'text-ink-faint')}>
        {time}
      </span>

      <span className="relative flex justify-center" aria-hidden="true">
        {last ? null : <span className="absolute top-6 bottom-0 w-px bg-line-hi" />}
        <span
          className={cn(
            'relative mt-3.5 grid size-4 place-items-center rounded-full',
            state === 'done' && 'bg-brand/45',
            now && 'bg-brand ring-4 ring-brand/20',
            state === 'next' && 'well',
          )}
        >
          {now && !reduce ? (
            <motion.span
              className="absolute inset-0 rounded-full bg-brand"
              animate={{ scale: [1, 1.9], opacity: [0.45, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            />
          ) : null}
          {now ? <span className="relative size-1.5 rounded-full bg-white" /> : null}
        </span>
      </span>

      <div className={cn('pb-5', now && 'pb-6')}>
        <div className={cn(now ? 'card-float rounded-[1.2rem] px-4 py-3' : 'pt-2.5')}>
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p
              className={cn(
                'min-w-0 truncate text-sm font-medium',
                state === 'done' ? 'text-ink-faint line-through decoration-ink-faint/60' : 'text-ink',
              )}
            >
              {title}
            </p>
            {tag}
          </div>
          {subtitle ? <p className="mt-0.5 truncate text-[0.8rem] text-ink-faint">{subtitle}</p> : null}
        </div>
      </div>
    </li>
  )
}
