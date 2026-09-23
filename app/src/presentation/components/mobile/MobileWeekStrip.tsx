import { dayKeyToDate } from '@/domain/entities/day'
import type { WeeklySummary } from '@/domain/entities/week'
import { cn } from '@/shared/lib/cn'

const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const

/**
 * A semana em uma faixa, logo abaixo da saudação.
 *
 * Junta duas coisas que antes ocupavam blocos separados: em que dia a pessoa
 * está e como foram os últimos sete. O dia de hoje é a única peça acesa, e o
 * ponto embaixo diz se aquele dia teve movimento.
 *
 * Sem contagem de sequência e sem cobrança: dia parado é um ponto apagado, não
 * um alerta. Quem quiser o número ("3 dias em movimento") lê na linha do lado,
 * que é texto e não emblema.
 */
export function MobileWeekStrip({ week }: { readonly week: WeeklySummary }) {
  const { series } = week
  const moving = series.filter((day) => day.intensity > 0).length

  return (
    <section aria-labelledby="semana-faixa" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="semana-faixa" className="sr-only">
          Sua semana
        </h2>
        <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">Sua semana</p>
        <p className="tabular text-xs text-ink-muted">
          {moving} {moving === 1 ? 'dia' : 'dias'} em movimento
        </p>
      </div>

      <ol className="flex items-stretch justify-between gap-1.5">
        {series.map((day, index) => {
          const date = dayKeyToDate(day.day)
          const isToday = index === series.length - 1
          const moved = day.intensity > 0

          return (
            <li key={day.day} className="flex-1">
              <div
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-2xl py-2.5 transition-colors',
                  isToday ? 'bg-brand text-white' : 'bg-surface',
                )}
              >
                <span
                  className={cn(
                    'text-[0.6875rem] font-medium',
                    isToday ? 'text-white/70' : 'text-ink-faint',
                  )}
                >
                  {WEEKDAY_INITIALS[date.getDay()]}
                </span>
                <span
                  className={cn(
                    'tabular text-sm leading-none font-semibold',
                    isToday ? 'text-white' : 'text-ink',
                  )}
                >
                  {date.getDate()}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 rounded-full',
                    isToday
                      ? moved
                        ? 'bg-white'
                        : 'bg-white/35'
                      : moved
                        ? 'bg-brand'
                        : 'bg-surface-top',
                  )}
                />
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
