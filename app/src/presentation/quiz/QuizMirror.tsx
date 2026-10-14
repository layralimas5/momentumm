import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { QuizAreaContext } from '@/domain/entities/quiz'
import { Icon } from '@/presentation/components/ui/Icon'
import { RevealWords } from './RevealWords'
import { cascade, EASE_DRAW, EASE_SPRING } from './quiz-motion'

/**
 * O espelho do objetivo, logo depois de a pessoa escrevê-lo.
 *
 * É a tela de personalização da Cláudia ("Rio de Janeiro: um professor só
 * pra você"), feita com o que o Momentumm sabe de verdade nesse ponto: as
 * palavras dela. O objetivo aparece sendo escrito num card, e embaixo surgem
 * os três degraus vazios que o plano vai preencher. Nada aqui promete prazo
 * ou resultado: os degraus estão vazios porque ainda não existe plano.
 */

const TYPE_MS = 32
const SLOTS = ['Começo', 'Meio', 'Chegada'] as const

export function QuizMirror({ goal, area }: { readonly goal: string; readonly area: QuizAreaContext }) {
  const reduced = useReducedMotion()
  const typed = useTypewriter(goal, reduced === true)
  const typingEnds = 0.5 + (goal.length * TYPE_MS) / 1000

  return (
    <div className="flex flex-col">
      <motion.p {...cascade(0, reduced)} className="text-xs font-medium tracking-wide text-brand-ink uppercase">
        Anotado
      </motion.p>
      <RevealWords
        text="Esse é o seu objetivo. Agora ele vira plano."
        delay={0.1}
        className="mt-1.5 text-2xl font-semibold tracking-tight text-balance text-ink"
      />

      <motion.figure
        {...cascade(2, reduced)}
        className="relative mt-5 overflow-hidden rounded-3xl border border-brand/40 bg-surface p-5 shadow-2xl shadow-brand/15"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-brand/25 blur-3xl"
        />
        <p className="relative flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-ink-faint uppercase">
          <Icon name="bandeira" className="size-3.5" />
          {area.label}
        </p>
        <p className="relative mt-2 min-h-[2lh] text-2xl leading-snug font-semibold tracking-tight text-balance text-ink">
          <span className="sr-only">{goal}</span>
          <span aria-hidden="true">
            {typed}
            {reduced || typed.length >= goal.length ? null : (
              <motion.span
                className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-[0.15em] bg-brand-hi"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
              />
            )}
          </span>
        </p>

        <ol aria-label="Etapas do plano, ainda vazias" className="relative mt-6 grid grid-cols-3 gap-2">
          {reduced ? null : (
            <motion.span
              aria-hidden="true"
              className="absolute top-5 right-[16%] left-[16%] h-px origin-left border-t border-dashed border-brand/50"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, delay: typingEnds, ease: EASE_DRAW }}
            />
          )}
          {SLOTS.map((slot, index) => (
            <motion.li
              key={slot}
              initial={reduced ? false : { opacity: 0, scale: 0.58 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: typingEnds + 0.15 + index * 0.18, ease: EASE_SPRING }}
              className="relative flex flex-col items-center text-center"
            >
              <span className="grid size-10 place-items-center rounded-full border border-dashed border-brand/60 bg-canvas text-xs font-semibold text-brand-ink">
                {index + 1}
              </span>
              <span className="mt-1.5 text-xs text-ink-muted">{slot}</span>
            </motion.li>
          ))}
        </ol>
      </motion.figure>

      <motion.p {...cascade(0, reduced, typingEnds + 0.7)} className="mt-5 text-sm text-pretty text-ink-muted">
        Nas próximas perguntas a gente descobre o que trava, quanto tempo cabe de verdade e qual é o primeiro
        passo de hoje.
      </motion.p>
    </div>
  )
}

/** O texto aparecendo letra por letra. Com movimento reduzido, inteiro de uma vez. */
function useTypewriter(text: string, reduced: boolean): string {
  const [count, setCount] = useState(reduced ? text.length : 0)

  useEffect(() => {
    if (reduced) {
      setCount(text.length)
      return
    }
    setCount(0)
    let timer = 0
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        setCount((current) => {
          if (current >= text.length) {
            window.clearInterval(timer)
            return current
          }
          return current + 1
        })
      }, TYPE_MS)
    }, 500)
    return () => {
      window.clearTimeout(start)
      window.clearInterval(timer)
    }
  }, [text, reduced])

  return text.slice(0, count)
}
