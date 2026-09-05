import { dayKeyToDate, type DayKey } from '@/domain/entities/day'
import { Icon } from '@/presentation/components/ui/Icon'
import { ProgressBar } from '@/presentation/components/ui/Surface'
import type { DayProgress } from '@/presentation/planner/use-dashboard'

/**
 * A abertura do dia: quem, quando, quanto já saiu e o que ficou de ontem.
 *
 * O percentual conta hábito e ação juntos porque é assim que o dia é vivido —
 * separar em dois números faz a pessoa precisar somar de cabeça pra responder
 * "quanto eu já fiz hoje", que é a pergunta que ela tem ao abrir o app.
 */
export function DayHeader({
  name,
  today,
  progress,
  resumeNote,
  compact = false,
}: {
  readonly name: string | null
  readonly today: DayKey
  readonly progress: DayProgress
  readonly resumeNote: string | null
  /**
   * No celular a barra de cima já traz saudação e data. Repetir as duas aqui
   * empurraria o conteúdo do dia pra baixo da dobra sem informação nova.
   */
  readonly compact?: boolean
}) {
  const date = dayKeyToDate(today)
  const formatted = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {compact ? null : (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink lg:text-[1.75rem]">
              {greeting(new Date().getHours())}
              {name ? `, ${name}` : ''}
            </h2>
            <p className="mt-1 text-sm text-ink-faint first-letter:uppercase">{formatted}</p>
          </div>
        )}

        {progress.total > 0 ? (
          <div className="min-w-48 flex-1 sm:max-w-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-ink-faint">Progresso do dia</span>
              <span className="tabular text-sm font-semibold text-ink">
                {Math.round(progress.ratio * 100)}%
              </span>
            </div>
            <ProgressBar
              className="mt-1.5"
              value={progress.ratio}
              label={`Progresso do dia: ${progress.done} de ${progress.total}`}
            />
            <p className="tabular mt-1 text-right text-xs text-ink-faint">
              {progress.done} de {progress.total}
            </p>
          </div>
        ) : null}
      </div>

      {resumeNote ? (
        <p className="flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-3 text-sm text-ink-muted">
          <Icon name="desfazer" className="mt-0.5 size-4 shrink-0 text-ink-faint" />
          <span className="text-pretty">{resumeNote}</span>
        </p>
      ) : null}
    </header>
  )
}

function greeting(hour: number): string {
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}
