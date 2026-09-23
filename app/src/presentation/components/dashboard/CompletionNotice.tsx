import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import type { CompletionNotice as Notice } from '@/presentation/planner/use-completion-notice'

/**
 * A resposta visível a uma conclusão.
 *
 * Segue o desenho do aviso de conquista de propósito: mesma posição, mesmo
 * tamanho, mesma saída automática. Duas linguagens diferentes pra "algo bom
 * aconteceu" fariam a pessoa reaprender a tela.
 *
 * Ocupa o lugar natural, logo acima da barra inferior, porque é o aviso
 * frequente. O de evolução, que é raro, empilha acima dele: assim os dois
 * nunca se cobrem, e quem chegou ao nível novo continua vendo o cartão do
 * nível novo mesmo que os dois caiam no mesmo segundo.
 */
export function CompletionNotice({
  notice,
  onDismiss,
}: {
  readonly notice: Notice | null
  readonly onDismiss: () => void
}) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {notice ? (
        <motion.div
          key={notice.id}
          role="status"
          aria-live="polite"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md lg:bottom-6 lg:right-6 lg:left-auto lg:mx-0"
        >
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              'flex w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-xl transition-colors',
              notice.closing
                ? 'border-positive/35 bg-positive/12 hover:bg-positive/16'
                : 'border-line-hi bg-surface-hi hover:bg-surface',
            )}
          >
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-full',
                notice.closing ? 'bg-positive/20 text-positive' : 'bg-brand/15 text-brand-ink',
              )}
            >
              <Icon name={notice.closing ? 'trofeu' : 'check'} className="size-4.5" strokeWidth={2.5} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{notice.title}</span>
              {notice.detail ? (
                <span className="mt-0.5 block text-sm text-ink-muted">{notice.detail}</span>
              ) : null}
            </span>

            <span className="sr-only">Dispensar aviso</span>
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
