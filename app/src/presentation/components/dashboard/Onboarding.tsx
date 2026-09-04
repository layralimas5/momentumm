import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ACTIVITY_TYPE_LIST, activityType, formatUnit } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import {
  DEADLINE_PRESETS,
  MAX_OBJECTIVE_MOTIVE,
  MAX_OBJECTIVE_TITLE,
} from '@/domain/entities/objective'
import type { PlanDraft } from '@/domain/entities/plan-builder'
import { Button } from '@/presentation/components/ui/Button'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { FREQUENCY_OPTIONS, useObjectiveDraft } from '@/presentation/planner/use-objective-draft'
import { cn } from '@/shared/lib/cn'
import { PlanPreview } from './PlanPreview'

interface OnboardingProps {
  readonly firstName: string | null
  readonly today: DayKey
  readonly onFinish: (plan: PlanDraft) => Promise<void>
}

const STEPS = ['Área', 'Objetivo', 'Prazo', 'Plano'] as const

/**
 * Primeiro acesso — a jornada inteira em uma tela.
 *
 * Conta nova não vê dez cards vazios: escolhe uma área, escreve o objetivo,
 * define o prazo e recebe um plano pronto pra virar hábito e ação. O último
 * passo não é um resumo, é o primeiro dia começando.
 *
 * O plano não é decorativo. Recalcula a cada mudança de prazo, alvo ou
 * frequência, e avisa quando a conta não fecha — cronograma que só funciona no
 * papel é a forma mais rápida de perder alguém na primeira semana.
 */
export function Onboarding({ firstName, today, onFinish }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const draft = useObjectiveDraft(today)
  const type = activityType(draft.axis)

  const finish = useAsyncAction(async () => {
    await onFinish(draft.plan)
  })

  const canAdvance = step !== 2 || draft.finalTarget > 0

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-balance text-ink lg:text-3xl">
          {firstName ? `Bem-vinda, ${firstName}.` : 'Bem-vinda ao Momentumm.'} Vamos tirar isso da
          intenção.
        </h2>
        <p className="mt-2 text-pretty text-ink-muted">
          Quatro perguntas. No fim você sai daqui com um plano feito de hábito e ação, e com o
          primeiro dia já começado.
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
              title="O que você quer mudar primeiro?"
              hint="Uma área só. As outras entram quando essa virar rotina."
            >
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {ACTIVITY_TYPE_LIST.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    aria-pressed={item.slug === draft.axis}
                    onClick={() => draft.setAxis(item.slug)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                      item.slug === draft.axis
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
              title="Qual é o objetivo?"
              hint="Escreve como você contaria pra alguém. O número entra no passo seguinte."
            >
              <div className="mt-4 flex flex-col gap-4">
                <Field label="Objetivo">
                  {(id) => (
                    <TextInput
                      id={id}
                      maxLength={MAX_OBJECTIVE_TITLE}
                      value={draft.title}
                      onChange={(event) => draft.setTitle(event.target.value)}
                      placeholder={draft.suggestedTitle}
                    />
                  )}
                </Field>

                <Field
                  label="Por que isso importa"
                  hint="Opcional. É o que o app te devolve num dia em que você não quer levantar."
                >
                  {(id, describedBy) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      maxLength={MAX_OBJECTIVE_MOTIVE}
                      value={draft.motive}
                      onChange={(event) => draft.setMotive(event.target.value)}
                      placeholder="Quero voltar a terminar o que começo."
                    />
                  )}
                </Field>
              </div>
            </Step>
          ) : null}

          {step === 2 ? (
            <Step
              title="Até quando, e quanto?"
              hint="Prazo transforma intenção em plano. O alvo já vem sugerido pelo ritmo saudável da área."
            >
              <div className="mt-4 flex flex-col gap-5">
                <div>
                  <p className="mb-2 text-sm font-medium text-ink">Prazo</p>
                  <ChoiceGroup
                    label="Prazo do objetivo"
                    value={draft.days}
                    onChange={draft.setDays}
                    options={DEADLINE_PRESETS.map((preset) => ({
                      value: preset.days,
                      label: preset.label,
                    }))}
                  />
                </div>

                <Field
                  label={`Alvo total em ${type.unitLabel.many}`}
                  hint={`Sugestão pra esse prazo: ${formatUnit(type, draft.suggested)}.`}
                >
                  {(id, describedBy) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={draft.target}
                      onChange={(event) => draft.setTarget(event.target.value)}
                      placeholder={String(draft.suggested)}
                    />
                  )}
                </Field>

                <div>
                  <p className="mb-2 text-sm font-medium text-ink">Dias por semana</p>
                  <ChoiceGroup
                    label="Dias por semana"
                    size="sm"
                    value={draft.daysPerWeek}
                    onChange={draft.setDaysPerWeek}
                    options={FREQUENCY_OPTIONS.map((value) => ({
                      value,
                      label: value === 7 ? 'Todo dia' : `${value}x`,
                    }))}
                  />
                  <p className="mt-2 text-xs text-ink-faint">
                    Escolhe o número que sobrevive a uma semana ruim, não o da semana perfeita.
                  </p>
                </div>
              </div>
            </Step>
          ) : null}

          {step === 3 ? (
            <Step
              title="Esse é o teu plano"
              hint="Feito com a tua conta, não com frase pronta. Dá pra mudar tudo depois, sem perder nada."
            >
              <div className="mt-4">
                <PlanPreview plan={draft.plan} today={today} onUseSuggestedDeadline={draft.setDays} />
              </div>
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
              {step < STEPS.length - 1 ? (
                <Button
                  size="lg"
                  className="min-h-12"
                  onClick={() => setStep((current) => current + 1)}
                  disabled={!canAdvance}
                >
                  Continuar
                  <Icon name="seta" className="size-4" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="min-h-12"
                  onClick={() => void finish.run()}
                  loading={finish.running}
                >
                  <Icon name="play" className="size-4" />
                  Começar o primeiro dia
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
  readonly title: string
  readonly hint: string
  readonly children: ReactNode
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-balance text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{hint}</p>
      {children}
    </div>
  )
}
