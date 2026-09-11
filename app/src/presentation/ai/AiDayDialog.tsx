import { useEffect, useState } from 'react'
import { clampAvailable, MAX_AVAILABLE_MIN, MIN_AVAILABLE_MIN } from '@/domain/entities/adaptive-day'
import { Button } from '@/presentation/components/ui/Button'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'
import { AiErrorNote } from './AiErrorNote'
import { AiProposals } from './AiProposals'
import { AiQuotaNote, AiSkeleton, AiSource } from './AiBits'
import type { AiController } from './use-ai'

interface AiDayDialogProps {
  readonly open: boolean
  readonly ai: AiController
  /** O tempo que o card do dia sugeriu, pra não perguntar de novo. */
  readonly defaultAvailableMin: number
  readonly plannedMin: number
  readonly onClose: () => void
}

/**
 * "Reorganizar meu dia", a porta da IA no Hoje.
 *
 * Diferente do Dia Adaptável (aritmética fixa), aqui a IA lê o dia inteiro
 * com os próximos sete, o prazo de cada objetivo e a capacidade do check-in,
 * e devolve o MENOR conjunto de ajustes que faz o dia caber, cada um com o
 * motivo. A pessoa aceita, edita ou rejeita linha a linha; o botão de
 * aplicar é a única escrita.
 */
export function AiDayDialog({ open, ai, defaultAvailableMin, plannedMin, onClose }: AiDayDialogProps) {
  const [available, setAvailable] = useState(String(defaultAvailableMin))
  const call = ai.reorganizeDay
  const plan = call.result

  useEffect(() => {
    if (open) setAvailable(String(defaultAvailableMin))
  }, [open, defaultAvailableMin])

  const parsed = Number.parseInt(available, 10)
  const valid = Number.isFinite(parsed) && parsed >= MIN_AVAILABLE_MIN && parsed <= MAX_AVAILABLE_MIN

  const close = () => {
    call.reset()
    onClose()
  }

  return (
    <Dialog
      open={open}
      title="Reorganizar meu dia"
      description={`O dia está montado com ${plannedMin} min. Diz quanto cabe e a IA propõe o que sai, o que encolhe e o que fica.`}
      size="lg"
      onClose={close}
    >
      <div className="flex flex-col gap-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) void call.run(clampAvailable(parsed))
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Tempo disponível hoje
            <span className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={MIN_AVAILABLE_MIN}
                max={MAX_AVAILABLE_MIN}
                value={available}
                onChange={(event) => setAvailable(event.target.value)}
                className="h-11 w-24 rounded-xl border border-line bg-surface-hi px-3 text-ink transition-colors focus:border-brand"
              />
              <span className="text-sm text-ink-faint">min</span>
            </span>
          </label>
          <Button type="submit" loading={call.loading} disabled={!valid}>
            <Icon name="ia" className="size-4" />
            {plan ? 'Ler de novo' : 'Propor ajustes'}
          </Button>
        </form>

        {call.error ? <AiErrorNote message={call.error} code={call.errorCode} /> : null}
        {call.loading ? <AiSkeleton /> : null}

        {plan && !call.loading ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={plan.fits ? 'positive' : 'warn'}>
                {plan.fits ? 'Cabe com os ajustes' : 'Ainda não cabe'}
              </Tag>
              <p className="text-sm text-ink">{plan.summary}</p>
            </div>
            <p className="text-sm text-ink-muted">{plan.reasoning}</p>

            <AiProposals
              adjustments={plan.adjustments}
              refs={ai.refs}
              emptyText="O dia já cabe no tempo que você tem. Nada a mexer."
              applyLabel="Aplicar no dia"
              onDiscard={close}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5 border-t border-line pt-3">
          <AiSource />
          <AiQuotaNote quota={ai.quota} simulated={ai.simulated} />
        </div>
      </div>
    </Dialog>
  )
}
