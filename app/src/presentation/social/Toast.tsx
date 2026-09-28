import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

const VISIBLE_MS = 2600

/**
 * O aviso curto de que deu certo.
 *
 * Sucesso não merece diálogo: um modal com "OK" pra confirmar que a publicação
 * saiu obriga um toque a mais pra voltar ao que a pessoa estava fazendo, e o
 * que ela quer ver é o feed com a publicação lá.
 *
 * Fica ACIMA da barra inferior (`bottom-above-tabbar`) porque no celular o
 * rodapé é ocupado, e um aviso atrás da barra é um aviso que ninguém lê.
 *
 * `role="status"` com `aria-live="polite"`: o leitor de tela anuncia quando
 * terminar o que está falando, em vez de interromper. Aviso de sucesso nunca
 * é urgente o bastante pra cortar a frase de alguém.
 */
export interface ToastMessage {
  readonly text: string
  /** `erro` troca o visto verde por um aviso, e nada mais: o lugar é o mesmo. */
  readonly tone: 'ok' | 'erro'
}

export function Toast({
  message,
  onDone,
}: {
  readonly message: ToastMessage | null
  readonly onDone: () => void
}) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onDone, VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [message, onDone])

  return createPortal(
    <AnimatePresence>
      {message ? (
        <motion.div
          role="status"
          aria-live="polite"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 bottom-above-tabbar lg:bottom-8"
        >
          <p
            className={cn(
              'flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm text-ink shadow-lg backdrop-blur-md',
              message.tone === 'erro'
                ? 'border-danger/40 bg-danger/15'
                : 'border-line-hi bg-surface-top/95',
            )}
          >
            <Icon
              name={message.tone === 'erro' ? 'sino' : 'check'}
              className={cn('size-4', message.tone === 'erro' ? 'text-danger' : 'text-positive')}
              strokeWidth={2.5}
            />
            {message.text}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
