import {
  MAX_MINUTES_PER_DAY,
  MIN_MINUTES_PER_DAY,
  MINUTES_PER_DAY_PRESETS,
} from '@/domain/entities/plan-builder'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { FREQUENCY_OPTIONS } from '@/presentation/planner/use-journey-draft'

interface TimeBudgetFieldsProps {
  readonly minutesPerDay: number
  readonly daysPerWeek: number
  readonly objectiveCount: number
  readonly onMinutesChange: (minutes: number) => void
  readonly onDaysChange: (days: number) => void
}

/**
 * Quanto tempo por dia, e em quantos dias da semana.
 *
 * É a pergunta que transforma o plano em promessa cumprível: sem ela o app
 * calcula em cima de um tempo que ele inventou. Com ela, nenhuma sessão pode
 * passar do que a pessoa acabou de dizer que tem — e quando o objetivo pede
 * mais, quem avisa é o app, não a frustração da terceira semana.
 */
export function TimeBudgetFields({
  minutesPerDay,
  daysPerWeek,
  objectiveCount,
  onMinutesChange,
  onDaysChange,
}: TimeBudgetFieldsProps) {
  const share = Math.floor(minutesPerDay / Math.max(1, objectiveCount))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Minutos por dia</p>
        <ChoiceGroup
          label="Minutos por dia"
          value={minutesPerDay}
          onChange={onMinutesChange}
          options={MINUTES_PER_DAY_PRESETS.map((value) => ({
            value,
            label: formatMinutes(value),
          }))}
        />

        <Field label="Outro tempo" hint="Em minutos. Vale o que você faria numa semana ruim.">
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              className="mt-3"
              type="number"
              inputMode="numeric"
              min={MIN_MINUTES_PER_DAY}
              max={MAX_MINUTES_PER_DAY}
              value={MINUTES_PER_DAY_PRESETS.includes(minutesPerDay) ? '' : String(minutesPerDay)}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (Number.isFinite(value) && value > 0) onMinutesChange(value)
              }}
              placeholder={String(minutesPerDay)}
            />
          )}
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">Dias por semana</p>
        <ChoiceGroup
          label="Dias por semana"
          size="sm"
          value={daysPerWeek}
          onChange={onDaysChange}
          options={FREQUENCY_OPTIONS.map((value) => ({
            value,
            label: value === 7 ? 'Todo dia' : `${value}x`,
          }))}
        />
        <p className="mt-2 text-xs text-ink-faint">
          Escolhe o número que sobrevive a uma semana ruim, não o da semana perfeita.
        </p>
      </div>

      {objectiveCount > 1 ? (
        <p role="status" className="rounded-card border border-line bg-surface/60 px-4 py-3 text-sm text-ink-muted">
          {objectiveCount} objetivos dividem esses {minutesPerDay} minutos:{' '}
          <strong className="font-semibold text-ink">{share} minutos pra cada</strong> nos dias de
          sessão. O plano avisa se não couber.
        </p>
      ) : null}
    </div>
  )
}

/** 90 vira "1h30", não "1.5h 30min". */
function formatMinutes(value: number): string {
  if (value < 60) return `${value} min`
  const hours = Math.floor(value / 60)
  const rest = value % 60
  return rest === 0 ? `${hours}h` : `${hours}h${rest}`
}
