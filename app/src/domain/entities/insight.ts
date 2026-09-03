import type { Activity } from './activity'
import type { CapacityProfile, CheckIn } from './checkin'
import { averageEnergy } from './checkin'
import { addDays, type DayKey } from './day'
import { countsAsDone, isScheduledOn, type Habit, type HabitLog } from './habit'
import type { MomentumScore } from './momentum'
import { MOMENTUM_WINDOW_DAYS } from './momentum'
import type { Streak } from './streak'
import { isPending, tasksOfDay, type Task } from './task'

/**
 * Insight: o que o ritmo da pessoa está mostrando.
 *
 * Regra dura: nada de frase motivacional genérica. Todo insight aqui nasce de
 * uma contagem real, diz o MOTIVO, entrega UMA recomendação e carrega uma ação
 * que o app sabe aplicar sozinho. Se a regra não encontra padrão, não inventa
 * um — devolve nada e o card some.
 */

export const INSIGHT_ACTIONS = [
  'reduzir-acoes-do-dia',
  'usar-versao-minima',
  'proteger-sequencia',
  'concentrar-na-manha',
  'criar-primeira-acao',
  'nenhuma',
] as const
export type InsightAction = (typeof INSIGHT_ACTIONS)[number]

export interface Insight {
  /** Estável por regra: é o que permite lembrar que a pessoa já dispensou esse. */
  readonly id: string
  readonly title: string
  /** O dado que gerou o insight. */
  readonly reason: string
  readonly recommendation: string
  readonly action: InsightAction
  readonly actionLabel: string
}

export interface InsightInput {
  readonly activities: readonly Activity[]
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
  readonly tasks: readonly Task[]
  readonly checkIns: readonly CheckIn[]
  readonly streak: Streak
  readonly momentum: MomentumScore
  readonly capacity: CapacityProfile
  readonly today: DayKey
}

type Rule = (input: InsightInput) => Insight | null

const OVERLOAD_THRESHOLD = 4
const EVENING_HOUR = 18
const MORNING_END_HOUR = 12

/**
 * Sobrecarga do dia: mais ações planejadas do que a capacidade de hoje comporta.
 * É o padrão que mais derruba meta — a pessoa não desiste por preguiça, desiste
 * por ter marcado seis coisas num dia de três.
 */
const overloadedDay: Rule = (input) => {
  const planned = tasksOfDay(input.tasks, input.today).filter(isPending)
  if (planned.length <= Math.max(OVERLOAD_THRESHOLD, input.capacity.suggestedActions)) return null

  const goals = new Set(planned.map((task) => task.goalId).filter(Boolean))
  const goalNote = goals.size > 1 ? ` distribuídas em ${goals.size} metas diferentes` : ''

  return {
    id: 'sobrecarga-do-dia',
    title: 'Você está montando um dia maior do que ele cabe',
    reason: `Hoje tem ${planned.length} ações pendentes${goalNote}, e a tua capacidade de hoje comporta ${input.capacity.suggestedActions}.`,
    recommendation: `Mantém ${input.capacity.suggestedActions === 1 ? 'uma ação' : `${input.capacity.suggestedActions} ações`} e empurra o resto pra amanhã. Dia cheio demais costuma terminar em zero.`,
    action: 'reduzir-acoes-do-dia',
    actionLabel: 'Enxugar o dia',
  }
}

/**
 * Hábito sustenta, meta trava: o padrão clássico de quem mantém o simples e
 * abandona o que exige decisão.
 */
const habitsHoldTasksSlip: Rule = (input) => {
  const start = addDays(input.today, -(MOMENTUM_WINDOW_DAYS - 1))
  const within = (day: DayKey) => day >= start && day <= input.today

  const scheduled = input.habits.reduce(
    (total, habit) =>
      total +
      countDays(start, input.today).filter((day) => isScheduledOn(habit, day)).length,
    0,
  )
  if (scheduled < 5) return null

  const habitsDone = input.habitLogs.filter(
    (log) => within(log.day) && countsAsDone(log.status),
  ).length
  const habitRatio = habitsDone / scheduled

  const weekTasks = input.tasks.filter((task) => within(task.day))
  if (weekTasks.length < 3) return null

  const taskRatio = weekTasks.filter((task) => task.status === 'feita').length / weekTasks.length

  if (habitRatio < 0.6 || taskRatio > 0.4) return null

  return {
    id: 'habito-sustenta-meta-trava',
    title: 'Teus hábitos seguram, tuas metas escorregam',
    reason: `Nos últimos ${MOMENTUM_WINDOW_DAYS} dias você cumpriu ${Math.round(habitRatio * 100)}% dos hábitos e concluiu só ${Math.round(taskRatio * 100)}% das ações planejadas.`,
    recommendation:
      'Nesta semana, limita cada meta a uma ação principal por dia. O que funciona no hábito é o tamanho, não a força de vontade.',
    action: 'reduzir-acoes-do-dia',
    actionLabel: 'Aplicar uma ação por meta',
  }
}

/** Energia baixa recorrente com plano cheio: o convite à versão mínima. */
const lowEnergyPattern: Rule = (input) => {
  const start = addDays(input.today, -(MOMENTUM_WINDOW_DAYS - 1))
  const recent = input.checkIns.filter((item) => item.day >= start && item.day <= input.today)
  if (recent.length < 3) return null

  const average = averageEnergy(recent)
  if (average === null || average > 2.6) return null

  const pending = tasksOfDay(input.tasks, input.today).filter(isPending)
  const withMinimal = pending.filter((task) => task.minimalVersion).length
  if (pending.length === 0) return null

  return {
    id: 'energia-baixa-recorrente',
    title: 'Sua energia está baixa há vários dias seguidos',
    reason: `A média dos teus últimos ${recent.length} check-ins é ${average} de 5.`,
    recommendation:
      withMinimal > 0
        ? 'Roda o dia na versão mínima até a energia voltar. Sequência preservada vale mais que plano cumprido pela metade.'
        : 'Define uma versão mínima pras tuas ações. Num dia assim, ter um plano B evita o abandono.',
    action: withMinimal > 0 ? 'usar-versao-minima' : 'nenhuma',
    actionLabel: 'Rodar o dia no mínimo',
  }
}

/** Sequência viva e em risco: o aviso que muda o dia com um registro só. */
const streakAtRisk: Rule = (input) => {
  if (!input.streak.atRisk || input.streak.current < 3) return null

  return {
    id: 'sequencia-em-risco',
    title: `Tua sequência de ${input.streak.current} dias depende de hoje`,
    reason: `Teu último registro foi ontem e ainda não há nada hoje. O recorde atual é de ${input.streak.record} dias.`,
    recommendation:
      'Registra a menor coisa possível agora. Não precisa ser o plano inteiro, precisa ser hoje.',
    action: 'proteger-sequencia',
    actionLabel: 'Proteger a sequência',
  }
}

/** Manhã rende, noite adia: informação que reorganiza a semana inteira. */
const morningBeatsEvening: Rule = (input) => {
  const start = addDays(input.today, -(MOMENTUM_WINDOW_DAYS - 1))
  const week = input.activities.filter(
    (activity) => activity.day >= start && activity.day <= input.today,
  )
  if (week.length < 5) return null

  const morning = week.filter((activity) => activity.occurredAt.getHours() < MORNING_END_HOUR).length
  const evening = week.filter((activity) => activity.occurredAt.getHours() >= EVENING_HOUR).length
  if (morning < evening * 2 || morning < 4) return null

  const lateTasks = input.tasks.filter(
    (task) => task.day >= start && task.day <= input.today && task.status === 'adiada',
  ).length

  return {
    id: 'manha-rende-mais',
    title: 'Teu dia rende de manhã',
    reason: `${morning} dos teus registros da semana aconteceram antes do meio-dia, contra ${evening} depois das ${EVENING_HOUR}h${lateTasks > 0 ? `, e ${lateTasks} ações planejadas pra noite foram adiadas` : ''}.`,
    recommendation:
      'Coloca a prioridade principal na primeira metade do dia e deixa depois das 18h só o que é leve.',
    action: 'concentrar-na-manha',
    actionLabel: 'Priorizar de manhã',
  }
}

/** Dia sem nenhuma ação: o dashboard não pode ficar sem próxima ação clara. */
const noActionToday: Rule = (input) => {
  if (tasksOfDay(input.tasks, input.today).length > 0) return null
  if (input.tasks.length === 0 && input.habits.length === 0) return null

  return {
    id: 'dia-sem-acao',
    title: 'Hoje ainda não tem nenhuma ação definida',
    reason: 'Sem uma ação escolhida, o dia inteiro vira decisão — e decidir cansa mais que executar.',
    recommendation: 'Escolhe uma ação só pra hoje. Pode ser pequena; ela existe pra tirar você da inércia.',
    action: 'criar-primeira-acao',
    actionLabel: 'Definir a ação de hoje',
  }
}

/** Ordem = prioridade. O primeiro que casar é o que aparece. */
const RULES: readonly Rule[] = [
  streakAtRisk,
  overloadedDay,
  lowEnergyPattern,
  habitsHoldTasksSlip,
  noActionToday,
  morningBeatsEvening,
]

export function generateInsights(input: InsightInput): Insight[] {
  return RULES.map((rule) => rule(input)).filter((insight): insight is Insight => insight !== null)
}

/**
 * O insight mostrado agora. Um por vez: uma lista de insights vira ruído e
 * ninguém aplica nenhum.
 */
export function primaryInsight(
  input: InsightInput,
  dismissedIds: ReadonlySet<string>,
): Insight | null {
  return generateInsights(input).find((insight) => !dismissedIds.has(insight.id)) ?? null
}

function countDays(from: DayKey, to: DayKey): DayKey[] {
  const days: DayKey[] = []
  let cursor = from
  while (cursor <= to) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}
