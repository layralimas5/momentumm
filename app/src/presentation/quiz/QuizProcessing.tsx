import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Icon } from '@/presentation/components/ui/Icon'
import { PROCESSING_MS } from './use-quiz'

/**
 * A tela de processamento. O plano já foi calculado quando ela aparece; o
 * que ela faz é dar tempo pra leitura das quatro frases, e só. Nada aqui
 * alonga a espera de propósito além do `PROCESSING_MS`.
 */

const MESSAGES = [
  'Analisando seu objetivo…',
  'Considerando sua rotina…',
  'Dividindo sua meta em etapas…',
  'Preparando seu primeiro passo…',
] as const

export function QuizProcessing() {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = PROCESSING_MS / MESSAGES.length
    const timer = window.setInterval(() => {
      setIndex((current) => Math.min(MESSAGES.length - 1, current + 1))
    }, interval)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center py-10 text-center"
    >
      <span className="relative grid size-16 place-items-center">
        <span
          aria-hidden="true"
          className={
            reduced
              ? 'absolute inset-0 rounded-full border-2 border-brand/40'
              : 'absolute inset-0 animate-spin rounded-full border-2 border-line-hi border-t-brand'
          }
        />
        <Icon name="ia" className="size-6 text-brand-ink" />
      </span>

      <div className="mt-6 h-7">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={index}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="text-base text-ink"
          >
            {MESSAGES[index]}
          </motion.p>
        </AnimatePresence>
      </div>

      <ol className="mt-6 flex items-center gap-1.5" aria-hidden="true">
        {MESSAGES.map((message, position) => (
          <li
            key={message}
            className={
              position <= index
                ? 'h-1 w-6 rounded-full bg-brand transition-colors'
                : 'h-1 w-6 rounded-full bg-surface-top transition-colors'
            }
          />
        ))}
      </ol>
    </div>
  )
}
