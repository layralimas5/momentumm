import { useState } from 'react'
import { motion } from 'framer-motion'
import { ACTIVITY_TYPE_LIST, activityType, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import type { HabitIcon } from '@/domain/entities/habit'
import { Button } from '@/presentation/components/ui/Button'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { TextInput } from '@/presentation/components/ui/Field'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { cn } from '@/shared/lib/cn'
import type { GoalDraft, HabitDraft, TaskDraft } from './Composer'

interface OnboardingProps {
  readonly firstName: string | null
  readonly today: DayKey
  readonly onFinish: (setup: {
    /** Null quando a pessoa pulou a etapa. A prioridade nunca é null. */
    goal: GoalDraft | null
    habit: HabitDraft | null
    task: TaskDraft
  }) => Promise<void>
}

/** Ícone sugerido por área, pra a pessoa não precisar escolher no primeiro dia. */
const ICON_BY_AXIS: Readonly<Record<ActivityTypeSlug, HabitIcon>> = {
  leitura: 'livro',
  estudo: 'cerebro',
  treino: 'halter',
  meditacao: 'lotus',
}

const SUGGESTIONS: Readonly<
  Record<ActivityTypeSlug, { habit: string; task: string; minimal: string; target: number }>
> = {
  leitura: {
    habit: 'Ler antes de dormir',
    task: 'Ler o primeiro capítulo',
    minimal: 'Ler 3 páginas',
    target: 20,
  },
  estudo: {
    habit: 'Estudar 30 minutos',
    task: 'Revisar a primeira aula',
    minimal: 'Reler as anotações',
    target: 30,
  },
  treino: {
    habit: 'Treinar',
    task: 'Fazer o primeiro treino da semana',
    minimal: 'Fazer 10 minutos de movimento',
    target: 45,
  },
  meditacao: {
    habit: 'Respirar 10 minutos',
    task: 'Fazer a primeira sessão guiada',
    minimal: 'Respirar por 3 minutos',
    target: 10,
  },
}

const STEPS = ['Área', 'Meta', 'Hábito', 'Hoje'] as const

/**
 * Primeiro acesso.
 *
 * Conta nova não vê dez cards vazios: vê quatro perguntas que produzem um
 * dashboard com conteúdo de verdade no fim. Uma área, uma meta, um hábito,
 * uma prioridade.
 */
export function Onboarding({ firstName, today, onFinish }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [axis, setAxis] = useState<ActivityTypeSlug>('leitura')
  const [target, setTarget] = useState('')
  const [habitName, setHabitName] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  // Meta e hábito são puláveis; a prioridade de hoje não. O onboarding só
  // cumpre a função dele se a pessoa sair daqui com uma próxima ação definida.
  const [skipped, setSkipped] = useState<{ goal: boolean; habit: boolean }>({
    goal: false,
    habit: false,
  })

  const suggestion = SUGGESTIONS[axis]
  const type = activityType(axis)

  const finish = useAsyncAction(async () => {
    const goalTarget = Number(target) || suggestion.target

    await onFinish({
      goal: skipped.goal ? null : { type: axis, target: goalTarget, period: 'dia' },
      habit: skipped.habit
        ? null
        : {
            name: habitName.trim() || suggestion.habit,
            icon: ICON_BY_AXIS[axis],
            axis,
            dayPart: 'qualquer',
            weekdays: [],
            target: goalTarget,
            minimalTarget: Math.max(1, Math.round(goalTarget / 3)),
          },
      task: {
        title: taskTitle.trim() || suggestion.task,
        goalId: null,
        axis,
        estimatedMin: 25,
        effort: 'medio',
        minimalVersion: suggestion.minimal,
        day: today,
        isMainPriority: true,
      },
    })
  })

  const canAdvance =
    step === 0 ||
    (step === 1 && (target === '' || Number(target) > 0)) ||
    step === 2 ||
    step === 3

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-balance text-ink lg:text-3xl">
          {firstName ? `Bem-vinda, ${firstName}.` : 'Bem-vinda ao Momentumm.'} Vamos tirar isso da
          intenção.
        </h2>
        <p className="mt-2 text-pretty text-ink-muted">
          Quatro perguntas rápidas. No fim você já sai daqui com um plano de hoje, não com uma tela
          vazia.
        </p>
      </header>

      <ol className="flex items-center gap-2" aria-label="Etapas do onboarding">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                index <= step ? 'bg-brand' : 'bg-surface-top',
              )}
            />
            <span
              className={cn(
                'text-xs whitespace-nowrap',
                index === step ? 'text-ink' : 'text-ink-faint',
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Panel tone="brand">
          {step === 0 ? (
            <Step
              title="O que você quer melhorar primeiro?"
              hint="Uma área só. As outras entram quando essa virar rotina."
            >
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {ACTIVITY_TYPE_LIST.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    aria-pressed={item.slug === axis}
                    onClick={() => setAxis(item.slug)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                      item.slug === axis
                        ? 'border-brand bg-brand-dim/50'
                        : 'border-line bg-surface/60 hover:border-line-hi',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: item.colorToken }}
                    />
                    <span className="text-sm font-medium text-ink">{item.label}</span>
                  </button>
                ))}
              </div>
            </Step>
          ) : null}

          {step === 1 ? (
            <Step
              title="Qual meta você quer bater por dia?"
              hint={`Em ${type.unitLabel.many}. Escolhe um número que você bateria até num dia ruim. Dá pra pular e definir depois.`}
            >
              <div className="mt-4 flex flex-col gap-3">
                <ChoiceGroup
                  label="Meta sugerida"
                  size="sm"
                  value={Number(target) || suggestion.target}
                  onChange={(value) => setTarget(String(value))}
                  options={type.quickValues.map((value) => ({
                    value,
                    label: `${value} ${type.unit === 'paginas' ? 'pág' : 'min'}`,
                  }))}
                />
                <TextInput
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  placeholder={`Outro valor em ${type.unitLabel.many}`}
                  aria-label={`Meta diária em ${type.unitLabel.many}`}
                />
              </div>
            </Step>
          ) : null}

          {step === 2 ? (
            <Step
              title="Qual hábito simples sustenta essa meta?"
              hint="Simples de verdade: hábito grande demais não sobrevive à primeira semana ruim. Dá pra pular e criar depois."
            >
              <TextInput
                className="mt-4"
                value={habitName}
                onChange={(event) => setHabitName(event.target.value)}
                placeholder={suggestion.habit}
                aria-label="Nome do hábito"
              />
            </Step>
          ) : null}

          {step === 3 ? (
            <Step
              title="E qual é a prioridade de hoje?"
              hint="A ação que, se sair, já faz o dia valer."
            >
              <TextInput
                className="mt-4"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder={suggestion.task}
                aria-label="Prioridade de hoje"
              />
              <p className="mt-3 text-sm text-ink-faint">
                A versão mínima dela já vem pronta: “{suggestion.minimal}”.
              </p>
            </Step>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="min-h-12"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
            >
              <Icon name="setaEsq" className="size-4" />
              Voltar
            </Button>

            <div className="flex flex-1 items-center justify-end gap-2">
              {step === 1 || step === 2 ? (
                <Button
                  variant="ghost"
                  className="min-h-12"
                  onClick={() => {
                    setSkipped((current) =>
                      step === 1 ? { ...current, goal: true } : { ...current, habit: true },
                    )
                    setStep((current) => current + 1)
                  }}
                >
                  Pular
                </Button>
              ) : null}

              {step < STEPS.length - 1 ? (
                <Button
                  size="lg"
                  className="min-h-12"
                  onClick={() => {
                    setSkipped((current) =>
                      step === 1
                        ? { ...current, goal: false }
                        : step === 2
                          ? { ...current, habit: false }
                          : current,
                    )
                    setStep((current) => current + 1)
                  }}
                  disabled={!canAdvance}
                >
                  Continuar
                  <Icon name="seta" className="size-4" />
                </Button>
              ) : (
                <Button size="lg" className="min-h-12" onClick={() => void finish.run()} loading={finish.running}>
                  <Icon name="check" className="size-4" />
                  Montar meu dia
                </Button>
              )}
            </div>
          </div>

          <div aria-live="polite" className="min-h-5">
            {finish.error ? <p className="mt-2 text-sm text-danger">{finish.error}</p> : null}
          </div>
        </Panel>
      </motion.div>
    </div>
  )
}

function Step({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-balance text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{hint}</p>
      {children}
    </div>
  )
}
