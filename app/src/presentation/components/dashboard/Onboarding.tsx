import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { activityType, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import type { PlanDraft } from '@/domain/entities/plan-builder'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useJourneyDraft } from '@/presentation/planner/use-journey-draft'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { AxisPicker } from './AxisPicker'
import { CombinedPlanPreview } from './CombinedPlanPreview'
import { ObjectiveFields } from './ObjectiveFields'
import { TimeBudgetFields } from './TimeBudgetFields'

interface OnboardingProps {
  readonly firstName: string | null
  readonly today: DayKey
  readonly onFinish: (plans: readonly PlanDraft[]) => Promise<void>
}

const STEPS = ['Áreas', 'Tempo', 'Objetivos', 'Plano'] as const

/**
 * Primeiro acesso — a jornada inteira em uma tela.
 *
 * Conta nova não vê dez cards vazios: escolhe o que quer mudar (uma área ou
 * quantas quiser), diz quanto tempo por dia consegue dar, escreve os objetivos
 * com prazo e recebe um plano pronto pra virar hábito e ação. O último passo
 * não é um resumo, é o primeiro dia começando.
 *
 * A ordem é deliberada: o TEMPO vem antes dos objetivos. É ele que calibra
 * cada alvo sugerido, e perguntar depois faria o app propor números que ele
 * mesmo já sabe que não cabem.
 *
 * O plano recalcula a cada mudança e avisa quando a conta não fecha —
 * cronograma que só funciona no papel é a forma mais rápida de perder alguém
 * na primeira semana.
 */
export function Onboarding({ firstName, today, onFinish }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const planner = usePlanner()
  const draft = useJourneyDraft(today, { axes: planner.axes })

  const finish = useAsyncAction(async () => {
    await onFinish(draft.combined.plans)
  })

  const selectedAxes = draft.entries.map((entry) => entry.axis)

  const useSuggestedDeadline = (axis: string, days: number) => {
    draft.updateObjective(axis as ActivityTypeSlug, { days })
  }

  const useFittingTarget = (axis: string, target: number) => {
    draft.updateObjective(axis as ActivityTypeSlug, { target: String(target) })
  }

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
              title="O que você quer mudar?"
              hint="Pode ser uma área só, e pode ser mais de uma. Se a tua não está na lista, escreve ela em “Outra área”."
            >
              <div className="mt-4">
                <AxisPicker
                  axes={planner.axes}
                  selected={selectedAxes}
                  canAddMore={draft.canAddMore}
                  onAdd={draft.addObjective}
                  onRemove={draft.removeObjective}
                  onCreateAxis={async (label) => (await planner.createAxis(label))?.slug ?? null}
                />

                <p className="mt-3 text-xs text-ink-faint">
                  {selectedAxes.length === 1
                    ? 'Uma área é o começo mais seguro. Se quiser mais, é só tocar em outra.'
                    : `${selectedAxes.length} áreas escolhidas. Elas vão dividir o mesmo tempo do teu dia, e o plano diz se cabe.`}
                </p>
              </div>
            </Step>
          ) : null}

          {step === 1 ? (
            <Step
              title="Quanto tempo por dia?"
              hint="O tempo que você está disposta a dedicar de verdade. Nenhum plano daqui vai pedir mais que isso."
            >
              <div className="mt-4">
                <TimeBudgetFields
                  minutesPerDay={draft.minutesPerDay}
                  daysPerWeek={draft.daysPerWeek}
                  objectiveCount={draft.entries.length}
                  onMinutesChange={draft.setMinutesPerDay}
                  onDaysChange={draft.setDaysPerWeek}
                />
              </div>
            </Step>
          ) : null}

          {step === 2 ? (
            <Step
              title={draft.entries.length === 1 ? 'Qual é o objetivo?' : 'Quais são os objetivos?'}
              hint="Escreve como você contaria pra alguém. O alvo já vem sugerido pelo tempo que você reservou."
            >
              <div className="mt-4 flex flex-col gap-4">
                {draft.entries.map((entry) => (
                  <ObjectiveFields
                    key={entry.axis}
                    entry={entry}
                    onChange={(changes) => draft.updateObjective(entry.axis, changes)}
                    onRemove={
                      draft.entries.length > 1 ? () => draft.removeObjective(entry.axis) : null
                    }
                  />
                ))}

                {draft.canAddMore ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-ink-faint">Adicionar outro objetivo:</span>
                    {draft.availableAxes.map((axis) => (
                      <Button
                        key={axis}
                        variant="ghost"
                        size="sm"
                        onClick={() => draft.addObjective(axis)}
                      >
                        <Icon name="mais" className="size-3.5" />
                        {activityType(axis).label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Step>
          ) : null}

          {step === 3 ? (
            <Step
              title={draft.entries.length === 1 ? 'Esse é o teu plano' : 'Esses são os teus planos'}
              hint="Feito com a tua conta, não com frase pronta. Dá pra mudar tudo depois, sem perder nada."
            >
              <div className="mt-4">
                <CombinedPlanPreview
                  combined={draft.combined}
                  today={today}
                  onUseSuggestedDeadline={useSuggestedDeadline}
                  onUseFittingTarget={useFittingTarget}
                />
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
                <Button size="lg" className="min-h-12" onClick={() => setStep((current) => current + 1)}>
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
