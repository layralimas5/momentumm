import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { PlannedTask } from '@/domain/entities/plan-builder'
import type { QuizHabit } from '@/domain/entities/quiz'
import type { FirstStepNow, FirstStepVoice } from '@/domain/entities/quiz-first-step'
import { Card, Eyebrow } from '@/presentation/components/ds/Card'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { RevealWords } from './RevealWords'
import { cascade, EASE_SCATTER, EASE_SPRING_STRONG } from './quiz-motion'

/**
 * O primeiro passo, feito ainda dentro do quiz.
 *
 * Antes dele a pessoa só tinha lido um plano; depois dele ela já começou, e
 * a conta passa a ser o lugar onde isso fica guardado. Os botões moram na
 * barra de baixo (`QuizPage`); aqui é só o passo, o tempo correndo e, no
 * fim, o que a conta vai guardar.
 */
interface QuizFirstStepProps {
  readonly step: PlannedTask
  /** O que fazer agora: o passo, ou a versão mínima quando ele não cabe no dia. */
  readonly now: FirstStepNow
  readonly habit: QuizHabit
  readonly milestoneCount: number
  readonly voice: FirstStepVoice
  readonly done: boolean
  readonly running: boolean
  readonly elapsedSeconds: number
  readonly onSkip: () => void
}

export function QuizFirstStep(props: QuizFirstStepProps) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={props.done ? 'feito' : 'passo'}
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-4 py-1"
      >
        {props.done ? <StepDone {...props} /> : <StepToDo {...props} />}
      </motion.div>
    </AnimatePresence>
  )
}

function StepToDo({ step, now, voice, running, elapsedSeconds, onSkip }: QuizFirstStepProps) {
  return (
    <>
      <Card tone="float" className="surface-brand-glow flex flex-col gap-4" aria-labelledby="quiz-primeiro-passo">
        <Eyebrow icon="raio">Seu primeiro passo</Eyebrow>
        <div>
          <p className="text-sm text-ink-muted">{voice.lead}</p>
          <h1
            id="quiz-primeiro-passo"
            className="mt-1.5 text-2xl leading-snug font-semibold tracking-tight text-balance text-ink"
          >
            {now.title}
          </h1>
          {now.minutes ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-muted tabular">
              <Icon name="cronometro" className="size-4" />
              {now.minutes} min
            </p>
          ) : null}
        </div>

        {running ? <Stopwatch seconds={elapsedSeconds} targetMin={now.minutes} /> : null}

        {now.fullTitle ? (
          <p className="well rounded-2xl px-3.5 py-2.5 text-sm text-pretty text-ink-muted">
            É a versão que cabe no seu tempo de hoje. A completa, {lowerFirst(now.fullTitle)}, continua no plano.
          </p>
        ) : step.minimalVersion ? (
          <p className="well rounded-2xl px-3.5 py-2.5 text-sm text-ink-muted">
            Dia corrido? Vale a versão mínima: {step.minimalVersion.toLowerCase()}
          </p>
        ) : null}
      </Card>

      <p className="px-1 text-sm text-ink-faint">
        Agora não dá?{' '}
        <button
          type="button"
          onClick={onSkip}
          className="rounded font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          Criar a conta e fazer depois
        </button>
      </p>
    </>
  )
}

function Stopwatch({ seconds, targetMin }: { readonly seconds: number; readonly targetMin: number | null }) {
  const reached = targetMin !== null && seconds >= targetMin * 60
  return (
    <div className="well flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
      <span role="timer" aria-label="Tempo do passo" className="text-3xl font-semibold text-ink tabular">
        {clock(seconds)}
      </span>
      <span className="text-right text-xs text-ink-faint">
        {reached ? 'Tempo cumprido. Termina quando quiser.' : targetMin ? `de ${targetMin} min` : 'correndo'}
      </span>
    </div>
  )
}

function StepDone({ now, habit, milestoneCount, voice }: QuizFirstStepProps) {
  const saved = [
    `${now.title}, feito hoje`,
    `O plano com ${milestoneCount} ${milestoneCount === 1 ? 'marco' : 'marcos'} até o objetivo`,
    `O hábito: ${habit.name}`,
  ]
  const reduced = useReducedMotion()
  return (
    <Card tone="float" className="surface-brand-glow flex flex-col gap-4" aria-labelledby="quiz-passo-feito">
      <Trophy />
      <Eyebrow icon="check">Primeiro passo feito</Eyebrow>
      <div>
        <RevealWords
          id="quiz-passo-feito"
          text={voice.done}
          delay={0.45}
          perWord={0.08}
          className="text-2xl leading-snug font-semibold tracking-tight text-balance text-ink"
        />
        <motion.p {...cascade(0, reduced, 0.75)} className="mt-2 text-sm text-pretty text-ink-muted">
          {voice.save}
        </motion.p>
      </div>
      <ul className="flex flex-col gap-2">
        {saved.map((line, index) => (
          <motion.li
            key={line}
            {...cascade(index + 1, reduced, 0.75)}
            className="well flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm text-ink"
          >
            <Icon name="check" className="mt-0.5 size-4 shrink-0 text-brand-hi" />
            <span className="text-pretty">{line}</span>
          </motion.li>
        ))}
      </ul>
    </Card>
  )
}

/**
 * O troféu chega girando com mola, a luz estoura atrás dele e o confete
 * espalha. O confete é só roxo e claro: laranja é da sequência e de mais
 * nada no produto. Posições fixas, nada sorteado: o mesmo passo feito
 * comemora sempre do mesmo jeito.
 */
const CONFETTI = [
  { dx: -118, dy: -64, rot: -160, tone: 'bg-brand-hi', w: 'w-2' },
  { dx: -92, dy: -104, rot: 220, tone: 'bg-brand', w: 'w-1.5' },
  { dx: -54, dy: -128, rot: -90, tone: 'bg-ink', w: 'w-1.5' },
  { dx: -16, dy: -140, rot: 140, tone: 'bg-brand-hi', w: 'w-2' },
  { dx: 22, dy: -134, rot: -200, tone: 'bg-brand', w: 'w-1.5' },
  { dx: 60, dy: -118, rot: 120, tone: 'bg-ink', w: 'w-1.5' },
  { dx: 96, dy: -92, rot: -140, tone: 'bg-brand-hi', w: 'w-2' },
  { dx: 122, dy: -52, rot: 200, tone: 'bg-brand', w: 'w-1.5' },
  { dx: -132, dy: -18, rot: 90, tone: 'bg-brand', w: 'w-1.5' },
  { dx: 136, dy: -10, rot: -110, tone: 'bg-brand-hi', w: 'w-1.5' },
  { dx: -74, dy: -40, rot: 180, tone: 'bg-ink', w: 'w-1' },
  { dx: 78, dy: -36, rot: -180, tone: 'bg-ink', w: 'w-1' },
] as const

function Trophy() {
  const reduced = useReducedMotion()
  const medal = (
    <span className="relative grid size-16 place-items-center rounded-full bg-gradient-to-br from-brand-hi to-brand text-white shadow-[0_0_32px_-4px_var(--color-brand-hi)]">
      <Icon name="trofeu" className="size-7" />
    </span>
  )
  if (reduced) {
    return (
      <div aria-hidden="true" className="flex justify-center pt-1">
        {medal}
      </div>
    )
  }
  return (
    <div aria-hidden="true" className="relative flex justify-center pt-1">
      <motion.span
        className="absolute top-1/2 left-1/2 -mt-24 -ml-24 size-48 rounded-full bg-[radial-gradient(circle,var(--color-brand-hi)_0%,transparent_62%)]"
        initial={{ opacity: 0, scale: 0.22 }}
        animate={{ opacity: [0, 0.55, 0], scale: [0.22, 1.2, 2.1] }}
        transition={{ duration: 1.1, delay: 0.18, times: [0, 0.28, 1], ease: [0.12, 0.68, 0.3, 1] }}
      />
      {CONFETTI.map((piece, index) => (
        <motion.span
          key={index}
          className={cn('absolute top-1/2 left-1/2 h-2.5 rounded-[2px]', piece.tone, piece.w)}
          initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: [0, 1, 0], x: piece.dx, y: piece.dy, rotate: piece.rot }}
          transition={{ duration: 1.1, delay: 0.22 + (index % 4) * 0.02, ease: EASE_SCATTER, opacity: { times: [0, 0.12, 1], duration: 1.1, delay: 0.22 } }}
        />
      ))}
      <motion.span
        className="relative"
        initial={{ opacity: 0, scale: 0.25, rotate: -14 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.66, ease: EASE_SPRING_STRONG }}
      >
        {medal}
      </motion.span>
    </div>
  )
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function clock(total: number): string {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
