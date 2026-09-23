import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  defaultsForMood,
  ENERGY_LEVELS,
  MOOD_OPTIONS,
  moodOption,
  type CapacityProfile,
  type CheckIn,
  type EnergyLevel,
  type FocusCapacity,
  type MoodState,
} from '@/domain/entities/checkin'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { cn } from '@/shared/lib/cn'
import { tapFeedback } from '@/shared/lib/haptics'

interface MobileCheckInProps {
  readonly checkIn: CheckIn | null
  readonly capacity: CapacityProfile
  readonly onSave: (input: {
    mood: MoodState
    energy: EnergyLevel
    focus: FocusCapacity
    note: string | null
  }) => Promise<void>
}

/**
 * Check-in do celular: um toque resolve.
 *
 * Escolher o estado já grava. A energia só é perguntada quando a resposta muda
 * o dia — ou seja, nos estados baixos, onde ela decide entre plano cheio e
 * versão mínima. Em dia bom, perguntar mais seria burocracia: o app já sabe o
 * que vai recomendar.
 */
export function MobileCheckIn({ checkIn, capacity, onSave }: MobileCheckInProps) {
  const [pending, setPending] = useState<MoodState | null>(null)
  const [editing, setEditing] = useState(false)

  const save = useAsyncAction(async (mood: MoodState, energy: EnergyLevel) => {
    await onSave({ mood, energy, focus: defaultsForMood(mood).focus, note: null })
    setPending(null)
    setEditing(false)
  })

  const choose = (mood: MoodState) => {
    tapFeedback()
    const defaults = defaultsForMood(mood)
    if (defaults.asksEnergy) {
      setPending(mood)
      return
    }
    void save.run(mood, defaults.energy)
  }

  if (checkIn && !editing && !pending) {
    return <CheckInSummary checkIn={checkIn} capacity={capacity} onEdit={() => setEditing(true)} />
  }

  return (
    <Panel tone="brand" aria-labelledby="checkin-titulo" className="p-4">
      <h2 id="checkin-titulo" className="text-sm font-semibold text-ink">
        Como você está chegando hoje?
      </h2>

      {/*
        Faixa horizontal: os cinco estados cabem numa passada de polegar e o
        corte do último indica que dá pra rolar. Empilhar viraria uma lista alta
        logo no topo, empurrando a prioridade pra fora da primeira dobra.
      */}
      <div
        role="group"
        aria-label="Como você está chegando hoje"
        className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {MOOD_OPTIONS.map((option) => {
          const selected = option.slug === (pending ?? checkIn?.mood)
          return (
            <button
              key={option.slug}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(option.slug)}
              disabled={save.running}
              className={cn(
                'flex min-h-14 shrink-0 flex-col items-start justify-center gap-1 rounded-2xl border px-3.5 py-2',
                'transition-colors disabled:opacity-60',
                selected
                  ? 'border-brand bg-brand-dim/70 text-ink'
                  : 'border-line bg-surface/70 text-ink-muted active:bg-surface-hi',
              )}
            >
              <MoodMeter weight={option.weight} active={selected} />
              <span className="text-sm font-medium whitespace-nowrap">{option.label}</span>
            </button>
          )
        })}
      </div>

      <AnimatePresence initial={false}>
        {pending ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-line/60 pt-4">
              <p className="text-sm text-ink-muted">
                E a energia hoje, de 1 a 5? É o que decide o tamanho do plano.
              </p>
              <div role="group" aria-label="Nível de energia" className="mt-2.5 flex gap-2">
                {ENERGY_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => void save.run(pending, level)}
                    disabled={save.running}
                    className={cn(
                      'tabular min-h-12 flex-1 rounded-xl border border-line bg-surface-hi/60 text-base font-medium',
                      'text-ink-muted transition-colors active:bg-brand-dim active:text-ink disabled:opacity-60',
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Sem altura reservada: o espaço vazio embaixo dos chips fazia o card
          parecer inacabado. O aviso empurra o conteúdo quando existir. */}
      <div aria-live="polite">
        {save.error ? <p className="mt-2 text-sm text-danger">{save.error}</p> : null}
      </div>

      {checkIn && editing && !pending ? (
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-2 min-h-11 text-sm text-ink-faint transition-colors active:text-ink"
        >
          Manter o check-in de antes
        </button>
      ) : null}
    </Panel>
  )
}

function CheckInSummary({
  checkIn,
  capacity,
  onEdit,
}: {
  checkIn: CheckIn
  capacity: CapacityProfile
  onEdit: () => void
}) {
  const mood = moodOption(checkIn.mood)

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Check-in de hoje: ${mood.label}, energia ${checkIn.energy} de 5. Tocar para atualizar.`}
      className="surface-card flex w-full items-center gap-3 p-4 text-left transition-colors active:bg-surface-hi"
    >
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand/40 bg-brand-dim/50"
      >
        <MoodMeter weight={mood.weight} active />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">
          {mood.label} · energia {checkIn.energy}/5
        </span>
        {/* Duas linhas: cortar a orientação do dia na metade a torna inútil. */}
        <span className="mt-0.5 line-clamp-2 block text-sm text-ink-faint">{capacity.guidance}</span>
      </span>

      <Icon name="seta" className="size-4 shrink-0 text-ink-faint" />
    </button>
  )
}

/** Cinco barrinhas crescentes: lê o estado sem depender de emoji nem de cor. */
function MoodMeter({ weight, active }: { weight: number; active: boolean }) {
  return (
    <span aria-hidden="true" className="flex items-end gap-0.5">
      {[0, 1, 2, 3, 4].map((index) => (
        <span
          key={index}
          className={cn(
            'w-1 rounded-full transition-colors',
            index <= weight ? (active ? 'bg-brand-hi' : 'bg-ink-faint') : 'bg-line-hi',
          )}
          style={{ height: `${6 + index * 2.5}px` }}
        />
      ))}
    </span>
  )
}
