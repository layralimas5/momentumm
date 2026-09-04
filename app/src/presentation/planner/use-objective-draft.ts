import { useMemo, useState } from 'react'
import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import { deadlineFrom } from '@/domain/entities/objective'
import { buildPlan, suggestedTarget, type PlanDraft } from '@/domain/entities/plan-builder'
import type { DayKey } from '@/domain/entities/day'

/** Objetivo sugerido por área, pra a pessoa editar em vez de encarar campo vazio. */
export const TITLE_SUGGESTIONS: Readonly<Record<ActivityTypeSlug, string>> = {
  leitura: 'Voltar a ler todo dia',
  estudo: 'Terminar o curso que comecei',
  treino: 'Sair do sedentarismo',
  meditacao: 'Criar uma prática diária de silêncio',
}

/** Menos de três dias por semana não constrói hábito, constrói lembrança. */
export const FREQUENCY_OPTIONS = [3, 4, 5, 6, 7] as const

const DEFAULT_DAYS = 60
const DEFAULT_DAYS_PER_WEEK = 5

export interface ObjectiveDraftState {
  readonly axis: ActivityTypeSlug
  readonly title: string
  readonly motive: string
  readonly days: number
  readonly target: string
  readonly daysPerWeek: number
  readonly suggestedTitle: string
  /** Alvo sugerido pro prazo escolhido, na unidade do eixo. */
  readonly suggested: number
  readonly finalTarget: number
  /** O plano recalculado a cada mudança. Nunca fica desatualizado na tela. */
  readonly plan: PlanDraft
  setAxis(axis: ActivityTypeSlug): void
  setTitle(title: string): void
  setMotive(motive: string): void
  setDays(days: number): void
  setTarget(target: string): void
  setDaysPerWeek(days: number): void
}

/**
 * O rascunho do objetivo e o plano que sai dele.
 *
 * Mora aqui porque o onboarding e a criação de um objetivo novo fazem a mesma
 * coisa com layouts diferentes — o onboarding em passos, o diálogo numa tela
 * só. Duplicar esse estado seria duplicar a regra de qual plano nasce de quais
 * respostas, e é exatamente aí que dois caminhos começam a divergir.
 */
export function useObjectiveDraft(today: DayKey): ObjectiveDraftState {
  const [axis, setAxis] = useState<ActivityTypeSlug>('leitura')
  const [title, setTitle] = useState('')
  const [motive, setMotive] = useState('')
  const [days, setDays] = useState(DEFAULT_DAYS)
  const [target, setTarget] = useState('')
  const [daysPerWeek, setDaysPerWeek] = useState(DEFAULT_DAYS_PER_WEEK)

  const suggestedTitle = TITLE_SUGGESTIONS[axis]
  const suggested = useMemo(() => suggestedTarget(axis, days), [axis, days])
  const finalTarget = Number(target) > 0 ? Number(target) : suggested
  const deadline = deadlineFrom(today, days)

  const plan = useMemo(
    () =>
      buildPlan({
        axis,
        title: title.trim() || suggestedTitle,
        target: finalTarget,
        today,
        deadline,
        daysPerWeek,
        motive: motive.trim() || null,
      }),
    [axis, title, suggestedTitle, finalTarget, today, deadline, daysPerWeek, motive],
  )

  return {
    axis,
    title,
    motive,
    days,
    target,
    daysPerWeek,
    suggestedTitle,
    suggested,
    finalTarget,
    plan,
    setAxis,
    setTitle,
    setMotive,
    setDays,
    setTarget,
    setDaysPerWeek,
  }
}
