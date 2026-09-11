import type { MomentumNextAction as NextAction } from '@/domain/entities/momentum-next-action'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * A próxima ação com maior potencial de subir o ritmo.
 *
 * O item vem do domínio, que recalculou o score com cada coisa em aberto
 * marcada como feita. Aqui só se mostra: o título, o ganho e o motivo. Um
 * card que inventasse a própria ordem ("prioridade primeiro") divergiria do
 * número no primeiro dia em que a retomada valesse mais que a prioridade.
 */
export function MomentumNextAction({
  action,
  className,
}: {
  readonly action: NextAction | null
  readonly className?: string
}) {
  if (!action) return null

  return (
    <section
      aria-labelledby="momentum-proxima"
      className={cn('rounded-card border border-brand/25 bg-brand-dim/25 px-4 py-3', className)}
    >
      <h3
        id="momentum-proxima"
        className="text-xs font-semibold tracking-wide text-ink-muted uppercase"
      >
        Próxima ação com mais potencial
      </h3>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium text-ink">{action.title}</span>
        <span className="text-xs text-ink-faint">
          {action.kind === 'habito' ? 'hábito' : 'ação'}
        </span>
        <span className="tabular ml-auto inline-flex items-center gap-1 text-sm font-medium text-positive">
          <Icon name="subir" className="size-3.5" />
          {action.gain > 0 ? `+${action.gain}` : `+${action.rawGain} no bruto`}
        </span>
      </p>
      <p className="mt-1 text-xs text-pretty text-ink-muted">{action.reason}</p>
    </section>
  )
}
