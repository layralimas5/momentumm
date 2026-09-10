import { useState } from 'react'
import { MAX_AVAILABLE_MIN, MIN_AVAILABLE_MIN } from '@/domain/entities/adaptive-day'
import type { CapacityProfile } from '@/domain/entities/checkin'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'

/**
 * A porta do Dia Adaptável: "quanto tempo você tem hoje?".
 *
 * Uma linha só, com os tempos que as pessoas realmente dizem — meia hora, uma
 * hora, uma hora e meia, três horas — e um campo pra quem quer outro número.
 * Não é um formulário: perguntar energia aqui seria repetir o check-in, que já
 * respondeu isso e já está calibrando o plano por baixo.
 *
 * O card não decide nada. Ele abre a revisão, e a revisão é que mostra o que
 * muda antes de qualquer coisa ser gravada.
 */

const PRESETS: readonly { readonly min: number; readonly label: string }[] = [
  { min: 30, label: '30 min' },
  { min: 60, label: '1h' },
  { min: 90, label: '1h30' },
  { min: 180, label: '3h' },
]

interface AdaptiveDayCardProps {
  readonly plannedMin: number
  readonly openItems: number
  readonly capacity: CapacityProfile
  readonly onAdapt: (availableMin: number) => void
}

export function AdaptiveDayCard({
  plannedMin,
  openItems,
  capacity,
  onAdapt,
}: AdaptiveDayCardProps) {
  const [custom, setCustom] = useState('')

  // Sem nada em aberto não há o que adaptar, e um card perguntando o tempo de
  // um dia vazio só ocupa a dobra mais lida da tela.
  if (openItems === 0) return null

  const parsed = Number.parseInt(custom, 10)
  const valid = Number.isFinite(parsed) && parsed >= MIN_AVAILABLE_MIN && parsed <= MAX_AVAILABLE_MIN

  return (
    <Panel aria-labelledby="dia-adaptavel-titulo">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink-faint uppercase">
            <Icon name="relogio" className="size-4" />
            Dia adaptável
          </p>

          <h2 id="dia-adaptavel-titulo" className="mt-2 text-base font-semibold text-ink">
            Quanto tempo você tem hoje?
          </h2>

          <p className="mt-1 text-sm text-ink-muted">
            {plannedMin > 0
              ? `O dia está montado com ${plannedMin} min. Diz o que cabe e eu reorganizo sem perder os objetivos de vista.`
              : 'Diz quanto tempo cabe e eu organizo o dia em volta do que mais move os teus objetivos.'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.min}
            type="button"
            onClick={() => onAdapt(preset.min)}
            className={cn(
              'min-h-11 rounded-xl border border-line bg-surface-hi/60 px-4 text-sm font-medium text-ink-muted',
              'transition-colors hover:border-line-hi hover:text-ink active:bg-surface-top',
            )}
          >
            {preset.label}
          </button>
        ))}

        <span aria-hidden="true" className="hidden h-6 w-px bg-line sm:block" />

        <div className="flex items-center gap-2">
          <label htmlFor="tempo-livre" className="sr-only">
            Outro tempo, em minutos
          </label>
          <input
            id="tempo-livre"
            type="number"
            inputMode="numeric"
            min={MIN_AVAILABLE_MIN}
            max={MAX_AVAILABLE_MIN}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && valid) onAdapt(parsed)
            }}
            placeholder="min"
            className="h-11 w-20 rounded-xl border border-line bg-surface-hi px-3 text-ink transition-colors placeholder:text-ink-faint focus:border-brand"
          />
          <Button size="md" variant="secondary" disabled={!valid} onClick={() => onAdapt(parsed)}>
            Adaptar
          </Button>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-faint">{capacity.guidance}</p>
    </Panel>
  )
}
