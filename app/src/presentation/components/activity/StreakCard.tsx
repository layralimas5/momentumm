import { motion } from 'framer-motion'
import { addDays, type DayKey } from '@/domain/entities/day'
import type { Streak } from '@/domain/entities/streak'
import { cn } from '@/shared/lib/cn'

interface StreakCardProps {
  readonly streak: Streak
  readonly today: DayKey
  readonly activeDays: ReadonlySet<DayKey>
}

const WEEKDAY_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const

export function StreakCard({ streak, today, activeDays }: StreakCardProps) {
  const lastSevenDays = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6))

  return (
    <section
      aria-labelledby="streak-titulo"
      className="rounded-card border border-line bg-surface p-5"
    >
      <h2 id="streak-titulo" className="text-sm font-medium tracking-wide text-ink-muted uppercase">
        Sequência
      </h2>

      {/*
        O fogo anda colado no número. Empurrado pra borda oposta do card ele
        vira enfeite solto na tela larga do celular — e o que ele representa é
        exatamente aquele número, não a seção inteira.
      */}
      <div className="mt-2 flex items-center gap-3">
        <Flame active={streak.current > 0} atRisk={streak.atRisk} />
        <div className="min-w-0">
          <p className="flex items-baseline gap-2">
            <motion.span
              key={streak.current}
              initial={{ scale: 0.9, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="tabular text-4xl font-semibold text-ink"
            >
              {streak.current}
            </motion.span>
            <span className="text-sm text-ink-muted">
              {streak.current === 1 ? 'dia' : 'dias'}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Recorde: <span className="tabular">{streak.record}</span>
          </p>
        </div>
      </div>

      <ol className="mt-5 flex justify-between gap-1" aria-label="Últimos sete dias">
        {lastSevenDays.map((day, index) => {
          const done = activeDays.has(day)
          const isToday = day === today
          return (
            <li key={day} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  'h-8 w-full rounded-md border transition-colors',
                  done ? 'border-transparent bg-brand' : 'border-line bg-surface-hi',
                  isToday && !done && 'border-brand',
                )}
              />
              <span className="text-xs text-ink-faint">
                {WEEKDAY_INITIALS[(index + weekdayOffset(today)) % 7]}
              </span>
              <span className="sr-only">
                {day} {done ? 'com registro' : 'sem registro'}
              </span>
            </li>
          )
        })}
      </ol>

      {streak.atRisk ? (
        <p className="mt-4 rounded-lg border border-flame/30 bg-flame-dim/60 px-3 py-2 text-sm text-ink">
          Registra qualquer coisa hoje pra não perder a sequência.
        </p>
      ) : null}
    </section>
  )
}

/** Alinha as iniciais da semana com o primeiro dia mostrado (hoje menos 6). */
function weekdayOffset(today: DayKey): number {
  const [year, month, day] = today.split('-').map(Number) as [number, number, number]
  const start = new Date(year, month - 1, day - 6, 12)
  return (start.getDay() + 6) % 7
}

function Flame({ active, atRisk }: { active: boolean; atRisk: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('size-10 shrink-0', active ? 'text-flame' : 'text-line-hi')}
    >
      <path
        d="M12 2.5c.6 3.2-1.3 4.6-2.7 6.1-1.3 1.4-2.3 2.7-2.3 4.8a5 5 0 0 0 10 0c0-1.6-.6-2.8-1.4-3.9-.3 1-1 1.7-1.8 1.9.5-2.6-.4-6.1-1.8-8.9Z"
        fill="currentColor"
        opacity={atRisk ? 0.45 : 1}
      />
    </svg>
  )
}
