import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { PlannedTask } from '@/domain/entities/plan-builder'
import type { QuizHabit } from '@/domain/entities/quiz'
import type { FirstStepNow, FirstStepVoice } from '@/domain/entities/quiz-first-step'
import { Card, Eyebrow } from '@/presentation/components/ds/Card'
import { Icon } from '@/presentation/components/ui/Icon'

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
  return (
    <Card tone="float" className="surface-brand-glow flex flex-col gap-4" aria-labelledby="quiz-passo-feito">
      <Eyebrow icon="trofeu">Primeiro passo feito</Eyebrow>
      <div>
        <h1 id="quiz-passo-feito" className="text-2xl leading-snug font-semibold tracking-tight text-balance text-ink">
          {voice.done}
        </h1>
        <p className="mt-2 text-sm text-pretty text-ink-muted">{voice.save}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {saved.map((line) => (
          <li key={line} className="well flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm text-ink">
            <Icon name="check" className="mt-0.5 size-4 shrink-0 text-brand-hi" />
            <span className="text-pretty">{line}</span>
          </li>
        ))}
      </ul>
    </Card>
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
