import { useMemo } from 'react'
import type { Activity } from '@/domain/entities/activity'
import { addDays, dayKeyOf } from '@/domain/entities/day'
import { habitConsistency, type Habit, type HabitConsistency } from '@/domain/entities/habit'
import { forecastOf, type Forecast } from '@/domain/entities/forecast'
import type { ObjectiveProgress } from '@/domain/entities/objective'
import { planProgressOf, type PlanProgress } from '@/domain/entities/plan-progress'
import { comparePriority } from '@/domain/entities/priority'
import { byPlanOrder, isPending, type Task } from '@/domain/entities/task'
import { usePlanner } from './use-planner'

/** Dias sem nenhum movimento a partir dos quais o objetivo é considerado parado. */
export const STALLED_AFTER_DAYS = 7

export interface ObjectiveView {
  /** O volume registrado contra o alvo: o ritmo. */
  readonly progress: ObjectiveProgress
  /**
   * O plano: etapas, progresso ponderado, gargalo e próxima ação. É daqui que
   * sai a porcentagem que a tela mostra quando o objetivo tem plano.
   */
  readonly plan: PlanProgress
  readonly forecast: Forecast
  /**
   * A porcentagem que a tela mostra.
   *
   * Com plano, é a execução ponderada — é ela que responde "quanto do caminho
   * eu andei". Sem plano, cai no volume: uma barra em zero pra quem leu 400
   * páginas seria simplesmente falsa, e o produto perderia a promessa de que
   * registrar empurra o objetivo.
   */
  readonly ratio: number
  /** De onde veio o número acima. A tela precisa dizer isso em voz alta. */
  readonly ratioSource: 'plano' | 'volume'
  readonly habits: readonly { habit: Habit; consistency: HabitConsistency }[]
  readonly tasks: readonly Task[]
  readonly openTasks: readonly Task[]
  readonly doneTasks: number
  /** Últimas atividades do eixo dentro da janela do objetivo. */
  readonly recent: readonly Activity[]
  /** Sem nenhum movimento há mais de uma semana. */
  readonly stalled: boolean
  readonly nextTask: Task | null
}

/**
 * Os objetivos com tudo que está pendurado neles.
 *
 * A conta acontece aqui e não em componente porque a mesma leitura aparece na
 * lista, no detalhe, no dia e no progresso — e é a divergência entre essas
 * quatro que faz um app parecer quatro apps.
 */
export function useObjectives(): readonly ObjectiveView[] {
  const { objectiveProgress, plans, habits, tasks, activities, habitLogs, today } = usePlanner()

  return useMemo(() => {
    const views = objectiveProgress.map((progress) => {
      const objective = progress.objective
      /*
        O plano vem calculado do provider. O fallback existe só pro instante
        entre uma escrita otimista e o recálculo: melhor uma linha sem etapa
        por um quadro do que a tela inteira quebrando.
      */
      const plan =
        plans.find((item) => item.objective.id === objective.id) ??
        planProgressOf(objective, [], tasks, habits, today)

      const forecast = forecastOf({ plan, habits, habitLogs, today })

      const linkedHabits = habits
        .filter((habit) => habit.objectiveId === objective.id && habit.archivedAt === null)
        .map((habit) => ({
          habit,
          consistency: habitConsistency(habit, habitLogs, objective.startedOn, today),
        }))

      const linkedTasks = tasks
        .filter((task) => task.objectiveId === objective.id)
        .sort(byPlanOrder)

      const openTasks = linkedTasks.filter(isPending)

      const recent = activities
        .filter(
          (activity) =>
            activity.type === objective.axis &&
            activity.day >= objective.startedOn &&
            activity.day <= objective.deadline,
        )
        .slice(0, 8)

      /*
        Parado é não ter movimento NENHUM: nem registro do eixo, nem ação
        concluída. Olhar só a atividade marcaria como parado quem passou a
        semana fechando ações de planejamento, que é justamente quem está
        avançando o objetivo.
      */
      const lastCompletion = linkedTasks
        .map((task) => task.completedAt)
        .filter((date): date is Date => date !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0]

      const lastMove = recent[0]?.day ?? null
      const limit = addDays(today, -STALLED_AFTER_DAYS)
      const movedRecently =
        (lastMove !== null && lastMove >= limit) ||
        (lastCompletion !== undefined && dayKeyOf(lastCompletion) >= limit)

      const stalled = progress.state === 'em-andamento' && !movedRecently

      return {
        progress,
        plan,
        forecast,
        ratio: plan.hasPlan ? plan.ratio : progress.ratio,
        ratioSource: plan.hasPlan ? ('plano' as const) : ('volume' as const),
        habits: linkedHabits,
        tasks: linkedTasks,
        openTasks,
        doneTasks: linkedTasks.filter((task) => task.status === 'feita').length,
        recent,
        stalled,
        nextTask: openTasks[0] ?? null,
      }
    })

    // Em andamento na frente, pausado e concluído no fim. Dentro de cada grupo,
    // prioridade e prazo: o que aperta primeiro é o que a pessoa precisa ver.
    return views.sort((a, b) => {
      const rank = (view: ObjectiveView) =>
        view.progress.state === 'concluido' ? 2 : view.progress.state === 'pausado' ? 1 : 0

      const byRank = rank(a) - rank(b)
      if (byRank !== 0) return byRank

      const byPriority = comparePriority(a.progress.objective.priority, b.progress.objective.priority)
      if (byPriority !== 0) return byPriority

      return a.progress.daysLeft - b.progress.daysLeft
    })
  }, [objectiveProgress, plans, habits, tasks, activities, habitLogs, today])
}

export function useObjective(id: string | undefined): ObjectiveView | null {
  const views = useObjectives()
  return useMemo(
    () => views.find((view) => view.progress.objective.id === id) ?? null,
    [views, id],
  )
}
