import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import { dayKeyOf, dayKeyToDate, type DayKey } from '@/domain/entities/day'
import type { QuizAnswers, QuizAreaContext } from '@/domain/entities/quiz'
import { formatCompactTime, formatTotalTime, quizTimeBank } from '@/domain/entities/quiz-time-bank'
import { cn } from '@/shared/lib/cn'
import { CountUp } from './CountUp'
import { MascotAside } from './QuizMascot'
import { RevealWords } from './RevealWords'
import { cascade } from './quiz-motion'

/**
 * A conta do tempo, depois das três perguntas de compromisso.
 *
 * No quiz da Cláudia este é o gráfico que leva a uma data ("em 12 de
 * janeiro você já conversa solto"). Aqui ele leva a um total: o tempo que a
 * pessoa disse ter, somado semana a semana até o prazo dela. Cada barra é
 * uma semana do calendário, e as que têm menos sessão (a primeira e a
 * última, quase sempre) aparecem menores, porque são.
 */

/** A barra sobe devagar no fim, como as da Cláudia. */
const BAR_EASE = [0.24, 0.74, 0.26, 1] as const
const BARS_START = 0.55

export function QuizTimeBank({ answers, area }: { readonly answers: QuizAnswers; readonly area: QuizAreaContext }) {
  const reduced = useReducedMotion() === true
  const today = useMemo(() => dayKeyOf(new Date()), [])
  const bank = useMemo(() => quizTimeBank(answers, today), [answers, today])
  if (!bank) return null

  const subject = area.label.toLowerCase()
  const deadline = longDate(bank.deadline)
  const tallest = Math.max(...bank.weeks, 1)
  const barsEnd = BARS_START + bank.weeks.length * 0.04 + 0.88

  return (
    <div className="flex flex-col">
      {/* O Momo pula quando a última barra termina de subir. */}
      <MascotAside mood="happy" gesture="jump" at={barsEnd}>
        <motion.p {...cascade(0, reduced)} className="text-xs font-medium tracking-wide text-brand-ink uppercase">
          A conta do seu tempo
        </motion.p>
        <RevealWords
          text={`Isso soma ${formatTotalTime(bank.totalMinutes)} de ${subject} até ${deadline}.`}
          delay={0.1}
          className="mt-1.5 text-2xl font-semibold tracking-tight text-balance text-ink"
        />
      </MascotAside>

      <motion.figure
        {...cascade(2, reduced)}
        className="relative mt-5 overflow-hidden rounded-3xl border border-brand/40 bg-surface p-5 shadow-2xl shadow-brand/15"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-brand/25 blur-3xl"
        />
        <div className="relative flex items-end gap-3">
          <span className="text-5xl leading-none font-semibold tracking-tight whitespace-nowrap text-ink tabular-nums">
            <CountUp
              to={bank.totalMinutes}
              reduced={reduced}
              delay={BARS_START}
              duration={barsEnd - BARS_START}
              format={formatCompactTime}
            />
          </span>
          <span className="pb-1 text-sm text-pretty text-ink-muted">
            em {bank.sessions} {bank.sessions === 1 ? 'sessão' : 'sessões'} de {bank.minutesPerSession} min
          </span>
        </div>

        <div
          role="img"
          aria-label={`Uma barra por semana, de hoje até ${deadline}.`}
          className="relative mt-5 flex h-24 items-end gap-[3px]"
        >
          {bank.weeks.map((minutes, index) => (
            <motion.span
              key={index}
              className={cn(
                'flex-1 origin-bottom rounded-t-[3px]',
                minutes > 0 ? 'bg-gradient-to-t from-brand to-brand-hi' : 'bg-line',
              )}
              style={{ height: `${minutes > 0 ? Math.max(10, (minutes / tallest) * 100) : 4}%` }}
              initial={reduced ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.88, delay: BARS_START + index * 0.04, ease: BAR_EASE }}
            />
          ))}
        </div>
        <div className="relative mt-2 flex justify-between text-[11px] text-ink-faint">
          <span>hoje</span>
          <span className="font-medium text-ink-muted">{deadline}</span>
        </div>
      </motion.figure>

      <motion.p {...cascade(0, reduced, barsEnd)} className="mt-5 text-sm text-pretty text-ink-muted">
        {bank.minutesPerSession} min × {bank.daysPerWeek} {bank.daysPerWeek === 1 ? 'dia' : 'dias'} por semana ={' '}
        {formatTotalTime(bank.weeklyMinutes)} por semana. É só o tempo que você disse ter, somado no calendário.
      </motion.p>
      {bank.assumedDeadline ? (
        <motion.p {...cascade(1, reduced, barsEnd)} className="mt-2 text-sm text-pretty text-ink-faint">
          Você ainda não escolheu prazo, então a conta vai até {deadline}, o prazo que o plano assume. Dá pra
          mudar depois.
        </motion.p>
      ) : null}
    </div>
  )
}

function longDate(day: DayKey): string {
  return dayKeyToDate(day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}
