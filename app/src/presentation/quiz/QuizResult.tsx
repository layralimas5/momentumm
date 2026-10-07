import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import type { QuizPlanPreview } from '@/domain/entities/quiz'
import type { QuizStrategy } from '@/domain/entities/quiz-strategy'
import { QuizOffer } from './QuizOffer'
import { QuizPath } from './QuizPath'
import { QuizPatternCard } from './QuizPatternCard'
import { QuizStrategyList } from './QuizStrategyList'
import { QuizWhySheet } from './QuizWhySheet'
import { SystemCycle } from './SystemCycle'

/**
 * O resultado do quiz: a primeira demonstração de inteligência do produto.
 *
 * Tudo aqui responde uma de três perguntas, nessa ordem: o que entendemos
 * sobre mim (o padrão), como o Momentumm vai me ajudar (a estratégia e o
 * ciclo) e qual é o meu caminho a partir de hoje. Mais gráfico que texto:
 * a explicação longa existe, mas mora no sheet do porquê.
 */
export function QuizResult({
  firstName,
  strategy,
  preview,
}: {
  readonly firstName: string | null
  readonly strategy: QuizStrategy
  readonly preview: QuizPlanPreview
}) {
  const reduced = useReducedMotion()
  const [explaining, setExplaining] = useState(false)

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
        <p className="mt-1.5 text-sm text-ink-muted">Montado a partir das suas respostas.</p>
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

      <motion.div {...enter(4)}>
        <QuizPath milestones={preview.plan.milestones} step={preview.plan.firstStep} note={preview.adjustmentNote} />
      </motion.div>

      <QuizOffer />

      <QuizWhySheet open={explaining} strategy={strategy} onClose={() => setExplaining(false)} />
    </div>
  )
}
