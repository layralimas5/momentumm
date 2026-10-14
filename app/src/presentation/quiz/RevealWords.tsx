import { motion, useReducedMotion } from 'framer-motion'
import { EASE_ENTER } from './quiz-motion'

/**
 * Um título que acende palavra por palavra.
 *
 * A palavra nasce apagada (a cor fraca do texto) e chega à cor cheia na
 * ordem da leitura, então o olho é levado pela frase em vez de pular pro
 * fim. O texto inteiro existe desde o primeiro quadro: leitor de tela lê a
 * frase uma vez só (`aria-label`), e nada muda de lugar enquanto acende.
 */
export function RevealWords({
  text,
  delay = 0,
  perWord = 0.07,
  className,
  as = 'h1',
  id,
}: {
  readonly text: string
  readonly delay?: number
  /** Intervalo entre uma palavra e a próxima, em segundos. */
  readonly perWord?: number
  readonly className?: string
  readonly as?: 'h1' | 'h2' | 'p'
  readonly id?: string
}) {
  const reduced = useReducedMotion()
  const Tag = as
  if (reduced) {
    return (
      <Tag id={id} className={className}>
        {text}
      </Tag>
    )
  }

  const words = text.split(/\s+/).filter(Boolean)
  return (
    <Tag id={id} className={className} aria-label={text}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          aria-hidden="true"
          initial={{ opacity: 0.22 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.32, delay: delay + index * perWord, ease: EASE_ENTER }}
        >
          {word}
          {index < words.length - 1 ? ' ' : null}
        </motion.span>
      ))}
    </Tag>
  )
}
