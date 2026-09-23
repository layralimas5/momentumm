import type { ReactNode } from 'react'

export function LoadingBlock({ label = 'Carregando' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className="h-14 animate-pulse rounded-card border border-line bg-surface"
        />
      ))}
    </div>
  )
}

interface EmptyStateProps {
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-card border border-dashed border-line px-5 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

interface ErrorNoteProps {
  readonly message: string
  /**
   * O que fazer a respeito. Sem isso o aviso só informa, e um erro que a
   * pessoa não pode responder é um beco: ela recarrega a página na mão, ou
   * fecha o app.
   */
  readonly onRetry?: () => void
  readonly retryLabel?: string
}

export function ErrorNote({ message, onRetry, retryLabel = 'Tentar de novo' }: ErrorNoteProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-ink"
    >
      <p className="min-w-0 flex-1">{message}</p>

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-line-hi px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-surface-hi"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}
