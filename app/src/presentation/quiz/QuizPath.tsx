import { motion, useReducedMotion } from 'framer-motion'
import { dayKeyToDate, type DayKey } from '@/domain/entities/day'
import type { PlannedStage, PlannedTask } from '@/domain/entities/plan-builder'
import { Card, Eyebrow } from '@/presentation/components/ds/Card'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * "Seu caminho": hoje e os três marcos do plano numa linha só, com as datas
 * reais. Embaixo, o passo de hoje, que é pra onde o botão leva. É o primeiro
 * marco no lugar de um prêmio: nada aqui diz que já foi conquistado.
 */
export function QuizPath({
  milestones,
  step,
  note,
}: {
  readonly milestones: readonly PlannedStage[]
  readonly step: PlannedTask | null
  readonly note: string | null
}) {
  const nodes = [
    { key: 'hoje', title: 'Hoje', date: 'primeiro passo', current: true },
    ...milestones.map((stage) => ({ key: stage.title, title: stage.title, date: shortDate(stage.dueOn), current: false })),
  ]

  return (
    <Card tone="float" aria-labelledby="quiz-caminho">
      <Eyebrow icon="bandeira">Seu caminho</Eyebrow>
      <h2 id="quiz-caminho" className="sr-only">
        Seu caminho até o objetivo
      </h2>

      <ol className="relative mt-5 grid" style={{ gridTemplateColumns: `repeat(${nodes.length}, minmax(0, 1fr))` }}>
        <span aria-hidden="true" className="absolute top-3.5 right-[12%] left-[12%] h-0.5 bg-line" />
        <span aria-hidden="true" className="absolute top-3.5 left-[12%] h-0.5 w-[14%] bg-gradient-to-r from-brand-hi to-brand/0" />
        {nodes.map((node, index) => (
          <li key={node.key} className="relative flex flex-col items-center px-0.5 text-center">
            {node.current ? (
              <TodayBeacon />
            ) : (
              <span
                aria-hidden="true"
                className="well grid size-7 place-items-center rounded-full text-[0.7rem] font-semibold text-ink-faint"
              >
                {index}
              </span>
            )}
            <span className={cn('mt-2 line-clamp-2 text-[0.72rem] leading-tight', node.current ? 'font-semibold text-ink' : 'text-ink-muted')}>
              {node.title}
            </span>
            <span className="mt-0.5 text-[0.65rem] text-ink-faint tabular">{node.date}</span>
          </li>
        ))}
      </ol>

      {step ? (
        <div className="well mt-5 flex items-center gap-3 rounded-2xl px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-faint">Seu primeiro passo</p>
            <p className="mt-0.5 text-sm leading-snug font-semibold text-ink">{step.title}</p>
          </div>
          {step.estimatedMin ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-dim px-2.5 py-1 text-xs font-semibold text-brand-hi tabular">
              <Icon name="cronometro" className="size-3.5" />
              {step.estimatedMin} min
            </span>
          ) : null}
        </div>
      ) : null}

      {note ? <p className="mt-3 text-xs text-pretty text-ink-faint">{note}</p> : null}
    </Card>
  )
}

/** O "Hoje" pulsando: é o único ponto do caminho que pede ação agora. */
function TodayBeacon() {
  const reduced = useReducedMotion()
  return (
    <span aria-hidden="true" className="relative grid size-7 place-items-center">
      {reduced ? null : (
        <>
          <motion.span
            className="absolute inset-0 rounded-full bg-brand-hi blur-md"
            animate={{ opacity: [0.45, 0.95, 0.45], scale: [1, 1.45, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.span
            className="absolute inset-0 rounded-full border border-brand-hi"
            animate={{ opacity: [0.7, 0], scale: [1, 2.1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
          />
        </>
      )}
      <span className="relative grid size-7 place-items-center rounded-full bg-gradient-to-br from-brand-hi to-brand text-white shadow-[0_0_22px_-2px_var(--color-brand-hi)]">
        <Icon name="raio" className="size-3.5" filled />
      </span>
    </span>
  )
}

function shortDate(day: DayKey): string {
  return dayKeyToDate(day)
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
    .replace('.', '')
}
