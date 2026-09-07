import { useMemo } from 'react'
import { DAY_PARTS, countsAsDone, type DayPart } from '@/domain/entities/habit'
import type { JourneyEvent, JourneyItem } from '@/domain/entities/journey-event'
import {
  comebackEvent,
  dayCompletedEvent,
  momentumEvent,
  routineCompletedEvent,
  routineTitle,
} from '@/domain/share/journey-event-builders'
import { useAuth } from '@/presentation/auth/use-auth'
import type { DashboardView } from '@/presentation/planner/use-dashboard'
import { usePlanner } from '@/presentation/planner/use-planner'

/**
 * Os momentos que o dia de hoje oferece pra compartilhar.
 *
 * A tela não monta evento: ela pergunta "o que dá pra compartilhar agora" e
 * recebe uma lista pronta. É o que mantém o dashboard sem saber o que é
 * `JourneyEvent`, e o que garante que o card do celular e o do desktop nasçam
 * do mesmo lugar.
 *
 * Os builders devolvem funções, não eventos: o dashboard renderiza a cada
 * toque em hábito, e construir quatro eventos por render pra usar nenhum seria
 * trabalho jogado fora.
 */

export interface ShareMoment {
  readonly id: string
  readonly label: string
  build(): JourneyEvent
}

/** Dias parados a partir dos quais voltar é uma retomada, não um dia comum. */
const GAP_FOR_COMEBACK = 2

export function useShareMoments(view: DashboardView): readonly ShareMoment[] {
  const { user } = useAuth()
  const planner = usePlanner()
  const { today, streak } = planner

  return useMemo(() => {
    if (!user) return []

    const userId = user.id
    const moments: ShareMoment[] = []

    const dayItems: readonly JourneyItem[] = view.focus.all.map((item) => ({
      label: item.title,
      done: item.done,
    }))

    // O dia só vira card depois que alguma coisa saiu. "0% concluído" às oito
    // da manhã não é um momento, é uma cobrança.
    if (view.dayProgress.done > 0) {
      moments.push({
        id: 'dia',
        label: 'Compartilhar meu dia',
        build: () =>
          dayCompletedEvent({
            userId,
            today,
            done: view.dayProgress.done,
            total: view.dayProgress.total,
            items: dayItems,
            focusMinutes: view.focusMinutesToday,
            momentum: view.momentum,
          }),
      })
    }

    /*
      A rotina do app é o BLOCO do dia: os hábitos da manhã, os da noite. Não
      existe entidade "rotina" e criar uma só pra isso seria inventar um módulo
      novo — exatamente o que a arquitetura do Momentumm recusa. O bloco só
      vira card quando tem mais de um hábito e todos saíram: "1/1 concluída"
      não é rotina cumprida, é hábito cumprido.
    */
    for (const dayPart of DAY_PARTS) {
      const states = view.habitStates.filter((state) => state.habit.dayPart === dayPart)
      if (states.length < 2 || !states.every((state) => countsAsDone(state.status))) continue

      const items = states.map((state) => ({ label: state.habit.name, done: true }))
      moments.push({
        id: `rotina:${dayPart}`,
        label: labelForRoutine(dayPart),
        build: () =>
          routineCompletedEvent({
            userId,
            today,
            dayPart,
            items,
            focusMinutes: view.focusMinutesToday,
            momentum: view.momentum,
          }),
      })
    }

    const daysAway = view.daysAway
    if (daysAway >= GAP_FOR_COMEBACK && view.dayProgress.done > 0) {
      moments.push({
        id: 'retomada',
        label: 'Compartilhar retomada',
        build: () => comebackEvent({ userId, today, daysAway, momentum: view.momentum }),
      })
    }

    if (view.hasHistory) {
      moments.push({
        id: 'momentum',
        label: 'Compartilhar Momentum',
        build: () =>
          momentumEvent({ userId, today, momentum: view.momentum, streakDays: streak.current }),
      })
    }

    return moments
  }, [user, today, streak.current, view])
}

function labelForRoutine(dayPart: DayPart): string {
  return dayPart === 'qualquer'
    ? 'Compartilhar rotina'
    : `Compartilhar ${routineTitle(dayPart).toLowerCase()}`
}
