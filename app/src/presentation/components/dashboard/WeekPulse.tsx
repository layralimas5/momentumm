import { dayKeyToDate } from '@/domain/entities/day'
import type { WeeklySummary } from '@/domain/entities/week'
import { cn } from '@/shared/lib/cn'

const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const

/**
 * O avanço da semana em sete pontos.
 *
 * É a resposta curta a "estou avançando?", no lugar onde a pessoa ainda está
 * decidindo o dia. O gráfico de barras continua existindo no Progresso, com os
 * minutos e a comparação; aqui basta saber quantos dias tiveram movimento.
 *
 * Um dia sem movimento é um ponto apagado, nunca um alerta: a leitura embaixo
 * conta o que aconteceu ("3 dias em movimento") em vez de cobrar o que faltou.
 * Sequência quebrada não zera nada no Momentumm, então a tela não pode sugerir
 * que zera.
 */
export function WeekPulse({ week, className }: { readonly week: WeeklySummary; readonly className?: string }) {
  const { series } = week
  const moving = series.filter((day) => day.intensity > 0).length
  const todayMoved = (series.at(-1)?.intensity ?? 0) > 0

  return (
    <section
      aria-labelledby="semana-pulso-titulo"
      className={cn('surface-card px-4 py-3.5', className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="semana-pulso-titulo" className="text-sm font-medium text-ink">
          Seu avanço esta semana
        </h2>
        <p className="tabular text-sm text-ink-muted">
          {moving} {moving === 1 ? 'dia' : 'dias'} em movimento
        </p>
      </div>

      <ol className="mt-3 flex items-center justify-between gap-1.5" aria-hidden="true">
        {series.map((day, index) => {
          const isToday = index === series.length - 1
          const moved = day.intensity > 0

          return (
            <li key={day.day} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  'size-2.5 rounded-full transition-colors duration-300',
                  moved ? 'bg-brand' : 'bg-surface-top',
                  // Hoje sem movimento ainda é um dia em aberto, não um dia perdido.
                  isToday && !moved && 'ring-1 ring-line-hi ring-offset-2 ring-offset-surface',
                  isToday && moved && 'ring-2 ring-brand/35 ring-offset-2 ring-offset-surface',
                )}
              />
              <span className={cn('text-[0.6875rem]', isToday ? 'text-ink-muted' : 'text-ink-faint')}>
                {WEEKDAY_INITIALS[dayKeyToDate(day.day).getDay()]}
              </span>
            </li>
          )
        })}
      </ol>

      <p className="sr-only">
        {moving} de sete dias com movimento nesta semana.
        {todayMoved ? ' Hoje já teve movimento.' : ' Hoje ainda está em aberto.'}
      </p>
    </section>
  )
}
