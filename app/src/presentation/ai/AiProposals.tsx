import { useEffect, useState } from 'react'
import type { AiRefs } from '@/domain/ai/ai-context'
import type { AiAdjustment } from '@/domain/ai/ai-service'
import { parseDayKey, type DayKey } from '@/domain/entities/day'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { cn } from '@/shared/lib/cn'
import { adjustmentDay, adjustmentMinutes, editAdjustment, type ResolvedAdjustment } from './adjustments'
import { useAiAdjustments, type ApplyOutcome } from './use-ai-adjustments'

interface AiProposalsProps {
  readonly adjustments: readonly AiAdjustment[]
  readonly refs: AiRefs
  /** O que dizer quando a IA não propôs nada. */
  readonly emptyText: string
  readonly applyLabel?: string
  readonly onApplied?: (outcome: ApplyOutcome) => void
  readonly onDiscard?: () => void
  readonly className?: string
}

interface Row {
  readonly key: string
  readonly adjustment: AiAdjustment
  readonly accepted: boolean
  /**
   * Resolvido no momento da proposta (e a cada edição), não a cada render:
   * depois de aplicar, o estado muda e a linha continuaria descrevendo o
   * ajuste que a pessoa ACEITOU, não o que ele viraria se fosse aplicado de novo.
   */
  readonly resolved: ResolvedAdjustment
}

/**
 * A lista de ajustes propostos, com o veredito da pessoa em cada um.
 *
 * Toda linha traz o que muda, em quem, e o motivo que a IA deu. A pessoa
 * aceita, edita (data ou duração) ou rejeita; nada é escrito até o botão de
 * aplicar, e ele diz quantos ajustes vão entrar. Depois de aplicar, a lista
 * mostra o que entrou e o que não entrou, com o porquê — um "pronto" genérico
 * esconderia justamente o item que falhou.
 *
 * Linha bloqueada (item que sumiu, data no passado) nasce desmarcada e diz o
 * motivo; ela não some, porque sumir sem explicação ensina a desconfiar das
 * outras.
 */
export function AiProposals({
  adjustments,
  refs,
  emptyText,
  applyLabel = 'Aplicar',
  onApplied,
  onDiscard,
  className,
}: AiProposalsProps) {
  const controller = useAiAdjustments(refs)
  const [rows, setRows] = useState<Row[]>([])

  // Cada proposta nova zera as decisões: aceitar por herança de outra lista
  // seria aplicar algo que a pessoa nunca leu.
  useEffect(() => {
    controller.reset()
    const resolved = controller.resolve(adjustments)
    setRows(
      adjustments.map((adjustment, index) => {
        const item = resolved[index] ?? { adjustment, label: '', target: null, blocked: 'Sem leitura.', editable: 'none' }
        return {
          key: `${adjustment.type}-${index}`,
          adjustment,
          accepted: item.blocked === null,
          resolved: item,
        }
      }),
    )
    // Só quando a lista de propostas muda: `controller` muda a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustments])

  const edit = (index: number, patch: { readonly day?: DayKey; readonly minutes?: number }) =>
    setRows((current) =>
      current.map((entry, position) => {
        if (position !== index) return entry
        const adjustment = editAdjustment(entry.adjustment, patch)
        const resolved = controller.resolve([adjustment])[0] ?? entry.resolved
        return { ...entry, adjustment, resolved }
      }),
    )

  const acceptedCount = rows.filter((row) => row.accepted).length
  const done = controller.outcome !== null

  if (adjustments.length === 0) {
    return <p className={cn('text-sm text-ink-muted', className)}>{emptyText}</p>
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
        {rows.map((row, index) => {
          const item = row.resolved
          const day = adjustmentDay(row.adjustment)
          const minutes = adjustmentMinutes(row.adjustment)
          const disabled = done || item.blocked !== null

          return (
            <li key={row.key} className={cn('flex gap-3 px-3.5 py-3', !row.accepted && 'opacity-70')}>
              <input
                type="checkbox"
                aria-label={`Aceitar: ${item.label}`}
                checked={row.accepted}
                disabled={disabled}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((entry, position) =>
                      position === index ? { ...entry, accepted: event.target.checked } : entry,
                    ),
                  )
                }
                className="mt-1 size-4 shrink-0 accent-[var(--color-brand)]"
              />

              <div className="min-w-0 flex-1">
                <p className={cn('text-sm', row.accepted ? 'text-ink' : 'text-ink-muted line-through')}>
                  {item.label}
                </p>
                {item.target ? (
                  <p className="mt-0.5 truncate text-xs text-ink-faint">{item.target}</p>
                ) : null}
                <p className="mt-1 text-xs text-pretty text-ink-muted">
                  <span className="text-ink-faint">Por quê: </span>
                  {row.adjustment.reason}
                </p>
                {item.blocked ? (
                  <p className="mt-1 text-xs text-flame">{item.blocked}</p>
                ) : null}

                {/* Editar antes de aplicar: a data ou a duração, o que o tipo permite. */}
                {!done && item.editable !== 'none' ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {day !== null ? (
                      <input
                        type="date"
                        aria-label={`Data de: ${item.label}`}
                        value={day}
                        onChange={(event) => edit(index, { day: parseDayKey(event.target.value) })}
                        className="h-9 rounded-lg border border-line bg-surface-hi px-2 text-xs text-ink-muted"
                      />
                    ) : null}
                    {minutes !== null ? (
                      <label className="flex items-center gap-1.5 text-xs text-ink-faint">
                        <input
                          type="number"
                          min={5}
                          max={240}
                          aria-label={`Minutos de: ${item.label}`}
                          value={minutes}
                          onChange={(event) => edit(index, { minutes: Number(event.target.value) })}
                          className="h-9 w-20 rounded-lg border border-line bg-surface-hi px-2 text-xs text-ink"
                        />
                        min
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      {controller.outcome ? (
        <Outcome outcome={controller.outcome} />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            loading={controller.applying}
            disabled={acceptedCount === 0}
            onClick={() =>
              void controller
                .apply(rows.filter((row) => row.accepted).map((row) => row.adjustment))
                .then((outcome) => onApplied?.(outcome))
            }
          >
            <Icon name="check" className="size-4" />
            {applyLabel} {acceptedCount > 0 ? `(${acceptedCount})` : ''}
          </Button>
          {onDiscard ? (
            <Button size="sm" variant="ghost" onClick={onDiscard}>
              Descartar
            </Button>
          ) : null}
          <span className="text-xs text-ink-faint">Nada muda antes de você confirmar.</span>
        </div>
      )}
    </div>
  )
}

function Outcome({ outcome }: { readonly outcome: ApplyOutcome }) {
  return (
    <div role="status" className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-sm text-ink">
        <Icon name="check" className="size-4 text-positive" strokeWidth={2.5} />
        {outcome.applied === 0
          ? 'Nenhum ajuste entrou.'
          : `${outcome.applied} ${outcome.applied === 1 ? 'ajuste aplicado' : 'ajustes aplicados'}.`}
      </p>
      {outcome.failed.length > 0 ? (
        <ErrorNote
          message={outcome.failed.map((item) => `${item.label}: ${item.reason}`).join(' ')}
        />
      ) : null}
    </div>
  )
}
