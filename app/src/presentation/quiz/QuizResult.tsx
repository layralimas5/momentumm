import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { formatDayLong, type DayKey } from '@/domain/entities/day'
import type { QuizPlanPreview } from '@/domain/entities/quiz'
import type { QuizStrategy } from '@/domain/entities/quiz-strategy'
import { Card, Eyebrow, IconWell } from '@/presentation/components/ds/Card'
import { Icon } from '@/presentation/components/ui/Icon'
import { QuizOffer } from './QuizOffer'
import { QuizPatternCard } from './QuizPatternCard'
import { QuizStrategyList } from './QuizStrategyList'
import { QuizWhySheet } from './QuizWhySheet'
import { SystemCycle } from './SystemCycle'

/**
 * O resultado do quiz: a primeira demonstração de inteligência do produto.
 *
 * Tudo aqui responde uma de três perguntas, nessa ordem: o que entendemos
 * sobre mim (o padrão), como o Momentumm vai me ajudar (a estratégia, o
 * ciclo e o primeiro marco) e qual é o meu primeiro passo. Nenhum número
 * inventado, nenhum prêmio antes de a pessoa fazer alguma coisa.
 */
export function QuizResult({
  firstName,
  strategy,
  preview,
  today,
}: {
  readonly firstName: string | null
  readonly strategy: QuizStrategy
  readonly preview: QuizPlanPreview
  readonly today: DayKey
}) {
  const reduced = useReducedMotion()
  const [explaining, setExplaining] = useState(false)
  const milestone = preview.plan.milestones[0] ?? null
  const step = preview.plan.firstStep

  const enter = (order: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay: order * 0.08, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <div className="flex flex-col gap-4 py-1">
      <motion.header {...enter(0)} className="px-1">
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance text-ink sm:text-3xl">
          {firstName ? `${firstName}, seu` : 'Seu'} Plano de Constância está pronto.
        </h1>
        <p className="mt-2 text-sm text-pretty text-ink-muted sm:text-base">
          Com base nas suas respostas, encontramos os pontos que mais podem atrapalhar sua constância, e montamos uma
          estratégia pra eles.
        </p>
      </motion.header>

      <motion.div {...enter(1)}>
        <QuizPatternCard pattern={strategy.pattern} indicators={strategy.indicators} />
      </motion.div>

      <motion.div {...enter(2)} className="mt-2">
        <QuizStrategyList interventions={strategy.interventions} onExplain={() => setExplaining(true)} />
      </motion.div>

      <motion.div {...enter(3)}>
        <SystemCycle />
      </motion.div>

      {milestone ? (
        <motion.div {...enter(4)}>
          <Card className="flex items-start gap-3.5" aria-labelledby="quiz-marco">
            <IconWell name="bandeira" />
            <div className="min-w-0">
              <Eyebrow tone="muted">Seu primeiro marco</Eyebrow>
              <h2 id="quiz-marco" className="mt-1.5 text-base font-semibold tracking-tight text-ink">
                {milestone.title}
              </h2>
              {milestone.description ? (
                <p className="mt-0.5 text-sm text-pretty text-ink-muted">{milestone.description}</p>
              ) : null}
              <p className="mt-1 text-xs text-ink-faint">até {formatDayLong(milestone.dueOn, today)}</p>
            </div>
          </Card>
        </motion.div>
      ) : null}

      {step ? (
        <motion.div {...enter(5)}>
          <Card tone="float" className="surface-brand-glow" aria-labelledby="quiz-passo">
            <Eyebrow icon="raio">Seu primeiro passo</Eyebrow>
            <h2 id="quiz-passo" className="mt-3 text-[1.15rem] leading-snug font-semibold tracking-tight text-ink">
              {step.title}
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              {step.estimatedMin ? (
                <span className="inline-flex items-center gap-1.5 tabular">
                  <Icon name="cronometro" className="size-4" />
                  {step.estimatedMin} min
                </span>
              ) : null}
              <span>Pronto pra hoje, assim que você entrar.</span>
            </p>
            {preview.adjustmentNote ? (
              <p className="well mt-3 rounded-2xl px-3.5 py-2.5 text-sm text-pretty text-ink-muted">
                {preview.adjustmentNote}
              </p>
            ) : null}
          </Card>
        </motion.div>
      ) : null}

      <QuizOffer />

      <QuizWhySheet open={explaining} strategy={strategy} onClose={() => setExplaining(false)} />
    </div>
  )
}
