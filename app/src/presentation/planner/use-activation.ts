import { useCallback, useEffect, useMemo, useState } from 'react'
import { track } from '@/infrastructure/analytics/track'
import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import {
  buildActivation,
  lifeArea,
  resolveHorizon,
  type ActivationAdjustment,
  type ActivationAnswers,
  type ActivationPlan,
  type ActivationRemedy,
  type LifeAreaKey,
} from '@/domain/entities/activation'
import type { PlanDraft } from '@/domain/entities/plan-builder'
import { toUserMessage } from '@/shared/errors'
import { usePlanner } from './use-planner'

/**
 * O onboarding como estado, separado do desenho.
 *
 * Três responsabilidades e nenhuma regra de plano: guardar as respostas
 * (inclusive entre sessões), navegar entre os passos e gravar no fim. Quem
 * decide o que vira objetivo, marco e ação é `buildActivation`.
 *
 * ## Pular e retomar
 *
 * O rascunho vive no `localStorage`, não no banco: é um formulário pela
 * metade, não dado de negócio, e gravar objetivo incompleto no Postgres
 * sujaria o progresso de quem só estava olhando. Fechar a aba no meio do
 * terceiro passo e voltar dois dias depois cai exatamente no terceiro passo.
 */

const DRAFT_KEY = 'momentumm.activation.v1'
const SKIPPED_KEY = 'momentumm.activation.skipped.v1'

export const ACTIVATION_STEPS = ['Área', 'Objetivo', 'Prazo', 'Tempo', 'Plano'] as const
export const ACTIVATION_PLAN_STEP = ACTIVATION_STEPS.length - 1

/** As respostas com a área ainda em aberto: no primeiro passo não há escolha feita. */
export interface ActivationDraft extends Omit<ActivationAnswers, 'area'> {
  readonly area: LifeAreaKey | null
}

const EMPTY_DRAFT: ActivationDraft = {
  area: null,
  extraAreas: [],
  customArea: '',
  goal: '',
  horizon: { kind: 'flexivel' },
  budget: { mode: 'dia', minutes: 30, weekdays: [1, 2, 3, 4, 5] },
}

export interface ActivationController {
  readonly step: number
  readonly draft: ActivationDraft
  /** Null enquanto a área não foi escolhida: sem ela não existe plano. */
  readonly plan: ActivationPlan | null
  readonly adjustment: ActivationAdjustment | null
  /** A pessoa deixou o onboarding pra depois. */
  readonly skipped: boolean
  /** Já respondeu alguma coisa: é o que transforma "começar" em "retomar". */
  readonly started: boolean
  readonly saving: boolean
  readonly error: string | null
  /** O passo atual está respondido? */
  readonly canAdvance: boolean
  /** Mensagem do que falta responder. Null quando dá pra avançar. */
  readonly blocker: string | null
  set(changes: Partial<ActivationDraft>): void
  /**
   * Marca ou desmarca uma área. A primeira marcada é a principal (vira o
   * plano); as outras entram como eixo. Tirar a principal promove a seguinte.
   */
  toggleArea(area: LifeAreaKey): void
  applyRemedy(remedy: ActivationRemedy): void
  next(): void
  back(): void
  goTo(step: number): void
  skip(): void
  resume(): void
  /** Grava tudo. Devolve `false` quando o plano ainda não pode ser salvo. */
  save(): Promise<boolean>
}

export function useActivation(): ActivationController {
  const planner = usePlanner()

  const stored = useMemo(loadDraft, [])
  const [step, setStep] = useState(stored?.step ?? 0)
  const [draft, setDraft] = useState<ActivationDraft>(stored?.draft ?? EMPTY_DRAFT)
  const [adjustment, setAdjustment] = useState<ActivationAdjustment | null>(
    stored?.adjustment ?? null,
  )
  const [skipped, setSkipped] = useState(loadSkipped)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const existingAxes = useMemo<ActivityTypeSlug[]>(
    () => planner.axes.map((axis) => axis.slug),
    [planner.axes],
  )

  const plan = useMemo<ActivationPlan | null>(() => {
    if (draft.area === null) return null

    return buildActivation({
      answers: { ...draft, area: draft.area },
      today: planner.today,
      existingAxes,
      ...(adjustment ? { adjustment } : {}),
    })
  }, [draft, planner.today, existingAxes, adjustment])

  // Rascunho persistido a cada mudança: é o que faz "retomar" existir.
  useEffect(() => {
    if (draft.area === null && draft.goal.trim().length === 0) return
    persistDraft({ step, draft, adjustment })
  }, [step, draft, adjustment])

  const set = useCallback((changes: Partial<ActivationDraft>) => {
    setError(null)
    /*
      Mudar uma resposta joga fora o ajuste aceito antes.

      O ajuste foi uma decisão sobre OUTRO plano — reduzir o alvo de um plano
      de 30 dias não faz sentido depois que o prazo virou 90, e manter ele
      mostraria um número que ninguém escolheu.
    */
    setAdjustment(null)
    setDraft((current) => ({ ...current, ...changes }))
  }, [])

  const toggleArea = useCallback(
    (area: LifeAreaKey) => {
      const selected = [
        ...(draft.area ? [draft.area] : []),
        ...draft.extraAreas.filter((key) => key !== draft.area),
      ]
      const next = selected.includes(area)
        ? selected.filter((key) => key !== area)
        : [...selected, area]
      set({ area: next[0] ?? null, extraAreas: next.slice(1) })
    },
    [draft.area, draft.extraAreas, set],
  )

  const applyRemedy = useCallback((remedy: ActivationRemedy) => {
    if (!remedy.adjustment) return
    setAdjustment(remedy.adjustment)
  }, [])

  const horizonError = useMemo(
    () => resolveHorizon(draft.horizon, planner.today).error,
    [draft.horizon, planner.today],
  )

  const blocker = useMemo<string | null>(() => {
    switch (step) {
      case 0:
        if (draft.area === null) return 'Escolhe pelo menos uma área pra começar.'
        if (selectedAreas(draft).includes('outro') && draft.customArea.trim().length < 2) {
          return 'Escreve o nome da tua área.'
        }
        return null
      case 1:
        return draft.goal.trim().length < 3 ? 'Escreve o que você quer alcançar.' : null
      case 2:
        return horizonError
      case 3:
        if (draft.budget.weekdays.length === 0) return 'Marca pelo menos um dia da semana.'
        return draft.budget.minutes <= 0 ? 'Diz quanto tempo você consegue dedicar.' : null
      default:
        return null
    }
  }, [step, draft, horizonError])

  const next = useCallback(() => {
    if (blocker) return
    setStep((current) => Math.min(ACTIVATION_PLAN_STEP, current + 1))
  }, [blocker])

  const back = useCallback(() => setStep((current) => Math.max(0, current - 1)), [])

  const goTo = useCallback((target: number) => {
    setStep(Math.min(ACTIVATION_PLAN_STEP, Math.max(0, target)))
  }, [])

  const skip = useCallback(() => {
    setSkipped(true)
    persistSkipped(true)
  }, [])

  const resume = useCallback(() => {
    setSkipped(false)
    persistSkipped(false)
  }, [])

  const save = useCallback(async () => {
    if (!plan || !plan.ready) return false

    setSaving(true)
    setError(null)

    try {
      /*
        A área vira eixo AGORA, não quando ela foi escolhida.

        Criar a linha no passo 1 deixaria uma área órfã em `activity_types`
        pra cada pessoa que desistisse no meio — e o filtro do histórico
        nasceria cheio de coisa que nunca teve um registro.
      */
      const created = plan.needsAxis ? await planner.createAxis(plan.areaLabel) : null
      const draftToSave =
        created && created.slug !== plan.axis ? withAxis(plan.plan, created.slug) : plan.plan

      await planner.applyPlan([draftToSave])

      // As outras áreas viram eixo depois do plano gravado: se falharem, o
      // plano principal já existe e a pessoa só perde uma linha que ela
      // recria em dois toques.
      for (const extra of plan.extraAxes) {
        if (extra.needsAxis) await planner.createAxis(extra.label)
      }

      track('onboarding_completed')

      clearDraft()
      persistSkipped(false)
      return true
    } catch (cause) {
      setError(toUserMessage(cause))
      return false
    } finally {
      setSaving(false)
    }
  }, [plan, planner])

  return {
    step,
    draft,
    plan,
    adjustment,
    skipped,
    started: draft.area !== null || draft.goal.trim().length > 0,
    saving,
    error,
    canAdvance: blocker === null,
    blocker,
    set,
    toggleArea,
    applyRemedy,
    next,
    back,
    goTo,
    skip,
    resume,
    save,
  }
}

/** Todas as áreas marcadas, principal primeiro. */
export function selectedAreas(draft: ActivationDraft): readonly LifeAreaKey[] {
  if (draft.area === null) return []
  return [draft.area, ...draft.extraAreas.filter((key) => key !== draft.area)]
}

/** O nome da área principal, já resolvido. A tela usa isso em quase todo passo. */
export function areaLabelOf(draft: ActivationDraft): string {
  if (draft.area === null) return ''
  return draft.area === 'outro'
    ? draft.customArea.trim() || 'Outra'
    : lifeArea(draft.area).label
}

/**
 * Reaponta o plano pro slug que o banco devolveu.
 *
 * Na prática os dois coincidem — a mesma função gera os dois. A defesa existe
 * porque um objetivo apontando pra um eixo inexistente só apareceria semanas
 * depois, como uma área sem nome no gráfico da semana.
 */
function withAxis(plan: PlanDraft, axis: ActivityTypeSlug): PlanDraft {
  return {
    ...plan,
    objective: { ...plan.objective, axis },
    goal: { ...plan.goal, type: axis },
    tasks: plan.tasks.map((task) => ({ ...task, axis })),
  }
}

// ---------------------------------------------------------------------------
// persistência do rascunho
// ---------------------------------------------------------------------------

interface StoredDraft {
  readonly step: number
  readonly draft: ActivationDraft
  readonly adjustment: ActivationAdjustment | null
}

function loadDraft(): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null

    const value = parsed as Partial<StoredDraft>
    if (!value.draft) return null

    // Mescla com o vazio: um rascunho gravado por uma versão anterior do
    // formulário não pode derrubar a tela por falta de um campo novo.
    return {
      step: typeof value.step === 'number' ? value.step : 0,
      draft: { ...EMPTY_DRAFT, ...value.draft },
      adjustment: value.adjustment ?? null,
    }
  } catch {
    return null
  }
}

function persistDraft(value: StoredDraft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(value))
  } catch {
    // Sem armazenamento o onboarding continua funcionando; só não retoma.
  }
}

function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Nada a fazer: o plano já foi salvo, que é o que importava.
  }
}

function loadSkipped(): boolean {
  try {
    return window.localStorage.getItem(SKIPPED_KEY) === 'true'
  } catch {
    return false
  }
}

function persistSkipped(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(SKIPPED_KEY, 'true')
    else window.localStorage.removeItem(SKIPPED_KEY)
  } catch {
    // Sem armazenamento o onboarding reaparece na próxima sessão.
  }
}
