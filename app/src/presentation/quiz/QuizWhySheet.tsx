import type { QuizStrategy } from '@/domain/entities/quiz-strategy'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'

/**
 * "Por que o Momentumm escolheu isso?": cada recomendação ao lado da
 * resposta que a produziu. É o que faz a pessoa ver que a tela foi montada
 * com o que ela disse, e não tirada de um texto pronto.
 */
export function QuizWhySheet({
  open,
  strategy,
  onClose,
}: {
  readonly open: boolean
  readonly strategy: QuizStrategy
  readonly onClose: () => void
}) {
  return (
    <BottomSheet
      open={open}
      title="Por que o Momentumm escolheu isso?"
      description="Cada parte do plano saiu de uma resposta sua."
      onClose={onClose}
    >
      <div className="mb-5 border-b border-line pb-4">
        <p className="eyebrow text-[0.7rem] text-ink-faint">Seu padrão</p>
        <p className="mt-1.5 text-sm font-semibold text-ink">{strategy.pattern.headline}</p>
        <p className="mt-1 text-sm text-pretty text-ink-muted">{strategy.pattern.body}</p>
      </div>

      <dl className="flex flex-col gap-4">
        {strategy.interventions.map((item) => (
          <div key={item.key}>
            <dt className="text-sm font-semibold text-ink">{item.title}</dt>
            <dd className="mt-1 text-sm text-pretty text-ink-muted">{item.reason}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 border-t border-line pt-4">
        <p className="eyebrow text-[0.7rem] text-ink-faint">Começar, manter e retomar</p>
        <dl className="mt-2 flex flex-col gap-2">
          {strategy.indicators.map((indicator) => (
            <div key={indicator.dimension} className="flex gap-2 text-sm">
              <dt className="w-16 shrink-0 font-medium text-ink">{indicator.label}</dt>
              <dd className="text-pretty text-ink-muted">{indicator.reason}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-5 text-xs text-pretty text-ink-faint">
        Por enquanto, a leitura vem só das suas respostas. Quando você começar a registrar, o plano passa a se ajustar
        pelo que você faz de verdade.
      </p>
    </BottomSheet>
  )
}
