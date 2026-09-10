import { useCallback, useMemo, useState } from 'react'
import {
  buildAdaptiveDay,
  clampAvailable,
  dayLoadOf,
  type AdaptiveDayPlan,
  type AdaptiveObjective,
  type DayLoad,
} from '@/domain/entities/adaptive-day'
import { shrinkToMinimal, type Task } from '@/domain/entities/task'
import { toUserMessage } from '@/shared/errors'
import type { DashboardView } from './use-dashboard'
import { usePlanner } from './use-planner'

/**
 * O Dia Adaptável na tela.
 *
 * O hook faz três coisas e nenhuma regra: monta a entrada do domínio a partir
 * do estado único do planner, guarda o pedido em aberto (tempo informado, o
 * que precisa ser protegido) e grava o que a pessoa confirmar. A decisão de
 * manter, reduzir ou reagendar mora inteira em `buildAdaptiveDay`.
 *
 * Nada é gravado antes do `confirm`. O plano é uma proposta, e uma proposta
 * que já mexeu no dia não é proposta.
 */

export interface AdaptiveRequest {
  /** Quanto tempo a pessoa disse que tem. */
  readonly availableMin: number
  /** Itens que não podem sair do dia. */
  readonly protectIds?: readonly string[]
  /** Ação marcada pra outro dia que entra em hoje antes de adaptar. */
  readonly bringId?: string
  /** Ação que vira a prioridade principal ao confirmar. */
  readonly promoteId?: string
  /** Ação que a pessoa escolheu fazer na versão mínima. */
  readonly minimalId?: string
  /** Recado curto acima da revisão. É o que liga a retomada ao plano. */
  readonly intro?: string
  /** O pedido nasceu do Modo Retomada. */
  readonly fromRecovery?: boolean
}

export interface AdaptiveDayController {
  /** O tamanho do dia como ele está montado agora. */
  readonly load: DayLoad
  /** O plano em revisão. Null quando não há nada aberto. */
  readonly plan: AdaptiveDayPlan | null
  readonly request: AdaptiveRequest | null
  readonly applying: boolean
  readonly error: string | null
  /** Monta a prévia. Não grava nada. */
  open(request: AdaptiveRequest): void
  close(): void
  /** Grava o plano em revisão. Devolve `false` quando alguma escrita falhou. */
  confirm(): Promise<boolean>
}

export function useAdaptiveDay(view: DashboardView): AdaptiveDayController {
  const planner = usePlanner()
  const [request, setRequest] = useState<AdaptiveRequest | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const objectives = useMemo<AdaptiveObjective[]>(
    () => view.objectives.map((item) => ({ progress: item.progress, plan: item.plan })),
    [view.objectives],
  )

  /*
    A ação que vem de outro dia entra na simulação já com a data de hoje.

    Sem isso o passo de retomada seria adaptado como se não existisse: o
    domínio só olha o que está marcado pra hoje, e a pessoa veria um plano que
    ignora exatamente o item que ela acabou de escolher.
  */
  const tasks = useMemo<readonly Task[]>(() => {
    if (!request?.bringId) return planner.tasks
    return planner.tasks.map((task) =>
      task.id === request.bringId ? { ...task, day: planner.today } : task,
    )
  }, [planner.tasks, planner.today, request?.bringId])

  const load = useMemo<DayLoad>(
    () =>
      dayLoadOf({
        today: planner.today,
        tasks: planner.tasks,
        habits: planner.habits,
        habitLogs: planner.habitLogs,
      }),
    [planner.today, planner.tasks, planner.habits, planner.habitLogs],
  )

  const plan = useMemo<AdaptiveDayPlan | null>(() => {
    if (!request) return null

    return buildAdaptiveDay({
      today: planner.today,
      availableMin: request.availableMin,
      capacity: view.capacity,
      momentum: view.momentum,
      tasks,
      habits: planner.habits,
      habitLogs: planner.habitLogs,
      objectives,
      ...(request.protectIds ? { protectIds: request.protectIds } : {}),
    })
  }, [
    request,
    planner.today,
    planner.habits,
    planner.habitLogs,
    tasks,
    view.capacity,
    view.momentum,
    objectives,
  ])

  const open = useCallback((next: AdaptiveRequest) => {
    setError(null)
    setRequest({ ...next, availableMin: clampAvailable(next.availableMin) })
  }, [])

  const close = useCallback(() => {
    setRequest(null)
    setError(null)
  }, [])

  const confirm = useCallback(async () => {
    if (!plan || !request) return false

    setApplying(true)
    setError(null)

    try {
      // A ordem importa: trazer pro dia antes de reagendar o resto, senão a
      // própria ação trazida entraria na conta de quem sai.
      if (request.bringId) {
        await planner.updateTask(request.bringId, { day: planner.today })
      }

      for (const item of plan.rescheduled) {
        if (item.kind !== 'acao' || item.moveTo === null) continue
        await planner.updateTask(item.id, { day: item.moveTo, isMainPriority: false })
      }

      const minimals = new Set(
        plan.reduced.filter((item) => item.kind === 'acao').map((item) => item.id),
      )
      if (request.minimalId) minimals.add(request.minimalId)

      for (const id of minimals) {
        const task = planner.tasks.find((item) => item.id === id)
        // Sem versão mínima escrita não há o que encolher: o domínio recusa, e
        // o plano já mostrou essa linha como "fica assim mesmo".
        if (!task || !task.minimalVersion) continue

        const smaller = shrinkToMinimal(task)
        await planner.updateTask(task.id, {
          title: smaller.title,
          minimalVersion: null,
          estimatedMin: smaller.estimatedMin,
          effort: smaller.effort,
        })
      }

      const promote = request.promoteId ?? plan.promoteTaskId
      if (promote) {
        await planner.updateTask(promote, { isMainPriority: true })
      }

      setRequest(null)
      return true
    } catch (cause) {
      setError(toUserMessage(cause))
      return false
    } finally {
      setApplying(false)
    }
  }, [plan, request, planner])

  return { load, plan, request, applying, error, open, close, confirm }
}
