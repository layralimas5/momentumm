import type { Activity } from './activity'
import { totalMinutes } from './activity'
import type { CheckIn } from './checkin'
import type { DayKey } from './day'
import { countsAsDone, habitsScheduledOn, statusOf, type Habit, type HabitLog } from './habit'
import { isDone, isPending, type Task } from './task'
import type { Win } from './win'

/**
 * Um dia, inteiro.
 *
 * O app sabia responder "como está hoje" e "como foi a semana", e não sabia
 * responder "o que foi que eu fiz na terça". A faixa da semana mostrava sete
 * pontos: aceso ou apagado, sem jeito de perguntar o que havia atrás do ponto.
 *
 * Esta função é essa resposta, e ela é PURA de propósito, recebe as coleções e
 * devolve o retrato. A mesma conta serve pro dia de hoje e pra qualquer dia que
 * já passou, e é isso que impede a tela do passado de discordar da tela de
 * hoje: um hábito cumprido conta igual nas duas.
 */

export interface DayHabitLine {
  readonly id: string
  readonly name: string
  readonly done: boolean
}

export interface DaySummary {
  readonly day: DayKey
  readonly activities: readonly Activity[]
  /** Minutos registrados no dia, de qualquer origem. */
  readonly focusMinutes: number
  readonly habits: readonly DayHabitLine[]
  readonly habitsDone: number
  readonly tasksDone: readonly Task[]
  /** As que ficaram em aberto naquele dia. Em dia passado, é o que não saiu. */
  readonly tasksOpen: readonly Task[]
  readonly checkIn: CheckIn | null
  readonly win: Win | null
  /**
   * Houve movimento? É a mesma pergunta que acende o ponto na faixa da semana,
   * respondida pela mesma regra: atividade, hábito ou ação concluída.
   */
  readonly moved: boolean
  /** Nada registrado, nada planejado, nada respondido. */
  readonly empty: boolean
}

export interface DaySummaryInput {
  readonly activities: readonly Activity[]
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
  readonly tasks: readonly Task[]
  readonly checkIns: readonly CheckIn[]
  readonly wins: readonly Win[]
}

export function summarizeDay(input: DaySummaryInput, day: DayKey): DaySummary {
  const activities = input.activities.filter((activity) => activity.day === day)

  /*
    Os hábitos que estavam AGENDADOS naquele dia, e não todos os que existem
    hoje. Um hábito de segunda não deveria aparecer como "não fiz" num sábado,
    e um hábito criado depois não deveria cobrar um dia em que ele não existia.
  */
  const habits = habitsScheduledOn(input.habits, day).map((habit) => ({
    id: habit.id,
    name: habit.name,
    done: countsAsDone(statusOf(input.habitLogs, habit.id, day)),
  }))

  const ofDay = input.tasks.filter((task) => task.day === day)
  const tasksDone = ofDay.filter(isDone)
  const tasksOpen = ofDay.filter(isPending)

  const habitsDone = habits.filter((habit) => habit.done).length
  const moved = activities.length > 0 || habitsDone > 0 || tasksDone.length > 0

  const checkIn = input.checkIns.find((item) => item.day === day) ?? null
  const win = input.wins.find((item) => item.day === day) ?? null

  return {
    day,
    activities,
    focusMinutes: totalMinutes(activities),
    habits,
    habitsDone,
    tasksDone,
    tasksOpen,
    checkIn,
    win,
    moved,
    empty:
      activities.length === 0 &&
      habits.length === 0 &&
      ofDay.length === 0 &&
      checkIn === null &&
      win === null,
  }
}
