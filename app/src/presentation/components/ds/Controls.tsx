import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Icon } from '@/presentation/components/ui/Icon'
import { tapFeedback } from '@/shared/lib/haptics'
import { cn } from '@/shared/lib/cn'

/** Pílulas de filtro. Uma escolha por vez; a ativa é escura e cheia. */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  variant = 'pill',
}: {
  readonly options: readonly { readonly value: T; readonly label: string }[]
  readonly value: T
  readonly onChange: (value: T) => void
  readonly label: string
  readonly className?: string
  /** `segment` é o seletor dentro de card (7D, 30D...), afundado. */
  readonly variant?: 'pill' | 'segment'
}) {
  if (variant === 'segment') {
    return (
      <div role="tablist" aria-label={label} className={cn('well grid grid-flow-col gap-1 rounded-2xl p-1', className)}>
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={cn(
                'min-h-9 rounded-xl px-3 text-sm font-medium transition-all',
                active ? 'chip text-ink' : 'text-ink-faint hover:text-ink',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-2 overflow-x-auto no-scrollbar', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'press min-h-11 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap sm:px-5 sm:text-[0.95rem]',
              active ? 'bg-ink text-canvas shadow-[var(--shadow-float)]' : 'chip text-ink-muted',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * A caixa de concluir. O desenho tem 26px; o alvo de toque, 44px.
 * O XP sobe da própria caixa quando ela é marcada: o retorno nasce onde o dedo está.
 */
export function CheckButton({
  done,
  onToggle,
  label,
  xp,
  disabled = false,
}: {
  readonly done: boolean
  readonly onToggle: () => void
  readonly label: string
  readonly xp?: number
  readonly disabled?: boolean
}) {
  const reduce = useReducedMotion()
  const [burst, setBurst] = useState(0)

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!done) {
          tapFeedback()
          setBurst((value) => value + 1)
        }
        onToggle()
      }}
      className="tap-target relative grid size-7 shrink-0 place-items-center disabled:opacity-60"
    >
      <span
        className={cn(
          'grid size-7 place-items-center rounded-[9px] transition-colors duration-200',
          done ? 'bg-brand-dim text-brand-hi' : 'well text-transparent',
        )}
      >
        <AnimatePresence initial={false}>
          {done ? (
            <motion.span
              key="check"
              initial={reduce ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            >
              <Icon name="check" className="size-4" strokeWidth={2.75} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
      <AnimatePresence>
        {burst > 0 && xp && !reduce ? (
          <motion.span
            key={burst}
            aria-hidden="true"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], y: -26 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            onAnimationComplete={() => setBurst(0)}
            className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap text-brand-hi"
          >
            +{xp} XP
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  )
}

/** Interruptor acessível (role=switch). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  readonly checked: boolean
  readonly onChange: (next: boolean) => void
  readonly label: string
  readonly disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'well relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50',
        checked && 'bg-brand-dim',
      )}
    >
      <span
        className={cn(
          'absolute top-1 left-1 grid size-6 place-items-center rounded-full bg-surface shadow-[var(--shadow-float)] transition-transform duration-200',
          checked && 'translate-x-6',
        )}
      >
        <span className={cn('size-2 rounded-full', checked ? 'bg-brand' : 'bg-surface-top')} />
      </span>
    </button>
  )
}

/** Botão principal: largo, roxo, com sombra de cor. */
export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  className,
  type = 'button',
}: {
  readonly children: ReactNode
  readonly onClick?: () => void
  readonly disabled?: boolean
  readonly className?: string
  readonly type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'press flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-brand to-brand-hi px-5 text-base font-semibold text-white shadow-[var(--shadow-cta)] disabled:opacity-60',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Botão secundário de card: afundado, texto roxo. */
export function SoftButton({
  children,
  onClick,
  className,
  disabled = false,
}: {
  readonly children: ReactNode
  readonly onClick?: () => void
  readonly className?: string
  readonly disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'press chip flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-brand-hi disabled:opacity-60',
        className,
      )}
    >
      {children}
    </button>
  )
}
