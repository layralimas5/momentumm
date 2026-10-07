import type { Intervention, InterventionKey } from '@/domain/entities/quiz-strategy'
import { Card, IconWell, SectionHeader } from '@/presentation/components/ds/Card'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { InterventionChart } from './InterventionChart'

/**
 * "Sua estratégia": as três intervenções que o motor escolheu. Cada card é
 * título, uma frase e um gráfico do mecanismo, montado com o plano da
 * pessoa. A explicação longa fica atrás do link do porquê.
 */

const ICONS: Readonly<Record<InterventionKey, IconName>> = {
  recovery_plan: 'retomar',
  minimum_action: 'minimo',
  progress_tracking: 'tendencia',
  implementation_intention: 'raio',
  daily_priority: 'objetivo',
  graded_task: 'plano',
  habit_anchor: 'relogio',
  weekly_review: 'calendario',
}

export function QuizStrategyList({
  interventions,
  onExplain,
}: {
  readonly interventions: readonly Intervention[]
  readonly onExplain: () => void
}) {
  return (
    <section aria-labelledby="quiz-estrategia" className="flex flex-col gap-3">
      <SectionHeader id="quiz-estrategia" title="Sua estratégia" caps aside="3 movimentos" />

      <ol className="flex flex-col gap-3">
        {interventions.map((item) => (
          <li key={item.key}>
            <Card className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <IconWell name={ICONS[item.key]} />
                <div className="min-w-0">
                  <h3 className="text-base leading-tight font-semibold tracking-tight text-ink">{item.title}</h3>
                  <p className="mt-0.5 text-sm text-ink-muted">{item.promise}</p>
                </div>
              </div>
              <InterventionChart detail={item.detail} />
            </Card>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onExplain}
        className="flex min-h-11 items-center justify-center gap-1.5 self-center rounded-full px-3 text-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:text-ink"
      >
        <Icon name="lampada" className="size-4" />
        Por que o Momentumm escolheu isso?
      </button>
    </section>
  )
}
