import type { ReactNode } from 'react'

/** Cabeçalho padrão das telas internas, pra hierarquia não variar de página em página. */
export function PageHeader({
  title,
  description,
  action,
}: {
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-tight text-ink lg:text-[1.75rem]">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-pretty text-sm text-ink-muted">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
