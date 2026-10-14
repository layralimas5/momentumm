import { motion, useReducedMotion } from 'framer-motion'
import { obstacleAnswers, type QuizAnswers, type QuizAreaContext } from '@/domain/entities/quiz'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { CountUp } from './CountUp'
import { MascotAside } from './QuizMascot'
import { EASE_DRAW, EASE_SPRING_STRONG, timeAtProgress } from './quiz-motion'

/**
 * A tela de confiança, no meio das perguntas e antes das mais pesadas.
 *
 * Confiança vem de prova, e o Momentumm ainda não tem número de usuário nem
 * depoimento. A prova honesta que existe é a pesquisa em que o método se
 * apoia: Lally e colegas (University College London, European Journal of
 * Social Psychology, 2010) acompanharam por 12 semanas pessoas criando um
 * hábito novo. O hábito levou em média 66 dias pra ficar automático, e
 * falhar um dia não atrapalhou a formação dele. É exatamente o desenho do
 * app: versão mínima, retomada, nada zera.
 *
 * A tela tem três blocos: a evidência (com a fonte escrita), o que o plano
 * faz por causa dela, e a segurança dos dados. Os números da pesquisa são
 * da pesquisa, nunca do app. A prova com número real do app (usuários,
 * avaliação) entra em `QUIZ_PROOF` quando existir, e aparece sozinha.
 */
const QUIZ_PROOF: readonly { readonly value: string; readonly label: string }[] = []

const HABIT_DAYS = 66
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
          transition: { duration: 0.45, delay, ease: EASE },
        }

  const reasons: readonly { readonly icon: IconName; readonly text: string }[] = [
    { icon: 'minimo', text: `Dia apertado vira versão mínima (${area.minimalExample}), e o dia conta.` },
    { icon: 'desfazer', text: 'Depois de uma falta, você volta de onde parou. Nada zera.' },
    ...(main ? [{ icon: 'check' as const, text: `${main.label}? ${main.answer}` }] : []),
  ]

  return (
    <div className="flex flex-col">
      <motion.header {...enter(0)}>
        <MascotAside mood="gentle" gesture="tilt" at={0.4}>
          <p className="text-xs font-medium tracking-wide text-brand-ink uppercase">Antes de continuar</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-balance text-ink">
            Um dia perdido não desfaz o seu progresso.
          </h1>
        </MascotAside>
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

      <motion.figure
        {...enter(0.1)}
        className="relative mt-5 overflow-hidden rounded-3xl border border-brand/40 bg-surface p-5 shadow-2xl shadow-brand/15"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-brand/25 blur-3xl"
        />
        <p className="relative text-[11px] font-medium tracking-wide text-ink-faint uppercase">
          O que a pesquisa mostra
        </p>

        <div className="relative mt-3 flex items-end gap-3">
          <span className="text-5xl leading-none font-semibold tracking-tight text-ink tabular-nums">
            <CountUp to={HABIT_DAYS} reduced={reduced} />
          </span>
          <span className="pb-1 text-sm text-pretty text-ink-muted">
            dias, em média, pra um hábito novo ficar automático.
          </span>
        </div>

        <HabitCurve reduced={reduced} />

        <blockquote className="relative mt-4 border-l-2 border-positive pl-3 text-sm text-pretty text-ink">
          E falhar um dia no meio do caminho <strong className="font-semibold text-positive">não atrapalhou</strong>{' '}
          a formação do hábito.
        </blockquote>

        <figcaption className="relative mt-4 text-[11px] text-pretty text-ink-faint">
          Lally e colegas, University College London. European Journal of Social Psychology, 2010.
        </figcaption>
      </motion.figure>

      <motion.section {...enter(0.25)} aria-labelledby="quiz-por-isso" className="mt-5">
        <h2 id="quiz-por-isso" className="text-sm font-semibold text-ink">
          Por isso o seu plano foi feito pra não quebrar:
        </h2>
        <ul className="mt-2.5 flex flex-col gap-2">
          {reasons.map((reason) => (
            <li key={reason.text} className="flex items-start gap-2.5 text-sm text-pretty text-ink-muted">
              <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-brand-dim text-brand-ink">
                <Icon name={reason.icon} className="size-3" />
              </span>
              {reason.text}
            </li>
          ))}
        </ul>
      </motion.section>

      <motion.div
        {...enter(0.35)}
        className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-surface/60 p-3.5"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-positive/15 text-positive">
          <Icon name="cadeado" className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Seus dados são seus</p>
          <p className="mt-0.5 text-xs text-pretty text-ink-muted">
            Tudo nasce privado, e você exporta ou apaga quando quiser. Grátis pra começar, sem cartão e
            sem fidelidade.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * A curva do modelo da pesquisa: o hábito fica mais automático rápido no
 * começo e estabiliza perto do dia 66. O ponto marca um dia perdido, e a
 * linha segue sem queda, que é o achado do estudo. É o gráfico de
 * comparação da Cláudia, com a diferença de que a forma vem da pesquisa
 * citada embaixo, não de uma promessa do app.
 *
 * Modelo assintótico do artigo: automaticidade = 1 - e^(-k·dia), com k
 * escolhido pra chegar a 95% no dia 66.
 */
const CURVE_DAYS = 90
const K = Math.log(20) / HABIT_DAYS
const MISSED_DAY = 24
const W = 300
const H = 92
const PAD = 6
const DRAW = { delay: 0.5, duration: 1.4 }

function curvePoint(day: number): readonly [number, number] {
  const x = PAD + (day / CURVE_DAYS) * (W - PAD * 2)
  const y = H - PAD - (1 - Math.exp(-K * day)) * (H - PAD * 2 - 10)
  return [x, y]
}

const CURVE_PATH = Array.from({ length: CURVE_DAYS + 1 }, (_, day) => {
  const [x, y] = curvePoint(day)
  return `${day === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
}).join(' ')

function HabitCurve({ reduced }: { readonly reduced: boolean }) {
  const [missedX, missedY] = curvePoint(MISSED_DAY)
  const [plateauX] = curvePoint(HABIT_DAYS)
  // O ponto acende quando a ponta da linha chega nele. O desenho segue
  // `EASE_DRAW`, então o instante sai de `timeAtProgress`, pela posição
  // horizontal (a curva é quase reta onde o ponto está, a diferença some).
  const reach = (day: number) => DRAW.delay + DRAW.duration * timeAtProgress(EASE_DRAW, day / CURVE_DAYS)

  return (
    <figure className="relative mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label="Curva da pesquisa: o hábito fica automático perto do dia 66, e um dia perdido no meio não derruba a curva.">
        <line x1={plateauX} x2={plateauX} y1={PAD} y2={H - PAD} className="stroke-line" strokeDasharray="3 3" />
        <motion.path
          d={CURVE_PATH}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="stroke-brand-hi"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ ...DRAW, ease: EASE_DRAW }}
          style={{ filter: 'drop-shadow(0 0 6px var(--color-brand-hi))' }}
        />
        <motion.circle
          cx={missedX}
          cy={missedY}
          r={4.5}
          strokeWidth={2}
          className="fill-surface stroke-ink-muted"
          initial={reduced ? false : { opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: reach(MISSED_DAY), ease: EASE_SPRING_STRONG }}
          style={{ transformOrigin: `${missedX}px ${missedY}px` }}
        />
      </svg>
      <motion.span
        className="absolute text-[10px] text-ink-muted"
        style={{ left: `${(missedX / W) * 100}%`, top: `${((missedY + 9) / H) * 100}%`, transform: 'translateX(-50%)' }}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: reach(MISSED_DAY) + 0.15 }}
      >
        1 dia perdido
      </motion.span>
      <motion.span
        className="absolute top-0 text-[10px] text-ink-faint"
        style={{ left: `${(plateauX / W) * 100}%`, transform: 'translateX(-50%) translateY(-100%)' }}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: reach(HABIT_DAYS) }}
      >
        dia 66
      </motion.span>
    </figure>
  )
}

