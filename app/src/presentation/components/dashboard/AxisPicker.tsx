import { useState } from 'react'
import {
  MAX_AXIS_LABEL,
  type ActivityType,
  type ActivityTypeSlug,
} from '@/domain/entities/activity-type'
import { Button } from '@/presentation/components/ui/Button'
import { TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { cn } from '@/shared/lib/cn'

interface AxisPickerProps {
  /** Todas as áreas da conta: as de fábrica e as que ela criou. */
  readonly axes: readonly ActivityType[]
  /** Áreas já escolhidas, na ordem em que entraram. */
  readonly selected: readonly ActivityTypeSlug[]
  /** Áreas que já têm objetivo ativo e por isso não entram de novo. */
  readonly taken?: readonly ActivityTypeSlug[]
  readonly onAdd: (axis: ActivityTypeSlug) => void
  readonly onRemove: (axis: ActivityTypeSlug) => void
  readonly canAddMore: boolean
  /**
   * Cria uma área com o nome que a pessoa escreveu e devolve o slug. Ausente
   * quando a tela não pode criar (por exemplo, um seletor só de leitura).
   */
  readonly onCreateAxis?: (label: string) => Promise<ActivityTypeSlug | null>
}

/**
 * Escolha das áreas.
 *
 * Dá pra escolher mais de uma, e a tela mostra isso sem precisar de instrução:
 * o cartão marcado tem um check. O que ela NÃO deixa fazer é escolher a mesma
 * área duas vezes — um objetivo por eixo é regra de domínio, porque o progresso
 * dos dois sairia das mesmas atividades.
 *
 * A quinta opção é escrever a própria área. Ela vira um eixo de verdade: tem
 * cor, entra no filtro do histórico, no registro rápido e no gráfico da semana.
 * As quatro de fábrica são um ponto de partida, não a lista do que vale a pena
 * melhorar na vida de alguém.
 */
export function AxisPicker({
  axes,
  selected,
  taken = [],
  onAdd,
  onRemove,
  canAddMore,
  onCreateAxis,
}: AxisPickerProps) {
  const [writing, setWriting] = useState(false)
  const [label, setLabel] = useState('')

  const create = useAsyncAction(async () => {
    if (!onCreateAxis) return
    const slug = await onCreateAxis(label)
    if (slug) onAdd(slug)
    setLabel('')
    setWriting(false)
  })

  const canCreate = label.trim().length >= 2

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {axes.map((item) => {
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

        {onCreateAxis && !writing ? (
          <button
            type="button"
            onClick={() => setWriting(true)}
            className="flex items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-left transition-colors hover:border-line-hi"
          >
            <Icon name="mais" className="size-4 shrink-0 text-ink-faint" />
            <span className="text-sm font-medium text-ink-muted">Outra área</span>
          </button>
        ) : null}
      </div>

      {writing && onCreateAxis ? (
        <div className="rounded-xl border border-brand/40 bg-brand-dim/30 p-3">
          <label htmlFor="nova-area" className="text-sm font-medium text-ink">
            Que área é essa?
          </label>
          <p className="mt-0.5 text-xs text-ink-faint">
            Escrita, terapia, violão, inglês. O que você quiser acompanhar. É medida em minutos.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <TextInput
              id="nova-area"
              autoFocus
              maxLength={MAX_AXIS_LABEL}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && canCreate) {
                  event.preventDefault()
                  void create.run()
                }
              }}
              placeholder="Escrita"
              className="min-w-40 flex-1"
            />
            <Button onClick={() => void create.run()} disabled={!canCreate} loading={create.running}>
              <Icon name="check" className="size-4" />
              Criar área
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setWriting(false)
                setLabel('')
              }}
            >
              Cancelar
            </Button>
          </div>

          <div aria-live="polite" className="min-h-5">
            {create.error ? <p className="mt-2 text-sm text-danger">{create.error}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
