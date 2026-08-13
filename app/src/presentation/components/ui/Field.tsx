import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react'
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
