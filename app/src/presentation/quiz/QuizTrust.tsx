import { motion, useReducedMotion } from 'framer-motion'
import { obstacleAnswers, type QuizAnswers, type QuizAreaContext } from '@/domain/entities/quiz'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * A tela de confiança, no meio das perguntas e antes das mais pesadas.
 *
 * Ela precisa passar segurança sem número inventado, então mostra em vez de
 * dizer:
 *
 * 1. a mesma semana com dois finais: o plano comum zera na primeira falha,
 *    o Momentumm segue com versão mínima e retomada. É uma simulação e diz
 *    que é, não um dado de usuário
 * 2. a resposta do plano pra cada dificuldade que a pessoa acabou de marcar
 * 3. a tela real do app, capturada em modo demo
 * 4. os selos do que é verdade hoje: privado, sem cartão, sem fidelidade
 *
 * A prova com número real (usuários, avaliação) entra em `QUIZ_PROOF`
 * quando existir, e aparece sozinha no topo.
 */
const QUIZ_PROOF: readonly { readonly value: string; readonly label: string }[] = []

const EASE = [0.22, 1, 0.36, 1] as const

interface QuizTrustProps {
  readonly answers: QuizAnswers
  readonly area: QuizAreaContext
}

export function QuizTrust({ answers, area }: QuizTrustProps) {
  const reduced = useReducedMotion() === true
  const marked = obstacleAnswers(answers)
  const enter = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease: EASE },
        }

  return (
    <div className="flex flex-col">
      <motion.header {...enter(0)}>
        <p className="text-xs font-medium tracking-wide text-brand-ink uppercase">Antes de continuar</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-balance text-ink">
          Aqui, um dia ruim não derruba a semana.
        </h1>
        <p className="mt-2 text-sm text-pretty text-ink-muted">
          É isso que separa um plano que você larga de um plano que você termina.
        </p>
      </motion.header>

      {QUIZ_PROOF.length > 0 ? (
        <motion.dl {...enter(0.05)} className="mt-5 grid grid-cols-2 gap-2.5">
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

      {marked.length > 0 ? (
        <motion.section {...enter(0.2)} aria-labelledby="quiz-trava" className="mt-6">
          <h2 id="quiz-trava" className="text-xs font-medium tracking-wide text-ink-faint uppercase">
            O que você marcou, e o que o plano faz
          </h2>
          <ul className="mt-2.5 flex flex-col gap-2">
            {marked.map((item) => (
              <li key={item.key} className="flex items-start gap-3 rounded-2xl border border-line bg-surface/60 p-3.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-positive/15 text-positive">
                  <Icon name="check" className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="mt-0.5 text-sm text-pretty text-ink-muted">{item.answer}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.section>
      ) : null}

      <motion.figure {...enter(0.3)} className="mt-6 flex items-center gap-4 rounded-2xl border border-line bg-surface/60 p-3.5">
        <div className="relative h-44 w-24 shrink-0 overflow-hidden rounded-[1.1rem] border border-line-hi bg-canvas p-1 shadow-xl shadow-brand/20">
          <img
            src="/telas/hoje.webp"
            alt="Tela Hoje do Momentumm, com o passo do dia, a versão para dia cheio e um aviso de retomada sem culpa."
            width={780}
            height={1688}
            loading="lazy"
            decoding="async"
            className="h-full w-full rounded-[0.85rem] object-cover object-top"
          />
        </div>
        <figcaption className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-brand-ink uppercase">Tela real do app</p>
          <p className="mt-1 text-sm text-pretty text-ink">
            Todo dia você abre e o passo de hoje já está lá, com a versão mínima ao lado.
          </p>
          <p className="mt-1 text-xs text-pretty text-ink-faint">
            Sumiu uns dias? A própria tela te recebe de volta, sem cobrar nada.
          </p>
        </figcaption>
      </motion.figure>

      <motion.ul {...enter(0.4)} className="mt-5 grid grid-cols-3 gap-2" aria-label="Garantias">
        {SEALS.map((seal) => (
          <li
            key={seal.label}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface/40 px-2 py-3 text-center"
          >
            <Icon name={seal.icon} className="size-4 text-brand-ink" />
            <span className="text-[11px] leading-tight font-medium text-ink-muted">{seal.label}</span>
          </li>
        ))}
      </motion.ul>
    </div>
  )
}

const SEALS: readonly { readonly icon: IconName; readonly label: string }[] = [
  { icon: 'cadeado', label: 'Privado por padrão' },
  { icon: 'check', label: 'Grátis e sem cartão' },
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
      <figcaption className="relative flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">A mesma semana, dois finais</span>
        <span className="text-[11px] text-ink-faint">simulação</span>
      </figcaption>

      <div className="relative mt-4 flex flex-col gap-4">
        <WeekRow
          title="Plano comum"
          week={COMMON_WEEK}
          progress={0}
          outcome="Sequência zerada. Recomeça na segunda."
          tone="common"
          reduced={reduced}
          delay={0.2}
        />
        <WeekRow
          title="Seu plano no Momentumm"
          week={MOMENTUMM_WEEK}
          progress={6 / 7}
          outcome="A semana fechou. Nada zerou."
          tone="momentumm"
          reduced={reduced}
          delay={0.9}
        />
      </div>

      <ul className="relative mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line pt-3 text-[11px] text-ink-muted">
        <Legend state="feito" label="Passo feito" />
        <Legend state="perdido" label="Dia perdido" />
        <Legend state="minimo" label={`Dia apertado: ${minimalExample}`} />
        <Legend state="retomada" label="Retomada de onde parou" />
      </ul>
    </figure>
  )
}

interface WeekRowProps {
  readonly title: string
  readonly week: readonly DayState[]
  /** De 0 a 1: quanto da semana ficou de pé no fim. */
  readonly progress: number
  readonly outcome: string
  readonly tone: 'common' | 'momentumm'
  readonly reduced: boolean
  readonly delay: number
}

function WeekRow({ title, week, progress, outcome, tone, reduced, delay }: WeekRowProps) {
  const isMomentumm = tone === 'momentumm'

  return (
    <div>
      <p className={cn('text-xs font-medium', isMomentumm ? 'text-brand-ink' : 'text-ink-faint')}>{title}</p>

      <ol className="mt-2 grid grid-cols-7 gap-1.5" aria-label={`${title}: ${outcome}`}>
        {week.map((state, index) => (
          <motion.li
            key={index}
            initial={reduced ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: reduced ? 0 : delay + index * 0.08, ease: EASE }}
            className="flex flex-col items-center gap-1"
          >
            <DayDot state={state} />
            <span aria-hidden="true" className="text-[10px] text-ink-faint">
              {DAYS[index]}
            </span>
          </motion.li>
        ))}
      </ol>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-top">
        <motion.div
          initial={reduced ? false : { width: '0%' }}
          animate={{ width: `${Math.round(progress * 100)}%` }}
          transition={{ duration: 0.8, delay: reduced ? 0 : delay + 0.6, ease: EASE }}
          className={cn('h-full rounded-full', isMomentumm ? 'bg-gradient-to-r from-brand to-positive' : 'bg-danger')}
        />
      </div>
      <p className={cn('mt-1.5 text-xs font-medium', isMomentumm ? 'text-positive' : 'text-danger')}>{outcome}</p>
    </div>
  )
}

const DAY_STYLE: Readonly<Record<DayState, { readonly className: string; readonly icon: IconName | null; readonly label: string }>> = {
  feito: { className: 'border-brand bg-brand text-white', icon: 'check', label: 'feito' },
  minimo: { className: 'border-brand/60 bg-brand-dim text-brand-ink', icon: 'minimo', label: 'versão mínima' },
  perdido: { className: 'border-danger/50 bg-danger/10 text-danger', icon: 'fechar', label: 'perdido' },
  retomada: { className: 'border-positive/60 bg-positive/15 text-positive', icon: 'desfazer', label: 'retomada' },
  zerado: { className: 'border-line bg-transparent text-ink-faint', icon: null, label: 'sem plano' },
}

function DayDot({ state }: { readonly state: DayState }) {
  const style = DAY_STYLE[state]
  return (
    <span
      title={style.label}
      className={cn('grid size-8 place-items-center rounded-full border', style.className)}
    >
      {style.icon ? <Icon name={style.icon} className="size-3.5" /> : <span className="size-1 rounded-full bg-current" />}
      <span className="sr-only">{style.label}</span>
    </span>
  )
}

function Legend({ state, label }: { readonly state: DayState; readonly label: string }) {
  const style = DAY_STYLE[state]
  return (
    <li className="flex items-center gap-1.5">
      <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border', style.className)}>
        {style.icon ? <Icon name={style.icon} className="size-2.5" /> : null}
      </span>
      <span className="min-w-0 text-pretty">{label}</span>
    </li>
  )
}
