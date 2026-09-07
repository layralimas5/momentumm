import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * Uma seção do dashboard: título, conteúdo e um caminho pra tela completa.
 *
 * Existe porque nem toda informação merece virar card. Card é uma promessa de
 * importância — quando tudo é card, nada é. Aqui o agrupamento é feito por
 * título e espaçamento, e o card fica reservado ao que a pessoa precisa
 * ATUAR: o foco de hoje.
 *
 * `level` controla o peso visual, e é ele que cria a direção da tela: o
 * segundo nível ainda chama atenção, o terceiro é consulta e nunca deve
 * disputar com o dia.
 */
export function Section({
  title,
  hint,
  level = 2,
  to,
  toLabel,
  action,
  children,
  className,
}: {
  readonly title: string
  readonly hint?: string | undefined
  readonly level?: 2 | 3
  /** Link pra tela completa do assunto. */
  readonly to?: string | undefined
  readonly toLabel?: string | undefined
  readonly action?: ReactNode
  readonly children: ReactNode
  readonly className?: string | undefined
}) {
  return (
    <section className={cn('flex flex-col', level === 2 ? 'gap-3' : 'gap-2.5', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2
            className={cn(
              'font-semibold text-ink',
              level === 2
                ? 'text-base tracking-tight'
                : 'text-xs tracking-wide text-ink-muted uppercase',
            )}
          >
            {title}
          </h2>
          {hint ? <p className="mt-0.5 text-sm text-ink-faint">{hint}</p> : null}
        </div>

        {action ??
          (to ? (
            <Link
              to={to}
              className="inline-flex shrink-0 items-center gap-1 text-sm text-ink-faint transition-colors hover:text-ink-muted"
            >
              {toLabel ?? 'Ver todos'}
              <Icon name="seta" className="size-3.5" />
            </Link>
          ) : null)}
      </div>

      {children}
    </section>
  )
}
