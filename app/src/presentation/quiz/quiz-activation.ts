import { useCallback, useEffect, useRef, useState } from 'react'
import { isTrialActive } from '@/domain/billing/trial'
import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { PlanDraft } from '@/domain/entities/plan-builder'
import { ObjectiveAxisConflictError } from '@/domain/entities/objective'
import { PlanLimitError } from '@/domain/entities/plan-usage'
import { buildQuizPlan } from '@/domain/entities/quiz'
import { linkQuizSessionToMe, markQuizActivated, trackFunnel } from '@/infrastructure/analytics/funnel'
import { track } from '@/infrastructure/analytics/track'
import { toUserMessage } from '@/shared/errors'
import { useAuth } from '@/presentation/auth/use-auth'
import { usePlanner } from '@/presentation/planner/use-planner'
import { clearPendingQuizPlan, loadPendingQuizPlan, saveFirstWin } from './quiz-storage'

/** A rota que grava o plano do quiz depois do cadastro. Dentro de `/app`, sem casca. */
export const QUIZ_ACTIVATION_PATH = '/app/ativar'

/** Existe um plano do quiz esperando esta conta? A casca do app pergunta antes do onboarding. */
export function hasPendingQuizPlan(): boolean {
  return loadPendingQuizPlan() !== null
}

export type QuizActivationStatus =
  | 'ativando'
  | 'pronto'
  | 'sem-plano'
  | 'erro'
  | 'limite'
  /** Já existe um objetivo ativo na mesma área do plano do quiz. */
  | 'conflito'

/** O limite que barrou a ativação, pra tela oferecer o que destrava. */
export interface QuizActivationLimit {
  readonly feature: string
  readonly message: string
}

export interface QuizActivation {
  readonly status: QuizActivationStatus
  readonly error: string | null
  /** Preenchido só no status `limite`. */
  readonly limit: QuizActivationLimit | null
  /** O eixo disputado. Preenchido só no status `conflito`. */
  readonly conflictAxis: ActivityTypeSlug | null
  retry(): void
  /**
   * Descarta o plano do quiz e libera o caminho pro app.
   *
   * Existe porque a casca do app manda pra esta tela sempre que há plano
   * pendente: sem uma saída, um erro que "tentar de novo" não resolve prende
   * a pessoa FORA do produto, com a conta criada e nada acessível. Isso
   * aconteceu de verdade — é o motivo deste método existir.
   */
  skip(): void
}

/**
 * Grava o plano do quiz como dados reais do app, uma vez.
 *
 * O plano é RECALCULADO aqui com o `today` e os eixos da conta, pelo mesmo
 * `buildQuizPlan` da prévia: as respostas são a fonte, não a prévia. Isso
 * importa quando a pessoa fecha o quiz num dia e cria a conta no outro (a
 * primeira ação precisa cair em hoje) e quando a conta já tem a área
 * criada. A ordem é a do onboarding: eixo → objetivo, meta, etapas e ações
 * (`applyPlan`) → hábito → vínculo da sessão → evento. Se o hábito falhar,
 * o plano já existe; a pessoa perde uma linha que recria em dois toques.
 */
export function useQuizActivation(): QuizActivation {
  const { user, trial } = useAuth()
  const planner = usePlanner()
  const [status, setStatus] = useState<QuizActivationStatus>('ativando')
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState<QuizActivationLimit | null>(null)
  const [conflictAxis, setConflictAxis] = useState<ActivityTypeSlug | null>(null)
  const startedRef = useRef(false)
  // O provider muda a cada gravação; o callback lê sempre a versão mais nova.
  const plannerRef = useRef(planner)
  plannerRef.current = planner

  const run = useCallback(async () => {
    if (!user) return
    const pending = loadPendingQuizPlan()
    if (!pending) {
      setStatus('sem-plano')
      return
    }

    setStatus('ativando')
    setError(null)
    setLimit(null)
    setConflictAxis(null)

    try {
      const existingAxes: ActivityTypeSlug[] = planner.axes.map((axis) => axis.slug)
      const preview = buildQuizPlan({ answers: pending.answers, today: planner.today, existingAxes })
      const { plan, habit } = preview

      const created = plan.needsAxis ? await planner.createAxis(plan.areaLabel) : null
      const axis = created?.slug ?? plan.axis
      const draft: PlanDraft = created && created.slug !== plan.axis ? withAxis(plan.plan, axis) : plan.plan

      // Uma tentativa anterior pode ter gravado o objetivo e falhado depois:
      // tentar de novo não pode criar o mesmo objetivo duas vezes.
      const alreadyThere = plannerRef.current.objectives.some(
        (item) => item.title === plan.objectiveTitle && item.axis === axis,
      )
      if (!alreadyThere) await planner.applyPlan([draft])

      // O vínculo vem antes do evento: `plan_activated` precisa nascer com dono.
      await linkQuizSessionToMe()
      trackFunnel('signup_completed', null, pending.attribution)

      await nextTick()
      const objective =
        plannerRef.current.objectives.find((item) => item.title === plan.objectiveTitle) ?? null

      try {
        await planner.createHabit({
          name: habit.name,
          icon: habit.icon,
          axis,
          dayPart: habit.dayPart,
          weekdays: habit.weekdays,
          target: habit.target,
          minimalTarget: habit.minimalTarget,
          description: habit.description,
          objectiveId: objective?.id ?? null,
        })
      } catch {
        // O plano já está gravado; o hábito é a única perda, e é recriável.
      }

      trackFunnel('plan_activated', null, pending.attribution)
      track('onboarding_completed', null, {
        source: pending.attribution.source ?? 'quiz',
        kind: 'quiz',
      })
      if (isTrialActive(trial)) {
        trackFunnel('trial_started', null)
        track('trial_started', null, { kind: 'quiz' })
      }
      await markQuizActivated()

      if (plan.firstStep) {
        saveFirstWin(user.id, {
          taskTitle: plan.firstStep.title,
          day: planner.today,
          activatedAt: new Date().toISOString(),
        })
      }

      // A sessão do quiz fica no navegador, vinculada: primeira ação,
      // checkout e assinatura ainda vão cair na mesma linha do funil.
      clearPendingQuizPlan()
      setStatus('pronto')
    } catch (cause) {
      /*
        Limite do plano não é falha: a conta antiga que já tem dois objetivos
        em andamento esbarra aqui com o plano pronto na mão. "Tentar de novo"
        falharia igual, então a tela precisa saber QUAL limite parou, pra
        oferecer o que destrava (liberar espaço ou assinar o PRO).
      */
      if (cause instanceof PlanLimitError) {
        setLimit({ feature: cause.feature, message: cause.message })
        setStatus('limite')
        return
      }

      /*
        Mesma natureza do limite: o plano do quiz quer uma área que já tem
        objetivo ativo. "Tentar de novo" falharia sempre pelo mesmo motivo, e
        "refazer o quiz" também, porque a pessoa escolheria a mesma área. A
        tela precisa saber QUAL área é pra oferecer o que destrava.
      */
      if (cause instanceof ObjectiveAxisConflictError) {
        setConflictAxis(cause.axis)
        setError(cause.message)
        setStatus('conflito')
        return
      }

      setError(toUserMessage(cause))
      setStatus('erro')
    }
  }, [user, planner, trial])

  useEffect(() => {
    if (planner.loading || !user || startedRef.current) return
    startedRef.current = true
    void run()
  }, [planner.loading, user, run])

  const retry = useCallback(() => {
    startedRef.current = true
    void run()
  }, [run])

  const skip = useCallback(() => {
    clearPendingQuizPlan()
    setStatus('sem-plano')
  }, [])

  return { status, error, limit, conflictAxis, retry, skip }
}

function withAxis(plan: PlanDraft, axis: ActivityTypeSlug): PlanDraft {
  return {
    ...plan,
    objective: { ...plan.objective, axis },
    goal: { ...plan.goal, type: axis },
    tasks: plan.tasks.map((task) => ({ ...task, axis })),
  }
}

/**
 * `applyPlan` escreve no estado do provider de forma otimista, mas o render
 * que criou este callback ainda tem o `data` de antes. Um tick basta pra o
 * React repintar e o `plannerRef` apontar pro estado com o objetivo.
 */
function nextTick(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0))
}
