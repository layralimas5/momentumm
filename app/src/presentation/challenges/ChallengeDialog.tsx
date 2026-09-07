import { useMemo, useState, type ReactNode } from 'react'
import { activityType, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import {
  CHALLENGE_MODES,
  CHALLENGE_MODE_HINTS,
  CHALLENGE_MODE_LABELS,
  MAX_CHALLENGE_DESCRIPTION,
  MAX_CHALLENGE_NAME,
  type ChallengeMode,
} from '@/domain/entities/challenge'
import { addDays, type DayKey } from '@/domain/entities/day'
import { isHabitRunning } from '@/domain/entities/habit'
import { Button } from '@/presentation/components/ui/Button'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useIsDesktop } from '@/presentation/hooks/use-media-query'
import { usePlanner } from '@/presentation/planner/use-planner'
import type { ChallengesState } from './use-challenges'

/**
 * Criar um desafio.
 *
 * A ordem das perguntas é a ordem em que a pessoa pensa: o que a gente vai
 * fazer, com que frequência, por quanto tempo, e de onde o app vai saber que
 * saiu. A última é a que mais importa e é a que quase todo app de desafio
 * esquece — sem ela, cumprir vira uma segunda tarefa de marcar caixinha.
 *
 * Convidar NÃO acontece aqui. O desafio nasce vazio e os convites saem da tela
 * dele, onde já dá pra ver o combinado escrito: mandar convite antes de existir
 * o que ler é pedir que a pessoa aceite no escuro.
 */

const DURATIONS: readonly { readonly days: number; readonly label: string }[] = [
  { days: 7, label: '7 dias' },
  { days: 14, label: '14 dias' },
  { days: 21, label: '21 dias' },
  { days: 30, label: '30 dias' },
]

const TITLE = 'Novo desafio'
const DESCRIPTION = 'Um combinado curto entre você e quem você chamar.'

export function ChallengeDialog({
  open,
  challenges,
  onClose,
  onCreated,
}: {
  readonly open: boolean
  readonly challenges: ChallengesState
  readonly onClose: () => void
  readonly onCreated: (challengeId: string) => void
}) {
  const isDesktop = useIsDesktop()

  const content = (
    <ChallengeForm challenges={challenges} onClose={onClose} onCreated={onCreated} />
  )

  return isDesktop ? (
    <Dialog open={open} size="lg" title={TITLE} description={DESCRIPTION} onClose={onClose}>
      {content}
    </Dialog>
  ) : (
    <BottomSheet open={open} title={TITLE} description={DESCRIPTION} onClose={onClose}>
      {content}
    </BottomSheet>
  )
}

function ChallengeForm({
  challenges,
  onClose,
  onCreated,
}: {
  readonly challenges: ChallengesState
  readonly onClose: () => void
  readonly onCreated: (challengeId: string) => void
}) {
  const planner = usePlanner()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [axis, setAxis] = useState<ActivityTypeSlug>(planner.axes[0]?.slug ?? 'treino')
  const [mode, setMode] = useState<ChallengeMode>('diaria')
  const [days, setDays] = useState(21)
  const [target, setTarget] = useState('4')
  const [habitId, setHabitId] = useState('')
  const [dailyTarget, setDailyTarget] = useState('20')

  const type = activityType(axis)
  const habits = useMemo(
    () => planner.habits.filter((habit) => isHabitRunning(habit) && habit.axis === axis),
    [planner.habits, axis],
  )

  const startsOn: DayKey = planner.today
  const endsOn: DayKey = addDays(planner.today, days - 1)

  const submit = async () => {
    const created = await challenges.create({
      name: name.trim(),
      description: description.trim() || null,
      axis,
      mode,
      startsOn,
      endsOn,
      ...(mode === 'diaria' ? {} : { target: Number(target) }),
      dailyTarget: Number(dailyTarget) || 1,
      habitId: habitId || null,
    })

    if (created) {
      onCreated(created.id)
      onClose()
    }
  }

  const targetLabel =
    mode === 'semanal' ? 'Quantos dias por semana' : 'Quantos dias no total'

  const canSubmit =
    name.trim().length >= 3 && (mode === 'diaria' || Number(target) > 0) && !challenges.acting

  return (
    <div className="flex flex-col gap-5">
      {challenges.error ? <ErrorNote message={challenges.error} /> : null}

      <Field label="O que vocês vão fazer" hint="Ex: treinar 20 dias no mês.">
        {(id) => (
          <TextInput
            id={id}
            value={name}
            maxLength={MAX_CHALLENGE_NAME}
            placeholder="Nome do desafio"
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>

      <Field label="Combinado (opcional)" hint="O detalhe que evita discussão depois.">
        {(id) => (
          <TextInput
            id={id}
            value={description}
            maxLength={MAX_CHALLENGE_DESCRIPTION}
            placeholder="Vale o treino que couber no dia"
            onChange={(event) => setDescription(event.target.value)}
          />
        )}
      </Field>

      <Field label="Área">
        {(id) => (
          <Select
            id={id}
            value={axis}
            onChange={(event) => {
              setAxis(event.target.value)
              // O hábito pertence a um eixo: mantê-lo depois de trocar de área
              // faria o progresso vir de um lugar que a tela não está mostrando.
              setHabitId('')
            }}
          >
            {planner.axes.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Group label="Frequência" hint={CHALLENGE_MODE_HINTS[mode]}>
        <ChoiceGroup
          label="Frequência do desafio"
          fill
          value={mode}
          onChange={setMode}
          options={CHALLENGE_MODES.map((item) => ({
            value: item,
            label: CHALLENGE_MODE_LABELS[item],
          }))}
        />
      </Group>

      {mode === 'diaria' ? null : (
        <Field label={targetLabel}>
          {(id) => (
            <TextInput
              id={id}
              type="number"
              inputMode="numeric"
              min={1}
              max={mode === 'semanal' ? 7 : days}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          )}
        </Field>
      )}

      <Group label="Por quanto tempo">
        <ChoiceGroup
          label="Duração do desafio"
          fill
          value={days}
          onChange={setDays}
          options={DURATIONS.map((item) => ({ value: item.days, label: item.label }))}
        />
      </Group>

      {/*
        De onde vem o progresso.

        O hábito vem primeiro porque é o que a pessoa já cumpre: desafio que
        obriga a registrar de novo o que ela registrou hoje de manhã é desafio
        que morre na segunda semana. Sem hábito, o app conta pelo que ela
        registrar na área — e aí precisa saber quanto fecha um dia.
      */}
      <Field
        label="Como eu vou saber que o dia saiu"
        hint={
          habits.length === 0
            ? `Você ainda não tem hábito de ${type.label.toLowerCase()}. O app conta pelo que você registrar.`
            : 'Vincular um hábito evita registrar duas vezes a mesma coisa.'
        }
      >
        {(id) => (
          <Select id={id} value={habitId} onChange={(event) => setHabitId(event.target.value)}>
            <option value="">Pelo que eu registrar em {type.label}</option>
            {habits.map((habit) => (
              <option key={habit.id} value={habit.id}>
                Quando eu cumprir “{habit.name}”
              </option>
            ))}
          </Select>
        )}
      </Field>

      {habitId ? null : (
        <Field
          label={`Quanto fecha um dia, em ${type.unitLabel.many}`}
          hint={`Abaixo disso o dia não conta no desafio.`}
        >
          {(id) => (
            <TextInput
              id={id}
              type="number"
              inputMode="numeric"
              min={1}
              value={dailyTarget}
              onChange={(event) => setDailyTarget(event.target.value)}
            />
          )}
        </Field>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={() => void submit()} loading={challenges.acting} disabled={!canSubmit}>
          Criar desafio
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>

      <p className="text-xs text-ink-faint">
        O desafio é privado. Ninguém vê ele até você convidar, e o que os outros
        enxergam é quantos dias você fechou aqui dentro. Nada da sua rotina.
      </p>
    </div>
  )
}

/** Rótulo de um grupo que não é um `input`: `Field` exige um `id` pra associar. */
function Group({
  label,
  hint,
  children,
}: {
  readonly label: string
  readonly hint?: string
  readonly children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-ink">{label}</p>
      {children}
      {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
    </div>
  )
}
