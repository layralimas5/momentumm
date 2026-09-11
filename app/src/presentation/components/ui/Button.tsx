import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant
  readonly size?: Size
  readonly loading?: boolean
  readonly children: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hi active:bg-brand',
  secondary: 'bg-surface-hi text-ink border border-line hover:border-line-hi hover:bg-surface',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface',
  danger: 'bg-transparent text-danger border border-line hover:bg-danger/10',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-13 px-6 text-base rounded-xl gap-2',
}

/**
 * As mesmas classes do botão, pra um `<Link>` que precisa parecer um.
 * Navegação é link, não botão com `navigate` dentro: abre em nova aba, tem
 * URL no hover e o leitor de tela anuncia como link.
 */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cn(
    'inline-flex select-none items-center justify-center font-medium transition-colors duration-150',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({
        variant,
        size,
        className: cn('disabled:cursor-not-allowed disabled:opacity-50', className),
      })}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  )
}
