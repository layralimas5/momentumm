import { useEffect, useMemo, useRef } from 'react'
import { totalMinutes } from '@/domain/entities/activity'
import { countsAsDone } from '@/domain/entities/habit'
import { eventsToRecord, type RecorderInput } from '@/domain/entities/journey-recorder'
import { reachedMilestones, type MilestoneTotals } from '@/domain/entities/milestone'
import { usePlanner } from './use-planner'
import type { DashboardView } from './use-dashboard'

/**
 * Grava os momentos da jornada que o dia de hoje produziu.
 *
 * Roda no dashboard, que é a tela que a pessoa abre todo dia — é ali que o
 * registro acontece sem depender de ela visitar nenhum lugar específico. A
 * decisão de O QUE gravar não mora aqui: mora em `eventsToRecord`, que é pura.
 * Este hook só junta o estado, chama a regra e escreve o que voltou.
 *
 * A escrita é idempotente por (tipo, origem, dia) no banco e filtrada por
 * evento já existente na regra, então rodar de novo não duplica nada. O `ref`
 * evita apenas o trabalho repetido dentro da mesma sessão.
 */
export function useJourneyRecorder(view: DashboardView): void {
  const planner = usePlanner()
  const { today, habitLogs, activities, streak, journeyEvents, objectives } = planner
  // Só a função, não o contexto inteiro: o valor do planner muda a cada
  // escrita, e depender dele faria o efeito reavaliar em toda tecla apertada.
  const { recordJourneyEvent } = planner
  const running = useRef(false)

  const totals = useMemo<MilestoneTotals>(
    () => ({
      habitsDone: habitLogs.filter((log) => countsAsDone(log.status)).length,
      activeDays: new Set(activities.map((activity) => activity.day)).size,
      streakRecord: Math.max(streak.record, streak.current),
      objectivesDone: objectives.filter((objective) => objective.completedAt !== null).length,
      focusMinutes: totalMinutes(activities),
    }),
    [habitLogs, activities, streak, objectives],
  )

  const input = useMemo<RecorderInput>(
    () => ({
      today,
      momentum: { value: view.momentum.value, delta: view.momentum.delta },
      habits: view.habitStates.map((state) => ({
        id: state.habit.id,
        name: state.habit.name,
        axis: state.habit.axis,
        dayPart: state.habit.dayPart,
        done: countsAsDone(state.status),
      })),
      dayComplete: view.dayComplete,
      dayDone: view.dayProgress.done,
      dayTotal: view.dayProgress.total,
      dayItems: view.focus.all.map((item) => ({ label: item.title, done: item.done })),
      focusMinutesToday: view.focusMinutesToday,
      daysAway: view.daysAway,
      objectives: view.objectives.map((objective) => ({
        id: objective.progress.objective.id,
        title: objective.progress.objective.title,
        axis: objective.progress.objective.axis,
        ratio: objective.ratio,
      })),
      milestones: reachedMilestones(totals),
      existing: journeyEvents,
    }),
    [today, view, totals, journeyEvents],
  )

  useEffect(() => {
    if (running.current) return

    const pending = eventsToRecord(input)
    if (pending.length === 0) return

    running.current = true
    void (async () => {
      try {
        // Em série de propósito: cada gravação atualiza a lista de eventos do
        // estado, e disparar tudo junto faria a deduplicação da rodada seguinte
        // ler uma lista desatualizada.
        for (const event of pending) {
          await recordJourneyEvent(event)
        }
      } finally {
        running.current = false
      }
    })()
  }, [input, recordJourneyEvent])
}
