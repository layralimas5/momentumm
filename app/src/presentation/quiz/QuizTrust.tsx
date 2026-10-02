import { motion, useReducedMotion } from 'framer-motion'
import { obstacleAnswers, type QuizAnswers, type QuizAreaContext } from '@/domain/entities/quiz'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * A tela de confiança, no meio das perguntas e antes das mais pesadas.
 *
 * Uma ideia só, mostrada em vez de dita: a mesma semana com dois finais. O
 * plano comum zera na primeira falha; o Momentumm segue com versão mínima e
 * retomada. Embaixo, a resposta pra dificuldade principal que a pessoa
 * acabou de marcar, e uma linha de garantias. Nada além disso: a tela é uma
 * pausa, não uma página de vendas.
 *
 * A semana é simulação e diz que é. A prova com número real (usuários,
 * avaliação) entra em `QUIZ_PROOF` quando existir, e aparece sozinha.
 */
const QUIZ_PROOF: readonly { readonly value: string; readonly label: string }[] = []

const EASE = [0.22, 1, 0.36, 1] as const

interface QuizTrustProps {
  readonly answers: QuizAnswers
  readonly area: QuizAreaContext
}

export function QuizTrust({ answers, area }: QuizTrustProps) {
  const reduced = useReducedMotion() === true
  const [main] = obstacleAnswers(answers)
  const enter = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: EASE },
        }

  return (
    <div className="flex flex-col">
      <motion.header {...enter(0)}>
        <p className="text-xs font-medium tracking-wide text-brand-ink uppercase">Antes de continuar</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-balance text-ink">
          Aqui, um dia ruim não derruba a semana.
        </h1>
      </motion.header>

      {QUIZ_PROOF.length > 0 ? (
        <motion.dl {...enter(0.05)} className="mt-4 grid grid-cols-2 gap-2.5">
          {QUIZ_PROOF.map((item) => (
            <div key={item.label} className="rounded-2xl border border-line bg-surface/60 p-3.5">
              <dt className="text-xs text-ink-faint">{item.label}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink tabular-nums">{item.value}</dd>
            </div>
          ))}
        </motion.dl>
      ) : null}

      <motion.div {...enter(0.1)} className="mt-5">
        <WeekComparison reduced={reduced} minimalExample={area.minimalExample} />
      </motion.div>

      {main ? (
        <motion.div
          {...enter(0.2)}
          className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-surface/60 p-3.5"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-positive/15 text-positive">
            <Icon name="check" className="size-3.5" />
          </span>
          <p className="min-w-0 text-sm text-pretty text-ink-muted">
            <span className="font-semibold text-ink">{main.label}?</span> {main.answer}
          </p>
        </motion.div>
      ) : null}

      <motion.ul
        {...enter(0.3)}
        aria-label="Garantias"
        className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-ink-muted"
      >
        {SEALS.map((seal) => (
          <li key={seal.label} className="inline-flex items-center gap-1.5">
            <Icon name={seal.icon} className="size-3.5 text-brand-ink" />
            {seal.label}
          </li>
        ))}
      </motion.ul>
    </div>
  )
}

const SEALS: readonly { readonly icon: IconName; readonly label: string }[] = [
  { icon: 'cadeado', label: 'Privado' },
  { icon: 'check', label: 'Grátis, sem cartão' },
  { icon: 'desfazer', label: 'Sem fidelidade' },
]

// ---------------------------------------------------------------------------
// a mesma semana, dois finais
// ---------------------------------------------------------------------------

type DayState = 'feito' | 'minimo' | 'perdido' | 'retomada' | 'zerado'

const DAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const

/** O plano comum: perde a quarta e a sequência zera dali em diante. */
const COMMON_WEEK: readonly DayState[] = ['feito', 'feito', 'perdido', 'zerado', 'zerado', 'zerado', 'zerado']
/** O Momentumm: dia apertado vira versão mínima, a falta vira retomada, e a semana fecha. */
const MOMENTUMM_WEEK: readonly DayState[] = ['feito', 'minimo', 'perdido', 'retomada', 'feito', 'feito', 'feito']

function WeekComparison({ reduced, minimalExample }: { readonly reduced: boolean; readonly minimalExample: string }) {
  return (
    <figure className="relative overflow-hidden rounded-3xl border border-brand/40 bg-surface p-4 shadow-2xl shadow-brand/15">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-brand/25 blur-3xl"
      />
      <figcaption className="sr-only">
        Simulação de uma semana: no plano comum, um dia perdido zera a sequência; no Momentumm, a semana
        continua com versão mínima e retomada.
      </figcaption>

      <div className="relative flex flex-col gap-4">
        <WeekRow
          title="Plano comum"
          week={COMMON_WEEK}
          outcome="Perdeu um dia, zerou tudo."
          tone="common"
          reduced={reduced}
          delay={0.2}
        />
        <WeekRow
          title="No Momentumm"
          week={MOMENTUMM_WEEK}
          outcome="Perdeu um dia, a semana fechou."
          tone="momentumm"
          reduced={reduced}
          delay={0.8}
        />
      </div>

      <ul className="relative mt-4 flex flex-col gap-1.5 border-t border-line pt-3 text-xs text-ink-muted">
        <li className="flex items-start gap-2">
          <Glyph state="minimo" />
          <span className="text-pretty">Dia apertado vira versão mínima ({minimalExample}).</span>
        </li>
        <li className="flex items-start gap-2">
          <Glyph state="retomada" />
          <span className="text-pretty">Depois de uma falta, você volta de onde parou.</span>
        </li>
      </ul>
    </figure>
  )
}

interface WeekRowProps {
  readonly title: string
  readonly week: readonly DayState[]
  readonly outcome: string
  readonly tone: 'common' | 'momentumm'
  readonly reduced: boolean
  readonly delay: number
}

function WeekRow({ title, week, outcome, tone, reduced, delay }: WeekRowProps) {
  const isMomentumm = tone === 'momentumm'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn('text-xs font-semibold', isMomentumm ? 'text-brand-ink' : 'text-ink-faint')}>{title}</p>
        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: reduced ? 0 : delay + 0.6 }}
          className={cn('text-xs font-medium', isMomentumm ? 'text-positive' : 'text-danger')}
        >
          {outcome}
        </motion.p>
      </div>

      <ol aria-hidden="true" className="mt-2 grid grid-cols-7 gap-1.5">
        {week.map((state, index) => (
          <motion.li
            key={index}
            initial={reduced ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: reduced ? 0 : delay + index * 0.07, ease: EASE }}
            className="flex flex-col items-center gap-1"
          >
            <DayDot state={state} />
            <span className="text-[10px] text-ink-faint">{DAYS[index]}</span>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}

const DAY_STYLE: Readonly<Record<DayState, { readonly className: string; readonly icon: IconName | null }>> = {
  feito: { className: 'border-brand bg-brand text-white', icon: 'check' },
  minimo: { className: 'border-brand/60 bg-brand-dim text-brand-ink', icon: 'minimo' },
  perdido: { className: 'border-danger/50 bg-danger/10 text-danger', icon: 'fechar' },
  retomada: { className: 'border-positive/60 bg-positive/15 text-positive', icon: 'desfazer' },
  zerado: { className: 'border-line bg-transparent text-ink-faint', icon: null },
}

function DayDot({ state }: { readonly state: DayState }) {
  const style = DAY_STYLE[state]
  return (
    <span className={cn('grid size-8 place-items-center rounded-full border', style.className)}>
      {style.icon ? <Icon name={style.icon} className="size-3.5" /> : <span className="size-1 rounded-full bg-current" />}
    </span>
  )
}

/** O mesmo desenho do dia, em miniatura, dentro da frase que explica. */
function Glyph({ state }: { readonly state: DayState }) {
  const style = DAY_STYLE[state]
  return (
    <span
      aria-hidden="true"
      className={cn('grid size-4 shrink-0 place-items-center rounded-full border', style.className)}
    >
      {style.icon ? <Icon name={style.icon} className="size-2.5" /> : null}
    </span>
  )
}
