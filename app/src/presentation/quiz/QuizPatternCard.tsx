import {
  INDICATOR_LEVEL_LABELS,
  INDICATOR_TAG_LABELS,
  type IndicatorLevel,
  type IndicatorTag,
  type QuizIndicator,
  type QuizPattern,
} from '@/domain/entities/quiz-strategy'
import { Card, Eyebrow } from '@/presentation/components/ds/Card'
import { cn } from '@/shared/lib/cn'

/**
 * "Seu padrão": o que entendemos sobre a pessoa, em uma frase dela e três
 * indicadores. Nenhum número: o nível é palavra e barra, e a linha "com base
 * em" cita as respostas que produziram a frase.
 */
export function QuizPatternCard({
  pattern,
  indicators,
}: {
  readonly pattern: QuizPattern
  readonly indicators: readonly QuizIndicator[]
}) {
  return (
    <Card tone="float" aria-labelledby="quiz-padrao">
      <Eyebrow icon="pulso">Seu padrão</Eyebrow>
      <h2 id="quiz-padrao" className="mt-3 text-[1.2rem] leading-snug font-semibold tracking-tight text-balance text-ink">
        {pattern.headline}
      </h2>
      <p className="mt-2 text-sm text-pretty text-ink-muted">{pattern.body}</p>
      {pattern.evidence.length > 0 ? (
        <p className="mt-3 text-xs text-ink-faint">
          Com base em: {pattern.evidence.map((answer) => `“${answer}”`).join(', ')}
        </p>
      ) : null}

      <ul className="mt-4 grid grid-cols-3 gap-2">
        {indicators.map((indicator) => (
          <IndicatorTile key={indicator.dimension} indicator={indicator} />
        ))}
      </ul>
    </Card>
  )
}

const FILLED: Readonly<Record<IndicatorLevel, number>> = { facil: 1, moderado: 2, dificil: 3 }

const TAG_TONE: Readonly<Record<IndicatorTag, string>> = {
  principal_desafio: 'bg-brand-dim text-brand-hi',
  atencao: 'bg-surface-top text-ink-muted',
  ponto_forte: 'bg-positive/15 text-positive-ink',
}

const BAR_TONE: Readonly<Record<IndicatorLevel, string>> = {
  dificil: 'bg-brand-hi',
  moderado: 'bg-ink-muted',
  facil: 'bg-positive',
}

function IndicatorTile({ indicator }: { readonly indicator: QuizIndicator }) {
  const filled = FILLED[indicator.level]
  return (
    <li
      className={cn(
        'well flex flex-col rounded-2xl px-2.5 py-3',
        indicator.tag === 'principal_desafio' && 'ring-1 ring-brand/40',
      )}
    >
      <span className="eyebrow text-[0.68rem] text-ink-faint">{indicator.label}</span>
      <span className="mt-1 text-sm font-semibold text-ink">{INDICATOR_LEVEL_LABELS[indicator.level]}</span>
      <span aria-hidden="true" className="mt-2 flex gap-1">
        {[1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={cn('h-1 flex-1 rounded-full', segment <= filled ? BAR_TONE[indicator.level] : 'bg-line')}
          />
        ))}
      </span>
      <span
        className={cn(
          'mt-2.5 self-start rounded-lg px-2 py-0.5 text-[0.68rem] leading-tight font-medium',
          TAG_TONE[indicator.tag],
        )}
      >
        {INDICATOR_TAG_LABELS[indicator.tag]}
      </span>
    </li>
  )
}
