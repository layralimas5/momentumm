import { useId, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useFocusTrap } from '@/presentation/hooks/use-focus-trap'
import { cn } from '@/shared/lib/cn'
import { Icon } from './Icon'

interface DialogProps {
  readonly open: boolean
  readonly title: string
  readonly description?: string
  readonly onClose: () => void
  readonly children: ReactNode
  readonly size?: 'md' | 'lg' | 'xl'
  /** Sessão de foco: tela cheia, sem nada além do essencial. */
  readonly fullscreen?: boolean
  /**
   * As ações do diálogo, presas embaixo enquanto o conteúdo rola. Mesma regra
   * do bottom sheet: uma lista longa não pode esconder a decisão.
   */
  readonly footer?: ReactNode
}

/**
 * Diálogo modal com armadilha de foco. Escrito à mão em vez de trazer uma
 * biblioteca inteira: são poucas regras (Esc fecha, Tab circula dentro, foco
 * volta pra quem abriu) e todas cabem aqui.
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  fullscreen = false,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useFocusTrap(open, panelRef, onClose)

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className={cn(
            'fixed inset-0 z-50 flex bg-canvas/80 backdrop-blur-sm',
            fullscreen ? 'items-stretch' : 'items-end justify-center p-4 sm:items-center',
          )}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !fullscreen) onClose()
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            initial={{ opacity: 0, y: fullscreen ? 0 : 12, scale: fullscreen ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: fullscreen ? 0 : 8, scale: fullscreen ? 1 : 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              fullscreen
                ? 'flex w-full flex-col bg-canvas'
                : cn(
                    'surface-card max-h-[85dvh] w-full p-6',
                    footer ? 'flex flex-col overflow-hidden' : 'overflow-y-auto',
                    // `xl` existe pro Share Studio: preview grande e controles
                    // lado a lado não cabem em 2xl sem espremer os dois.
                    size === 'xl' ? 'max-w-5xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
                  ),
            )}
          >
            {fullscreen ? (
              <>
                <h2 id={titleId} className="sr-only">
                  {title}
                </h2>
                {children}
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 id={titleId} className="text-lg font-semibold text-ink">
                      {title}
                    </h2>
                    {description ? (
                      <p id={descriptionId} className="mt-1 text-sm text-ink-muted">
                        {description}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="-mr-2 -mt-2 grid size-10 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-hi hover:text-ink"
                  >
                    <Icon name="fechar" />
                    <span className="sr-only">Fechar</span>
                  </button>
                </div>
                <div className={cn('mt-5', footer ? 'min-h-0 flex-1 overflow-y-auto' : null)}>
                  {children}
                </div>

                {footer ? (
                  <div className="mt-5 shrink-0 border-t border-line pt-4">{footer}</div>
                ) : null}
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
