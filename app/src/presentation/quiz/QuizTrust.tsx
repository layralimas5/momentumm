import { animate, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { obstacleAnswers, type QuizAnswers, type QuizAreaContext } from '@/domain/entities/quiz'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'

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
        <p className="text-xs font-medium tracking-wide text-brand-ink uppercase">Antes de continuar</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-balance text-ink">
          Um dia perdido não desfaz o seu progresso.
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

/** O número sobe de zero até o valor uma vez; com menos movimento, já nasce pronto. */
function CountUp({ to, reduced }: { readonly to: number; readonly reduced: boolean }) {
  const [value, setValue] = useState(reduced ? to : 0)

  useEffect(() => {
    if (reduced) {
      setValue(to)
      return
    }
    const controls = animate(0, to, {
      duration: 1.2,
      delay: 0.3,
      ease: EASE,
      onUpdate: (latest) => setValue(Math.round(latest)),
    })
    return () => controls.stop()
  }, [to, reduced])

  return <>{value}</>
}
