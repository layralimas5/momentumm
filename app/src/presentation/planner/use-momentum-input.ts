import { useMemo } from 'react'
import { addDays, dayKeyOf, type DayKey } from '@/domain/entities/day'
import { MOMENTUM_HORIZON_DAYS, type MomentumInput } from '@/domain/entities/momentum'
import { planRatioAt } from '@/domain/entities/plan-progress'
import { useAuth } from '@/presentation/auth/use-auth'
import { useObjectives } from './use-objectives'
import { usePlanner } from './use-planner'

/**
 * A ENTRADA do Momentum, montada num lugar só.
 *
 * Existia uma cópia dessa montagem no dashboard e outra no progresso, e elas
 * não eram iguais: só o dashboard somava o avanço do plano. O resultado era
 * o mesmo score aparecendo com dois valores em duas telas vizinhas — e um
 * número que discorda de si mesmo deixa de servir pra decidir qualquer coisa,
 * que é a única razão de ele existir.
 *
 * Aqui não há regra de pontuação: `calculateMomentum` continua sendo a única
 * fórmula. O que este arquivo garante é que ela recebe sempre os mesmos dados
 * — no dashboard, no progresso, no perfil, na review e na Momentumm AI.
 */
export function useMomentumInput(): MomentumInput {
  const planner = usePlanner()
  const objectives = useObjectives()
  const { profile } = useAuth()

  const { activities, habits, habitLogs, tasks, today, weeklyReviews } = planner
  const restWeekdays = profile?.restWeekdays

  /**
   * O avanço de plano na janela do score, somado entre os objetivos, pra
   * QUALQUER dia de término.
   *
   * É o que faz fechar uma etapa mexer no ritmo. Sem ele o momentum enxerga
   * só hábito e ação solta, e uma semana inteira empurrando um objetivo pesado
   * aparece como semana parada. A função recebe o dia porque o histórico e a
   * suavização precisam do avanço real de cada dia, não do de hoje repetido
   * pra trás.
   */
  const planGainAt = useMemo<MomentumInput['planGainAt']>(() => {
    const running = objectives.filter((view) => view.plan.hasPlan)
    // Undefined, não uma função que devolve zero: sem plano nenhum o fator
    // fica neutro no momentum em vez de valer zero.
    if (running.length === 0) return undefined

    // A janela é a do score (28 dias), não a semana: medir o avanço numa
    // janela e pontuá-lo em outra faria o fator de objetivos discordar do
    // período que o próprio detalhamento diz estar olhando.
    return (end: DayKey) => {
      const start = addDays(end, -(MOMENTUM_HORIZON_DAYS - 1))
      const total = running.reduce(
        (sum, view) =>
          sum +
          (planRatioAt(view.plan.stages, end, dayKeyOf) -
            planRatioAt(view.plan.stages, start, dayKeyOf)),
        0,
      )
      return Math.max(0, total / running.length)
    }
  }, [objectives])

  return useMemo(
    () => ({
      activities,
      habits,
      habitLogs,
      tasks,
      today,
      weeklyReviews,
      restWeekdays,
      planGainAt,
    }),
    [activities, habits, habitLogs, tasks, today, weeklyReviews, restWeekdays, planGainAt],
  )
}
