import { useState, type FormEvent } from 'react'
import { parseDayKey, type DayKey } from '@/domain/entities/day'
import { Button } from '@/presentation/components/ui/Button'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { DomainError } from '@/shared/errors'

/**
 * Dia e horário pra UMA ocorrência.
 *
 * Quem decide o que a escolha significa é o `onSubmit`: aqui só se coleta e se
 * mostra o erro que a regra devolver, em voz alta e perto do botão.
 */
export function RescheduleForm({
  today,
  initialTime,
  onSubmit,
  onCancel,
}: {
  readonly today: DayKey
  readonly initialTime: string | null
  readonly onSubmit: (day: DayKey, time: string | null) => Promise<void>
  readonly onCancel: () => void
}) {
  const [day, setDay] = useState<string>(today)
  const [time, setTime] = useState(initialTime ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await onSubmit(parseDayKey(day), time || null)
    } catch (caught) {
      if (!(caught instanceof DomainError)) throw caught
      setError(caught.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4 px-1 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dia">
          {(id, describedBy) => (
            <TextInput
              id={id}
              type="date"
              required
              min={today}
              value={day}
              onChange={(event) => setDay(event.target.value)}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <Field label="Horário">
          {(id, describedBy) => (
            <TextInput
              id={id}
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              aria-describedby={describedBy}
            />
          )}
        </Field>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
          Voltar
        </Button>
        <Button type="submit" className="flex-1" loading={saving}>
          Mover
        </Button>
      </div>
    </form>
  )
}
