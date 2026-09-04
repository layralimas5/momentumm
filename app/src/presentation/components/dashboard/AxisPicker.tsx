import { ACTIVITY_TYPE_LIST, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

interface AxisPickerProps {
  /** Áreas já escolhidas, na ordem em que entraram. */
  readonly selected: readonly ActivityTypeSlug[]
  /** Áreas que já têm objetivo ativo e por isso não entram de novo. */
  readonly taken?: readonly ActivityTypeSlug[]
  readonly onAdd: (axis: ActivityTypeSlug) => void
  readonly onRemove: (axis: ActivityTypeSlug) => void
  readonly canAddMore: boolean
}

/**
 * Escolha das áreas.
 *
 * Dá pra escolher mais de uma, e a tela mostra isso sem precisar de instrução:
 * o cartão marcado tem um check e some do "adicionar". O que ela NÃO deixa
 * fazer é escolher a mesma área duas vezes — um objetivo por eixo é regra de
 * domínio, porque o progresso dos dois sairia das mesmas atividades.
 *
 * Tirar a última área é bloqueado no rascunho: sem área não existe plano.
 */
export function AxisPicker({ selected, taken = [], onAdd, onRemove, canAddMore }: AxisPickerProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ACTIVITY_TYPE_LIST.map((item) => {
        const isSelected = selected.includes(item.slug)
        const isTaken = taken.includes(item.slug)
        const isLast = isSelected && selected.length === 1
        const disabled = isTaken || (!isSelected && !canAddMore) || isLast

        return (
          <button
            key={item.slug}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => (isSelected ? onRemove(item.slug) : onAdd(item.slug))}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
              isSelected
                ? 'border-brand bg-brand-dim/50'
                : 'border-line bg-surface/60 hover:border-line-hi',
              disabled && !isSelected && 'cursor-not-allowed opacity-40 hover:border-line',
              isLast && 'cursor-default',
            )}
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.colorToken }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{item.label}</span>
              {isTaken ? (
                <span className="block text-xs text-ink-faint">Já tem objetivo ativo</span>
              ) : null}
            </span>
            {isSelected ? (
              <Icon name="check" className="size-4 shrink-0 text-brand-hi" strokeWidth={2.5} />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
