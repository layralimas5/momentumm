import type { ReactNode } from 'react'
import { Icon } from '@/presentation/components/ui/Icon'
import { useDragSort } from '@/presentation/hooks/use-drag-sort'
import { cn } from '@/shared/lib/cn'

/**
 * Uma lista que se reordena arrastando.
 *
 * Existe como componente porque a mesma lista aparece em quatro lugares — as
 * etapas do objetivo, as ações de uma etapa, a caixa de entrada e a visão por
 * prazo. Quatro cópias do arraste seriam quatro jeitos de reordenar, e é assim
 * que uma delas acaba esquecendo de salvar a ordem nova.
 *
 * A alça é o único ponto que arrasta, e ela é um botão: quem usa teclado ou
 * leitor de tela move com as setas, sem depender de ponteiro nenhum.
 */
export function SortableList<T>({
  items,
  itemKey,
  itemLabel,
  onMove,
  renderItem,
  label,
  className,
  disabled = false,
}: {
  readonly items: readonly T[]
  readonly itemKey: (item: T) => string
  /** O que a alça anuncia. Sem isso, um leitor de tela lê só "mover". */
  readonly itemLabel: (item: T) => string
  readonly onMove: (from: number, to: number) => void
  readonly renderItem: (item: T, handle: ReactNode, index: number) => ReactNode
  readonly label: string
  readonly className?: string
  /** Lista com um item só, ou onde a ordem não é da pessoa: sem alça. */
  readonly disabled?: boolean
}) {
  const sort = useDragSort(items.length, onMove)
  const sortable = !disabled && items.length > 1

  return (
    <ol aria-label={label} className={className}>
      {items.map((item, index) => (
        <li
          key={itemKey(item)}
          ref={sort.setItemRef(index)}
          style={sortable ? sort.itemStyle(index) : undefined}
          className={cn(
            sort.activeIndex === index && 'opacity-95 drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]',
          )}
        >
          {renderItem(
            item,
            sortable ? (
              <button
                type="button"
                {...sort.handleProps(index)}
                aria-label={`Mover ${itemLabel(item)}. Use as setas para cima e para baixo`}
                className={cn(
                  'grid size-10 shrink-0 cursor-grab place-items-center rounded-lg text-ink-faint',
                  'transition-colors hover:bg-surface-hi hover:text-ink',
                  'focus-visible:bg-surface-hi focus-visible:text-ink active:cursor-grabbing',
                )}
              >
                <Icon name="arrastar" />
              </button>
            ) : null,
            index,
          )}
        </li>
      ))}
    </ol>
  )
}
