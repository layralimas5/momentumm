import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useFocusTrap } from '@/presentation/hooks/use-focus-trap'
import { cn } from '@/shared/lib/cn'

interface BottomSheetProps {
  readonly open: boolean
  readonly title: string
  readonly description?: string | undefined
  readonly onClose: () => void
  readonly children: ReactNode
  /** Esconde o título na tela e deixa só pro leitor de tela. */
  readonly hideTitle?: boolean
}

/**
 * Bottom sheet: a camada modal do celular.
 *
 * Sobe pela borda de baixo porque é onde o polegar alcança, e nunca passa de
 * 88% da altura — a faixa que sobra em cima mostra que existe tela atrás e
 * dá um alvo grande pra fechar sem procurar o X.
 *
 * Vai pro `body` por portal: `backdrop-filter` e `transform` no ancestral
 * (o header fixo do celular tem os dois) viram containing block do `fixed`,
 * e o sheet nasceria preso dentro da barra em vez de cobrir a tela.
 */
export function BottomSheet({
  open,
  title,
  description,
  onClose,
  children,
  hideTitle = false,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useFocusTrap(open, panelRef, onClose)

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex flex-col justify-end bg-canvas/75 backdrop-blur-sm"
        >
          <button
            type="button"
            aria-label={`Fechar ${title}`}
            onClick={onClose}
            className="flex-1"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              // Puxar pra baixo fecha. O botão de fechar continua existindo:
              // gesto aqui é atalho, nunca o único caminho.
              if (info.offset.y > 96 || info.velocity.y > 600) onClose()
            }}
            className="max-h-[88dvh] w-full overflow-hidden rounded-t-3xl border-t border-line-hi bg-surface"
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <span aria-hidden="true" className="h-1 w-10 rounded-full bg-line-hi" />
            </div>

            <div className="flex items-start justify-between gap-4 px-5 pt-2">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className={cn('text-lg font-semibold text-ink', hideTitle && 'sr-only')}
                >
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
                className={cn(
                  '-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-ink-faint',
                  'transition-colors hover:bg-surface-hi hover:text-ink active:bg-surface-top',
                  hideTitle && 'hidden',
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  className="size-5"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
                <span className="sr-only">Fechar</span>
              </button>
            </div>

            {/* pb-safe: sem isso o último botão fica embaixo do risco de gestos. */}
            <div className="max-h-[calc(88dvh-5rem)] overflow-y-auto px-5 pt-4 pb-safe">
              <div className="pb-4">{children}</div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

/** Linha de opção dentro de um sheet. Alvo de toque cheio, de ponta a ponta. */
export function SheetAction({
  icon,
  label,
  hint,
  onClick,
  tone = 'neutral',
  disabled = false,
}: {
  readonly icon: ReactNode
  readonly label: string
  readonly hint?: string
  readonly onClick: () => void
  readonly tone?: 'neutral' | 'brand' | 'danger'
  readonly disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-xl px-3 py-3.5 text-left transition-colors',
        'min-h-14 active:bg-surface-top disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger' ? 'text-danger hover:bg-danger/10' : 'text-ink hover:bg-surface-hi',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-xl border',
          tone === 'brand'
            ? 'border-brand/40 bg-brand-dim/50 text-brand-hi'
            : tone === 'danger'
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-line bg-surface-hi text-ink-muted',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-sm text-ink-faint">{hint}</span> : null}
      </span>
    </button>
  )
}
