import { dayKeyToDate, type DayKey } from '@/domain/entities/day'
import type { WeeklySummary } from '@/domain/entities/week'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const

/**
 * A semana em uma faixa.
 *
 * Junta duas coisas que antes ocupavam blocos separados: em que dia a pessoa
 * está e como foram os últimos sete. O dia de hoje é a única peça marcada, e o
 * ponto embaixo diz se aquele dia teve movimento.
 *
 * Sem contagem de sequência e sem cobrança: dia parado é um ponto apagado, não
 * um alerta. Quem quiser o número ("3 dias em movimento") lê na linha de cima,
 * que é texto e não emblema.
 *
 * A faixa mora dentro de um card como o resto da tela. Solta no fundo, ela era
 * o único bloco sem casca da rolagem e parecia um resto de layout entre dois
 * cartões.
 */
export function MobileWeekStrip({
  week,
  onPickDay,
}: {
  readonly week: WeeklySummary
  /** Tocar num dia abre o que aconteceu nele. */
  readonly onPickDay: (day: DayKey) => void
}) {
  const { series } = week
  const moving = series.filter((day) => day.intensity > 0).length

  return (
    <section
      aria-labelledby="semana-faixa"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="semana-faixa" className="sr-only">
          Sua semana
        </h2>
        <p className="text-[0.6875rem] font-medium tracking-[0.12em] text-ink-faint uppercase">
          Sua semana
        </p>
        <p className="tabular flex items-center gap-1.5 text-xs text-ink-muted">
          <Icon name="hoje" className="size-3.5 text-brand-ink" strokeWidth={2} />
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
              {/*
                A célula inteira é o alvo do toque. Num quadrado desse tamanho,
                meio botão é pior que botão nenhum — e o dia só diz se houve
                movimento; o que houve está do outro lado deste toque.
              */}
              <button
                type="button"
                onClick={() => onPickDay(day.day)}
                aria-label={`Ver o dia ${date.getDate()}${moved ? ', com registro' : ', sem registro'}`}
                className={cn(
                  'flex w-full flex-col items-center gap-1.5 rounded-xl border py-2.5 transition-colors',
                  isToday
                    ? 'border-brand bg-brand-dim/60'
                    : 'border-transparent bg-surface-hi active:bg-surface-top',
                )}
              >
                <span
                  className={cn(
                    'text-[0.6875rem] font-medium',
                    isToday ? 'text-brand-ink' : 'text-ink-faint',
                  )}
                >
                  {WEEKDAY_INITIALS[date.getDay()]}
                </span>
                <span
                  className={cn(
                    'tabular text-sm leading-none font-semibold',
                    isToday ? 'text-ink' : 'text-ink-muted',
                  )}
                >
                  {date.getDate()}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 rounded-full',
                    moved ? (isToday ? 'bg-brand-hi' : 'bg-brand') : 'bg-line-hi',
                  )}
                />
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
