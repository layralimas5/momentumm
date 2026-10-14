import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'
import { dayKeyToDate, type DayKey } from '@/domain/entities/day'
import type { PlannedStage } from '@/domain/entities/plan-builder'
import type { FirstStepNow } from '@/domain/entities/quiz-first-step'
import { Card, Eyebrow } from '@/presentation/components/ds/Card'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { EASE_DRAW, EASE_SPRING, EASE_SPRING_STRONG, timeAtProgress } from './quiz-motion'

/**
 * "Seu caminho": hoje e os três marcos do plano numa linha só, com as datas
 * reais. Embaixo, o passo de hoje, que é pra onde o botão leva. É o primeiro
 * marco no lugar de um prêmio: nada aqui diz que já foi conquistado.
 *
 * Quando o card entra na tela, a linha se desenha de hoje até o último marco
 * com um brilho na ponta, e cada marco acende no instante em que a ponta
 * passa por ele; o passo de hoje pousa depois. É o gráfico da Cláudia, mas
 * sobre o caminho de verdade: as datas são do plano, não uma curva prevista.
 */

/** Quando a linha começa e quanto ela leva, em segundos. */
const DRAW_DELAY = 0.3
const DRAW_DURATION = 1.35
export function QuizPath({
  milestones,
  step,
  note,
}: {
  readonly milestones: readonly PlannedStage[]
  /** O passo de agora, já ajustado ao tempo declarado (`firstStepNow`). */
  readonly step: FirstStepNow | null
  readonly note: string | null
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLOListElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.6 })
  const play = !reduced && seen
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

      <ol ref={ref} className="relative mt-5 grid" style={{ gridTemplateColumns: `repeat(${nodes.length}, minmax(0, 1fr))` }}>
        <span aria-hidden="true" className="absolute top-3.5 right-[12%] left-[12%] h-0.5 bg-line" />
        {reduced ? (
          <span aria-hidden="true" className="absolute top-3.5 left-[12%] h-0.5 w-[14%] bg-gradient-to-r from-brand-hi to-brand/0" />
        ) : (
          <DrawnLine play={play} />
        )}
        {nodes.map((node, index) => (
          <li key={node.key} className="relative flex flex-col items-center px-0.5 text-center">
            {node.current ? (
              <TodayBeacon />
            ) : (
              <Milestone index={index} reach={reachAt(index, nodes.length)} play={play} reduced={!!reduced} />
            )}
            <span className={cn('mt-2 line-clamp-2 text-[0.72rem] leading-tight', node.current ? 'font-semibold text-ink' : 'text-ink-muted')}>
              {node.title}
            </span>
            <span className="mt-0.5 text-[0.65rem] text-ink-faint tabular">{node.date}</span>
          </li>
        ))}
      </ol>

      {step ? (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: -10, scale: 0.94 }}
          animate={play || reduced ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -10, scale: 0.94 }}
          transition={{ duration: 0.55, delay: DRAW_DELAY + DRAW_DURATION, ease: EASE_SPRING }}
          className="well mt-5 flex items-center gap-3 rounded-2xl px-3.5 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-faint">Seu primeiro passo</p>
            <p className="mt-0.5 text-sm leading-snug font-semibold text-ink">{step.title}</p>
          </div>
          {step.minutes ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-dim px-2.5 py-1 text-xs font-semibold text-brand-hi tabular">
              <Icon name="cronometro" className="size-3.5" />
              {step.minutes} min
            </span>
          ) : null}
        </motion.div>
      ) : null}

      {note ? <p className="mt-3 text-xs text-pretty text-ink-faint">{note}</p> : null}
    </Card>
  )
}

/** Quando a ponta da linha chega no marco `index`, em segundos. */
function reachAt(index: number, count: number): number {
  return DRAW_DELAY + DRAW_DURATION * timeAtProgress(EASE_DRAW, index / (count - 1))
}

/**
 * A linha que se desenha e o brilho que corre na ponta dela. Os dois usam a
 * mesma curva e o mesmo tempo, então a ponta está sempre onde a linha termina.
 */
function DrawnLine({ play }: { readonly play: boolean }) {
  const timing = { duration: DRAW_DURATION, delay: DRAW_DELAY, ease: EASE_DRAW }
  return (
    <>
      <motion.span
        aria-hidden="true"
        className="absolute top-3.5 right-[12%] left-[12%] h-0.5 origin-left rounded-full bg-gradient-to-r from-brand-hi via-brand to-brand/40"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: play ? 1 : 0 }}
        transition={timing}
      />
      <motion.span
        aria-hidden="true"
        className="absolute top-3.5 -mt-1 -ml-1.5 size-2.5 rounded-full bg-brand-hi shadow-[0_0_14px_3px_var(--color-brand-hi)]"
        initial={{ left: '12%', opacity: 0 }}
        animate={play ? { left: '88%', opacity: [0, 1, 1, 0] } : { left: '12%', opacity: 0 }}
        transition={{ ...timing, opacity: { duration: DRAW_DURATION + 0.25, delay: DRAW_DELAY, times: [0, 0.08, 0.86, 1] } }}
      />
    </>
  )
}

/** O marco apagado até a linha chegar; aí ele acende com mola e solta um anel. */
function Milestone({
  index,
  reach,
  play,
  reduced,
}: {
  readonly index: number
  readonly reach: number
  readonly play: boolean
  readonly reduced: boolean
}) {
  const base = 'grid size-7 place-items-center rounded-full text-[0.7rem] font-semibold'
  if (reduced) {
    return (
      <span aria-hidden="true" className={cn('well', base, 'text-ink-faint')}>
        {index}
      </span>
    )
  }
  return (
    <span aria-hidden="true" className="relative grid size-7 place-items-center">
      {play ? (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-brand-hi"
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.7, 0], scale: [1, 1, 2.3] }}
          transition={{ duration: 1, delay: reach, times: [0, 0.01, 1], ease: [0.2, 0.6, 0.4, 1] }}
        />
      ) : null}
      <motion.span
        className={cn('well relative', base)}
        initial={{ scale: 0.42, opacity: 0.35 }}
        animate={play ? { scale: 1, opacity: 1 } : { scale: 0.42, opacity: 0.35 }}
        transition={{ duration: 0.5, delay: reach, ease: EASE_SPRING_STRONG }}
      >
        <motion.span
          initial={{ color: 'var(--color-ink-faint)' }}
          animate={{ color: play ? 'var(--color-brand-hi)' : 'var(--color-ink-faint)' }}
          transition={{ duration: 0.3, delay: reach }}
        >
          {index}
        </motion.span>
      </motion.span>
    </span>
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
