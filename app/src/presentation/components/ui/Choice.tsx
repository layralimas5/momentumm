import { cn } from '@/shared/lib/cn'

/**
 * Escolha em linha. Existe pra o check-in e o seletor de foco não virarem
 * formulário de clínica: a pessoa escolhe tocando, não abrindo um select.
 *
 * É um grupo de rádio de verdade (`role="radiogroup"` + setas do teclado), não
 * uma fileira de botões que só parece um.
 */

export interface ChoiceOption<T extends string | number> {
  readonly value: T
  readonly label: string
  readonly hint?: string
}

interface ChoiceGroupProps<T extends string | number> {
  readonly label: string
  readonly options: readonly ChoiceOption<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
  readonly size?: 'sm' | 'md'
  /** Itens dividem a largura disponível em vez de quebrar linha. */
  readonly fill?: boolean
  readonly className?: string
}

export function ChoiceGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  fill = false,
  className,
}: ChoiceGroupProps<T>) {
  const move = (direction: 1 | -1) => {
    const index = options.findIndex((option) => option.value === value)
    const next = options[(index + direction + options.length) % options.length]
    if (next) onChange(next.value)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex gap-2', fill ? 'flex-nowrap' : 'flex-wrap', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                move(1)
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                move(-1)
              }
            }}
            className={cn(
              'rounded-xl border font-medium transition-all duration-150',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
              // `min-w-0` junto do `flex-1`: sem ele o botão nunca encolhe
              // abaixo do próprio texto, e a linha inteira empurra o container
              // pra fora da tela num espaço estreito.
              fill && 'min-w-0 flex-1 truncate px-1 text-center',
              selected
                ? 'border-brand bg-brand-dim/60 text-ink shadow-[0_0_0_1px_var(--color-brand)]'
                : 'border-line bg-surface-hi/60 text-ink-muted hover:border-line-hi hover:text-ink active:bg-surface-top',
            )}
          >
            {option.label}
            {option.hint ? (
              <span className={cn('block text-xs', selected ? 'text-brand-ink' : 'text-ink-faint')}>
                {option.hint}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
