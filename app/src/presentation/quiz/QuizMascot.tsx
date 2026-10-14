import { motion, useReducedMotion } from 'framer-motion'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { QuizToneKey } from '@/domain/entities/quiz'
import { Mascot, type MascotGesture, type MascotGestureKind, type MascotMood } from '@/presentation/mascot/Mascot'
import { RevealWords } from './RevealWords'
import { cascade } from './quiz-motion'

/**
 * O Momo dentro do quiz: quem fala as perguntas e reage às respostas.
 *
 * A tela de pergunta não sabe de mascote nenhum; ela só usa `Title`, e é o
 * contexto que diz ao Momo o que fazer (reagir a uma resposta, negar quando
 * falta resposta, mudar de cara na pergunta do tom). Assim o desenho de cada
 * pergunta continua sendo uma função das respostas, e o personagem é uma
 * camada por cima.
 */

export interface QuizMascotCue {
  readonly gesture: MascotGesture | null
  /** Quando a tela pede uma cara específica (a pergunta do tom). */
  readonly mood: MascotMood | null
}

const QuizMascotContext = createContext<QuizMascotCue>({ gesture: null, mood: null })
export const QuizMascotProvider = QuizMascotContext.Provider

/** A cara do Momo pra cada tom. Sem tom ainda, ele só escuta. */
export function moodForTone(tone: QuizToneKey | null): MascotMood | null {
  switch (tone) {
    case 'gentil':
      return 'gentle'
    case 'direto':
      return 'focused'
    case 'sem_filtro':
      return 'cheeky'
    case null:
      return null
  }
}

/** O intervalo entre uma palavra e a seguinte no balão. */
const PER_WORD = 0.055
const SAY_DELAY = 0.15

/**
 * A pergunta dita pelo Momo, num balão. A boca mexe enquanto as palavras
 * acendem e para quando a frase termina; a dica fica fora do balão, porque é
 * o app explicando, não o personagem falando.
 */
export function MascotSays({ text, hint }: { readonly text: string; readonly hint: string }) {
  const reduced = useReducedMotion()
  const cue = useContext(QuizMascotContext)
  const words = text.split(/\s+/).length
  const talking = useFor(reduced ? 0 : (SAY_DELAY + words * PER_WORD + 0.25) * 1000, text)

  return (
    <header className="mb-5">
      <div className="flex items-start gap-2.5">
        <Mascot size={52} mood={cue.mood ?? (talking ? 'talking' : 'idle')} gesture={cue.gesture} className="-mt-1" />
        <motion.div
          {...cascade(0, reduced)}
          className="relative min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-surface-hi/70 px-3.5 py-2.5"
        >
          <span
            aria-hidden="true"
            className="absolute top-3 -left-[5px] size-2.5 rotate-45 border-b border-l border-line bg-surface-hi"
          />
          <RevealWords
            text={text}
            delay={SAY_DELAY}
            perWord={PER_WORD}
            className="relative text-lg leading-snug font-semibold tracking-tight text-balance text-ink sm:text-xl"
          />
        </motion.div>
      </div>
      <motion.p {...cascade(1, reduced)} className="mt-2.5 text-sm text-pretty text-ink-muted">
        {hint}
      </motion.p>
    </header>
  )
}

/**
 * O Momo ao lado do cabeçalho de uma tela de recompensa. O gesto roda uma
 * vez, no instante em que a animação da tela chega no ponto que ele comenta
 * (o pulo da conta acontece quando a última barra sobe, não antes).
 */
export function MascotAside({
  mood,
  gesture,
  at = 0.2,
  children,
}: {
  readonly mood: MascotMood
  readonly gesture: MascotGestureKind
  /** Segundos até o gesto. */
  readonly at?: number
  readonly children: ReactNode
}) {
  const ready = !useFor(at * 1000, gesture)
  return (
    <div className="flex items-start gap-3">
      <Mascot size={60} mood={mood} gesture={ready ? { kind: gesture, key: 'tela' } : null} className="-mt-1" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Verdadeiro durante `ms` depois de montar (ou de `reset` mudar). */
export function useFor(ms: number, reset: unknown): boolean {
  const [on, setOn] = useState(ms > 0)
  useEffect(() => {
    if (ms <= 0) {
      setOn(false)
      return
    }
    setOn(true)
    const timer = window.setTimeout(() => setOn(false), ms)
    return () => window.clearTimeout(timer)
  }, [ms, reset])
  return on
}
