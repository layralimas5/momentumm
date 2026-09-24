import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

const EASE = [0.22, 1, 0.36, 1] as const
const VIEWPORT = { once: true, margin: '-60px' } as const

interface RevealProps {
  readonly children: ReactNode
  readonly delay?: number
  readonly className?: string
}

/**
 * Entrada ao rolar: sobe, desembaça e aparece, uma vez só. Com
 * `prefers-reduced-motion` o conteúdo já nasce no lugar.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 28, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={VIEWPORT}
      transition={{ duration: 0.65, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface RevealWordsProps {
  readonly text: string
  readonly delay?: number
  readonly className?: string
}

/**
 * Texto que aparece palavra por palavra quando entra na tela.
 *
 * Cada palavra é um span inline que carrega o próprio espaço, então a frase
 * continua sendo UM texto só: quebra de linha natural, leitor de tela lendo
 * seguido, seleção e cópia trazendo a frase uma vez.
 *
 * Havia aqui uma cópia `sr-only` da frase inteira com as palavras em
 * `aria-hidden`. Ela resolvia um problema que spans inline não têm e criava
 * dois: quem copiava o título levava ele duplicado, e quem raspa a página
 * (busca, modelo de linguagem) lia "O que perguntam antes de começarO que
 * perguntam antes de começar".
 */
export function RevealWords({ text, delay = 0, className }: RevealWordsProps) {
  const reduced = useReducedMotion()
  const words = text.split(' ')

  return (
    <motion.span
      initial={reduced ? false : 'hidden'}
      whileInView="visible"
      viewport={VIEWPORT}
      transition={{ staggerChildren: 0.045, delayChildren: delay }}
      className={className}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          variants={{
            hidden: { opacity: 0, y: '0.4em', filter: 'blur(4px)' },
            visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
          }}
          transition={{ duration: 0.5, ease: EASE }}
          className="inline-block"
        >
          {word}
          {index < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </motion.span>
  )
}
