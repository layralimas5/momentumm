import { IconWell } from '@/presentation/components/ds/Card'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * "Hoje estou sem energia": um toque e o dia encolhe pra versão mínima.
 * A faísca ao lado é a IA, quando a conta tem: ela reorganiza em vez de cortar.
 */
export function EnergyCard({
  active,
  onActivate,
  onUndo,
  onAi,
  className,
}: {
  readonly active: boolean
  readonly onActivate: () => void
  readonly onUndo: () => void
  readonly onAi?: () => void
  readonly className?: string
}) {
  return (
    <div className={cn('card flex items-center gap-2 p-2', className)}>
      <button
        type="button"
        onClick={active ? onUndo : onActivate}
        aria-pressed={active}
        className="press flex min-h-16 min-w-0 flex-1 items-center gap-3.5 rounded-[1.4rem] px-3 text-left"
      >
        <IconWell name="bateria" />
        <span className="min-w-0">
          <span className="block truncate text-[0.98rem] font-semibold text-ink">
            {active ? 'Modo sem energia ativo' : 'Hoje estou sem energia'}
          </span>
          <span className="block truncate text-[0.8rem] text-ink-faint">
            {active ? 'Toque pra voltar ao ritmo normal' : 'Adaptar metas e reduzir sobrecarga'}
          </span>
        </span>
      </button>
      {onAi ? (
        <button
          type="button"
          onClick={onAi}
          className="press grid size-12 shrink-0 place-items-center rounded-full text-brand-hi"
        >
          <Icon name="ia" className="size-5" />
          <span className="sr-only">Reorganizar o dia com a IA</span>
        </button>
      ) : null}
    </div>
  )
}
