import { useEffect, useState } from 'react'
import { isRunning } from '@/domain/entities/objective'
import {
  MAX_ROUTINE_REMINDER_MIN,
  ROUTINE_RECURRENCE_LABELS,
  ROUTINE_RECURRENCES,
  type RoutineItem,
  type RoutineRecurrence,
} from '@/domain/entities/routine-item'
import { Button } from '@/presentation/components/ui/Button'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'

/**
 * Criar e editar um item da rotina.
 *
 * ## Nome e dias, e o resto é opcional
 *
 * A rotina de uma pessoa tem dez, doze linhas. Um formulário de sete campos
 * obrigatórios por linha garante que ela nunca vai ser cadastrada, e aí o
 * recurso inteiro não existe. Então o botão de salvar liga com o NOME, e tudo
 * que vem depois do bloco de recorrência fica atrás de "mais detalhes",
 * fechado: quem quer só "Acordar 07:00, todo dia" resolve em dois toques e
 * quem quer duração, categoria, objetivo e lembrete abre e preenche.
 *
 * ## Editar a regra é diferente de mudar o dia
 *
 * Aqui se edita a REGRA: mudar o horário muda todos os dias daqui pra frente.
 * "Hoje eu treino às 20h" é outra operação, mora na linha do dia, e é por isso
 * que este diálogo não tem nenhum campo de "só hoje".
 */
const WEEKDAY_LABELS: readonly string[] = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const WEEKDAY_NAMES: readonly string[] = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
]

const REMINDER_OPTIONS: readonly { value: number | null; label: string }[] = [
  { value: null, label: 'Sem lembrete' },
  { value: 0, label: 'Na hora' },
  { value: 5, label: '5 minutos antes' },
  { value: 10, label: '10 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
]

export function RoutineItemDialog({
  open,
  editing,
  presetDay,
  onClose,
}: {
  readonly open: boolean
  readonly editing: RoutineItem | null
  /** O dia escolhido na visão semanal: um item de uma vez só já nasce nele. */
  readonly presetDay: string | null
  readonly onClose: () => void
}) {
  const planner = usePlanner()

  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [recurrence, setRecurrence] = useState<RoutineRecurrence>('diario')
  const [weekdays, setWeekdays] = useState<readonly number[]>([])
  const [durationMin, setDurationMin] = useState('')
  const [category, setCategory] = useState('')
  const [objectiveId, setObjectiveId] = useState('')
  const [reminderMin, setReminderMin] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [details, setDetails] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(editing?.title ?? '')
    setTime(editing?.timeOfDay ?? '')
    setRecurrence(editing?.recurrence ?? 'diario')
    setWeekdays(editing?.weekdays ?? [])
    setDurationMin(editing?.durationMin ? String(editing.durationMin) : '')
    setCategory(editing?.category ?? '')
    setObjectiveId(editing?.objectiveId ?? '')
    setReminderMin(editing?.reminderMin ?? null)
    setNote(editing?.note ?? '')
    // Editando, os detalhes abrem quando existe algum preenchido: fechá-los
    // esconderia o que a pessoa já escreveu.
    setDetails(
      Boolean(editing?.durationMin || editing?.category || editing?.objectiveId || editing?.note),
    )
  }, [open, editing])

  const objetivos = planner.objectives.filter(isRunning)
  const clean = title.trim()
  const canSave = clean.length >= 2 && (recurrence !== 'dias-semana' || weekdays.length > 0)

  const save = useAsyncAction(async () => {
    const changes = {
      title: clean,
      timeOfDay: time || null,
      recurrence,
      weekdays: recurrence === 'dias-semana' ? weekdays : [],
      day: recurrence === 'unica' ? ((presetDay ?? planner.today) as RoutineItem['day']) : null,
      durationMin: durationMin ? Number(durationMin) : null,
      category: category.trim() || null,
      objectiveId: objectiveId || null,
      reminderMin,
      note: note.trim() || null,
    }

    if (editing) await planner.updateRoutineItem(editing.id, changes)
    else await planner.createRoutineItem(changes)

    onClose()
  })

  const toggleWeekday = (day: number) => {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort(),
    )
  }

  return (
    <Dialog
      open={open}
      title={editing ? 'Editar item da rotina' : 'Novo item da rotina'}
      description={
        editing
          ? 'O que mudar aqui vale pra todos os dias daqui pra frente.'
          : 'Nome já basta. O resto é opcional e dá pra completar depois.'
      }
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save.run()} disabled={!canSave} loading={save.running}>
            <Icon name="check" className="size-4" />
            {editing ? 'Salvar' : 'Adicionar à rotina'}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSave) void save.run()
        }}
      >
        <Field label="O que é">
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              value={title}
              maxLength={90}
              autoFocus
              placeholder="Treino, café da manhã, dentista"
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Horário" hint="Opcional. Sem hora, ele aparece em 'algum momento do dia'.">
            {(id, describedBy) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            )}
          </Field>

          <Field label="Repete">
            {(id, describedBy) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={recurrence}
                onChange={(event) => setRecurrence(event.target.value as RoutineRecurrence)}
              >
                {ROUTINE_RECURRENCES.map((option) => (
                  <option key={option} value={option}>
                    {ROUTINE_RECURRENCE_LABELS[option]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {recurrence === 'dias-semana' ? (
          <Field label="Em que dias">
            {() => (
              <>
            {/*
              Sete alvos de 44px numa linha só. O seletor de dias é a coisa mais
              tocada deste formulário, e um `select` múltiplo no celular é a
              forma mais rápida de fazer alguém desistir.
            */}
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, index) => {
                const active = weekdays.includes(index)
                return (
                  <button
                    key={`${label}-${index}`}
                    type="button"
                    onClick={() => toggleWeekday(index)}
                    aria-pressed={active}
                    aria-label={WEEKDAY_NAMES[index]}
                    className={cn(
                      'size-11 rounded-xl border text-sm font-medium transition-colors',
                      active
                        ? 'border-brand bg-brand-dim/70 text-brand-ink'
                        : 'border-line text-ink-muted active:bg-surface-hi',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
              </>
            )}
          </Field>
        ) : null}

        <button
          type="button"
          onClick={() => setDetails((value) => !value)}
          aria-expanded={details}
          className="flex min-h-11 items-center gap-1.5 self-start text-sm text-ink-muted"
        >
          {details ? 'Menos detalhes' : 'Mais detalhes'}
          <Icon
            name="seta"
            aria-hidden="true"
            className={cn('size-3.5 transition-transform', details ? '-rotate-90' : 'rotate-90')}
          />
        </button>

        {details ? (
          <div className="flex flex-col gap-4 border-t border-line pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Duração" hint="Em minutos.">
                {(id, describedBy) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    type="number"
                    min={1}
                    max={720}
                    value={durationMin}
                    placeholder="45"
                    onChange={(event) => setDurationMin(event.target.value)}
                  />
                )}
              </Field>

              <Field label="Categoria">
                {(id, describedBy) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    value={category}
                    maxLength={40}
                    placeholder="Saúde, casa, trabalho"
                    onChange={(event) => setCategory(event.target.value)}
                  />
                )}
              </Field>
            </div>

            <Field
              label="Objetivo relacionado"
              hint="Opcional, e é o ponto: a maior parte da sua rotina não serve a objetivo nenhum."
            >
              {(id, describedBy) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={objectiveId}
                  onChange={(event) => setObjectiveId(event.target.value)}
                >
                  <option value="">Nenhum</option>
                  {objetivos.map((objective) => (
                    <option key={objective.id} value={objective.id}>
                      {objective.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="Lembrete"
              hint={
                time
                  ? 'Fica guardado. O aviso no celular ainda não dispara por item.'
                  : 'Precisa de um horário pra fazer sentido.'
              }
            >
              {(id, describedBy) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={reminderMin === null ? '' : String(reminderMin)}
                  disabled={!time}
                  onChange={(event) =>
                    setReminderMin(event.target.value === '' ? null : Number(event.target.value))
                  }
                >
                  {REMINDER_OPTIONS.filter(
                    (option) => option.value === null || option.value <= MAX_ROUTINE_REMINDER_MIN,
                  ).map((option) => (
                    <option key={option.label} value={option.value === null ? '' : option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Observação">
              {(id, describedBy) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  value={note}
                  maxLength={400}
                  placeholder="Levar o exame"
                  onChange={(event) => setNote(event.target.value)}
                />
              )}
            </Field>
          </div>
        ) : null}

        <div aria-live="polite" className="min-h-6">
          {save.error ? <p className="text-sm text-danger">{save.error}</p> : null}
        </div>
      </form>
    </Dialog>
  )
}
