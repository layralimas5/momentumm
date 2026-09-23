import {
  useId,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from 'react'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

const CONTROL =
  'h-11 w-full rounded-xl border border-line bg-surface-hi px-3 text-ink placeholder:text-ink-faint transition-colors focus:border-brand'

interface FieldProps {
  readonly label: string
  readonly hint?: string | undefined
  readonly error?: string | null | undefined
  readonly children: (id: string, describedBy: string | undefined) => ReactNode
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children(id, describedBy)}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(CONTROL, className)} />
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={cn(CONTROL, 'appearance-none pr-8', className)} />
}

/**
 * Campo de senha com o olho de mostrar e esconder.
 *
 * Digitar senha no escuro erra, e quem erra no cadastro acha que o app
 * quebrou. O botão nasce escondendo (`type="password"`), nunca entra no
 * `Tab` antes do campo e diz em voz alta o que faz: o leitor de tela anuncia
 * "Mostrar senha" e o estado fica em `aria-pressed`.
 */
export function PasswordInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={cn(CONTROL, 'pr-12', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        aria-pressed={visible}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-ink-faint transition-colors hover:text-ink"
      >
        <Icon name={visible ? 'oculto' : 'visivel'} className="size-5" />
      </button>
    </div>
  )
}
