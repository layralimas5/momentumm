import {
  INDICATOR_LEVEL_LABELS,
  type IndicatorLevel,
  type QuizIndicator,
  type QuizPattern,
} from '@/domain/entities/quiz-strategy'
import { Card, Eyebrow } from '@/presentation/components/ds/Card'
import { cn } from '@/shared/lib/cn'

/**
 * "Seu padrão": a frase e três medidores. O texto longo que explica a frase
 * mora no sheet do porquê; aqui ficam só as respostas que a sustentam, em
 * chips, pra a pessoa reconhecer o que ela mesma disse.
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

      {pattern.evidence.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Com base nas suas respostas">
          {pattern.evidence.map((answer) => (
            <li key={answer} className="chip rounded-full px-2.5 py-1 text-xs text-ink-muted">
              “{answer}”
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="mt-5 grid grid-cols-3 gap-2">
        {indicators.map((indicator) => (
          <Gauge key={indicator.dimension} indicator={indicator} />
        ))}
      </ul>
    </Card>
  )
}

const FILLED: Readonly<Record<IndicatorLevel, number>> = { facil: 1, moderado: 2, dificil: 3 }

const ARC_TONE: Readonly<Record<IndicatorLevel, string>> = {
  dificil: 'var(--color-brand-hi)',
  moderado: 'var(--color-ink-muted)',
  facil: 'var(--color-positive)',
}

/** Semicírculo em três gomos: um aceso é fácil, três é difícil. */
const SEGMENTS = [
  { from: 180, to: 124 },
  { from: 118, to: 62 },
  { from: 56, to: 0 },
] as const

function arcPath(from: number, to: number): string {
  const radius = 34
  const cx = 44
  const cy = 42
  const point = (angle: number) => {
    const radians = (angle * Math.PI) / 180
    return `${cx + radius * Math.cos(radians)} ${cy - radius * Math.sin(radians)}`
  }
  return `M ${point(from)} A ${radius} ${radius} 0 0 1 ${point(to)}`
}

function Gauge({ indicator }: { readonly indicator: QuizIndicator }) {
  const principal = indicator.tag === 'principal_desafio'
  const filled = FILLED[indicator.level]
  return (
    <li
      className={cn(
        'well relative flex flex-col items-center rounded-2xl px-1.5 pt-3 pb-2.5',
        principal && 'ring-1 ring-brand/50',
      )}
    >
      <svg viewBox="0 0 88 48" aria-hidden="true" className="w-full max-w-[5.5rem]">
        {SEGMENTS.map((segment, index) => (
          <path
            key={index}
            d={arcPath(segment.from, segment.to)}
            fill="none"
            strokeWidth={7}
            strokeLinecap="round"
            stroke={index < filled ? ARC_TONE[indicator.level] : 'var(--color-line)'}
          />
        ))}
      </svg>
      <span className="-mt-1 text-sm font-semibold text-ink">{INDICATOR_LEVEL_LABELS[indicator.level]}</span>
      <span className="eyebrow mt-0.5 text-[0.65rem] text-ink-faint">{indicator.label}</span>
      {principal ? (
        <span className="absolute -top-2 rounded-full bg-brand px-2 py-0.5 text-[0.62rem] font-semibold text-white">
          Seu desafio
        </span>
      ) : null}
    </li>
  )
}
