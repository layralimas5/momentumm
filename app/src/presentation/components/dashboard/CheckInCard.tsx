import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ENERGY_LEVELS,
  FOCUS_CAPACITIES,
  FOCUS_LABELS,
  MAX_CHECKIN_NOTE,
  MOOD_OPTIONS,
  moodOption,
  type CapacityProfile,
  type CheckIn,
  type EnergyLevel,
  type FocusCapacity,
  type MoodState,
} from '@/domain/entities/checkin'
import { Button } from '@/presentation/components/ui/Button'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, PanelHeader, Tag } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { cn } from '@/shared/lib/cn'

interface CheckInCardProps {
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
 * "Como você está chegando hoje?" — a primeira pergunta do dia e a que calibra
 * todo o resto da tela.
 *
 * Depois de respondido o card encolhe: ele já cumpriu a função e não pode ficar
 * ocupando o espaço de quem ainda tem coisa a decidir.
 */
export function CheckInCard({ checkIn, capacity, onSave }: CheckInCardProps) {
  const [editing, setEditing] = useState(false)

  if (checkIn && !editing) {
    return <CheckInSummary checkIn={checkIn} capacity={capacity} onEdit={() => setEditing(true)} />
  }

  return (
    <CheckInForm
      checkIn={checkIn}
      onCancel={checkIn ? () => setEditing(false) : undefined}
      onSave={async (input) => {
        await onSave(input)
        setEditing(false)
      }}
    />
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
    <Panel
      aria-labelledby="checkin-titulo"
      className="flex flex-wrap items-start gap-x-5 gap-y-3"
    >
      <div className="min-w-0 flex-1">
        <h2 id="checkin-titulo" className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
          Seu check-in de hoje
        </h2>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <Tag tone="brand">{mood.label}</Tag>
          <Tag>Energia {checkIn.energy}/5</Tag>
          <Tag>Foco {FOCUS_LABELS[checkIn.focus].toLowerCase()}</Tag>
        </p>
        <p className="mt-2.5 text-sm text-ink-muted">{capacity.guidance}</p>
        {checkIn.note ? (
          <p className="mt-1.5 text-sm text-ink-faint italic">“{checkIn.note}”</p>
        ) : null}
      </div>

      <Button variant="secondary" size="sm" onClick={onEdit}>
        Atualizar
      </Button>
    </Panel>
  )
}

function CheckInForm({
  checkIn,
  onSave,
  onCancel,
}: {
  checkIn: CheckIn | null
  onSave: (input: {
    mood: MoodState
    energy: EnergyLevel
    focus: FocusCapacity
    note: string | null
  }) => Promise<void>
  onCancel?: (() => void) | undefined
}) {
  const [mood, setMood] = useState<MoodState>(checkIn?.mood ?? 'estavel')
  const [energy, setEnergy] = useState<EnergyLevel>(checkIn?.energy ?? 3)
  const [focus, setFocus] = useState<FocusCapacity>(checkIn?.focus ?? 'oscilando')
  const [note, setNote] = useState(checkIn?.note ?? '')
  const [noteOpen, setNoteOpen] = useState(Boolean(checkIn?.note))

  const save = useAsyncAction(async () => {
    await onSave({ mood, energy, focus, note: note.trim() || null })
  })

  const echo = moodOption(mood).echo

  return (
    <Panel tone="brand" aria-labelledby="checkin-titulo">
      <PanelHeader
        id="checkin-titulo"
        title="Como você está chegando hoje?"
        icon="raio"
        hint="Leva dez segundos e muda o que o Momentumm te sugere pro resto do dia."
      />

      <fieldset className="mt-5">
        <legend className="text-xs font-medium tracking-wide text-ink-faint uppercase">
          Estado
        </legend>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {MOOD_OPTIONS.map((option) => {
            const selected = option.slug === mood
            return (
              <button
                key={option.slug}
                type="button"
                aria-pressed={selected}
                onClick={() => setMood(option.slug)}
                className={cn(
                  'group relative flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all duration-150',
                  selected
                    ? 'border-brand bg-brand-dim/70 text-ink'
                    : 'border-line bg-surface/70 text-ink-muted hover:border-line-hi hover:text-ink active:bg-surface-hi',
                )}
              >
                <MoodMeter weight={option.weight} active={selected} />
                {option.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <fieldset>
          <legend className="text-xs font-medium tracking-wide text-ink-faint uppercase">
            Energia
          </legend>
          <ChoiceGroup
            className="mt-2.5"
            fill
            label="Nível de energia de 1 a 5"
            options={ENERGY_LEVELS.map((level) => ({ value: level, label: String(level) }))}
            value={energy}
            onChange={setEnergy}
          />
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium tracking-wide text-ink-faint uppercase">
            Foco
          </legend>
          <ChoiceGroup
            className="mt-2.5"
            fill
            label="Capacidade de foco"
            options={FOCUS_CAPACITIES.map((item) => ({ value: item, label: FOCUS_LABELS[item] }))}
            value={focus}
            onChange={setFocus}
          />
        </fieldset>
      </div>

      {noteOpen ? (
        <div className="mt-5">
          <label
            htmlFor="checkin-note"
            className="text-xs font-medium tracking-wide text-ink-faint uppercase"
          >
            Observação (opcional)
          </label>
          <input
            id="checkin-note"
            value={note}
            maxLength={MAX_CHECKIN_NOTE}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Dormi mal, mas quero manter o mínimo."
            autoFocus
            className="mt-2 h-11 w-full rounded-xl border border-line bg-canvas/50 px-3.5 text-ink placeholder:text-ink-faint transition-colors focus:border-brand"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-ink-faint transition-colors hover:text-ink"
        >
          <Icon name="mais" className="size-3.5" />
          Adicionar uma observação
        </button>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => void save.run()} loading={save.running}>
          <Icon name="check" className="size-4" />
          Registrar check-in
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <motion.p
          key={mood}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-ink-muted"
        >
          {echo}
        </motion.p>
      </div>

      <div aria-live="polite" className="min-h-6">
        {save.error ? <p className="mt-2 text-sm text-danger">{save.error}</p> : null}
      </div>
    </Panel>
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
            index <= weight
              ? active
                ? 'bg-brand-hi'
                : 'bg-ink-faint group-hover:bg-ink-muted'
              : 'bg-line-hi',
          )}
          style={{ height: `${6 + index * 2.5}px` }}
        />
      ))}
    </span>
  )
}
