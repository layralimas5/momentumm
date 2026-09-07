import type { Activity } from './activity'
import type { CapacityProfile, CheckIn } from './checkin'
import { averageEnergy } from './checkin'
import { addDays, type DayKey } from './day'
import {
  countsAsDone,
  isScheduledOn,
  scheduledCountBetween,
  type Habit,
  type HabitLog,
} from './habit'
import type { MomentumScore } from './momentum'
import { MOMENTUM_WINDOW_DAYS } from './momentum'
import type { Streak } from './streak'
import type { Forecast } from './forecast'
import type { PlanProgress } from './plan-progress'
import { inboxTasks, isPending, tasksOfDay, type Task } from './task'

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
  /** Abre o objetivo travado, já no ponto em que ele parou. */
  'abrir-objetivo',
  /** Leva pro plano, onde o prazo e o tamanho da semana se resolvem. */
  'abrir-plano',
  /** Começa a próxima ação recomendada no cronômetro. */
  'comecar-acao',
  'nenhuma',
] as const
export type InsightAction = (typeof INSIGHT_ACTIONS)[number]

/**
 * O que o insight está apontando. Sem isso o botão de aplicar teria que
 * adivinhar qual objetivo, qual etapa ou qual ação a frase estava falando — e
 * um insight que fala de uma coisa e leva pra outra é pior que insight nenhum.
 */
export interface InsightFocus {
  readonly objectiveId?: string
  readonly stageId?: string
  readonly taskId?: string
}

export interface Insight {
  /** Estável por regra: é o que permite lembrar que a pessoa já dispensou esse. */
  readonly id: string
  readonly title: string
  /** O dado que gerou o insight. */
  readonly reason: string
  readonly recommendation: string
  readonly action: InsightAction
  readonly actionLabel: string
  readonly focus?: InsightFocus
}

/** Um objetivo com o plano dele e a previsão já calculados. */
export interface ObjectiveInsightInput {
  readonly plan: PlanProgress
  readonly forecast: Forecast
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
  /**
   * Os objetivos com plano e previsão. Opcional pra não obrigar toda chamada a
   * montar a hierarquia inteira: sem eles as regras de etapa simplesmente não
   * disparam, em vez de disparar com dado pela metade.
   */
  readonly objectives?: readonly ObjectiveInsightInput[]
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

// ---------------------------------------------------------------------------
// Regras da hierarquia
//
// Todas seguem a mesma disciplina das antigas: uma contagem real, o motivo em
// números, UMA recomendação e um destino. O que muda é o alcance — elas leem
// etapa, peso e previsão, e por isso conseguem responder "o que está travando"
// em vez de só descrever o dia.
// ---------------------------------------------------------------------------

/** Etapa concentrando atraso: o gargalo do objetivo, com nome e contagem. */
const stageBottleneck: Rule = (input) => {
  const candidates = (input.objectives ?? [])
    .filter((item) => item.plan.bottleneck !== null && item.plan.bottleneck.overdueTasks.length >= 2)
    .sort(
      (a, b) =>
        (b.plan.bottleneck?.overdueTasks.length ?? 0) -
        (a.plan.bottleneck?.overdueTasks.length ?? 0),
    )

  const found = candidates[0]
  const stage = found?.plan.bottleneck
  if (!found || !stage) return null

  const late = stage.overdueTasks.length
  const objective = found.plan.objective

  return {
    id: `etapa-travada-${stage.stage.id}`,
    title: `A etapa ${stage.stage.title} está segurando ${objective.title}`,
    reason: `Ela concentra ${late} ${late === 1 ? 'ação atrasada' : 'ações atrasadas'} e vale ${stage.stage.weight}% do objetivo. Enquanto ela não anda, o objetivo não anda.`,
    recommendation: stage.nextTask
      ? `Resolve “${stage.nextTask.title}” antes de abrir qualquer frente nova. Se a etapa cresceu demais, remarcar as datas é melhor que arrastar o atraso.`
      : 'Reveja as datas dessa etapa. Atraso arrastado por semanas costuma ser plano grande demais, não falta de esforço.',
    action: 'abrir-objetivo',
    actionLabel: 'Abrir a etapa',
    focus: { objectiveId: objective.id, stageId: stage.stage.id },
  }
}

/** Dias de atraso a partir dos quais a previsão vira assunto. */
const LATE_FORECAST_DAYS = 3

/** O ritmo atual contra o prazo declarado. É a conta que ninguém faz sozinho. */
const paceBehindDeadline: Rule = (input) => {
  const late = (input.objectives ?? [])
    .filter(
      (item) => item.forecast.kind === 'estimado' && item.forecast.daysLate >= LATE_FORECAST_DAYS,
    )
    .sort((a, b) => b.forecast.daysLate - a.forecast.daysLate)[0]

  if (!late) return null

  const objective = late.plan.objective

  return {
    id: `ritmo-fora-do-prazo-${objective.id}`,
    title: `No ritmo atual, ${objective.title} fecha depois do prazo`,
    reason: late.forecast.message,
    recommendation:
      'Duas saídas honestas: tirar peso do plano ou mover o prazo. Insistir no mesmo ritmo e na mesma data é a terceira, e é a que termina em abandono.',
    action: 'abrir-objetivo',
    actionLabel: 'Rever o plano',
    focus: { objectiveId: objective.id },
  }
}

/** Uma ação obrigatória entre a pessoa e a etapa seguinte. */
const unlockNextStage: Rule = (input) => {
  const found = (input.objectives ?? []).find(
    (item) =>
      item.plan.currentStage !== null &&
      item.plan.currentStage.requiredLeft === 1 &&
      item.plan.currentStage.nextTask !== null,
  )

  const stage = found?.plan.currentStage
  const task = stage?.nextTask
  if (!found || !stage || !task) return null

  const next = found.plan.stages.find(
    (item) => item.stage.order > stage.stage.order && item.stage.status !== 'concluida',
  )

  return {
    id: `destrava-etapa-${stage.stage.id}`,
    title: `“${task.title}” é a próxima ação que importa`,
    reason: `É a última ação obrigatória da etapa ${stage.stage.title}${next ? `, que abre a ${next.stage.title}` : ''}. A etapa está em ${Math.round(stage.ratio * 100)}%.`,
    recommendation: 'Fecha essa e a etapa inteira sai do caminho. É o melhor uso do dia de hoje.',
    action: 'comecar-acao',
    actionLabel: 'Começar agora',
    focus: {
      objectiveId: found.plan.objective.id,
      stageId: stage.stage.id,
      taskId: task.id,
    },
  }
}

/** Semanas olhadas pra estimar quanto a pessoa realmente entrega. */
const CAPACITY_WEEKS = 3
/** Diferença a partir da qual o plano da semana virou lista de desejos. */
const OVERPLAN_FACTOR = 1.6

/** Planejou muito mais do que a média que ela entrega. */
const weekBiggerThanCapacity: Rule = (input) => {
  const weekEnd = addDays(input.today, 6)
  const planned = input.tasks.filter(
    (task) => task.day >= input.today && task.day <= weekEnd && isPending(task),
  ).length

  if (planned < 6) return null

  const from = addDays(input.today, -(CAPACITY_WEEKS * 7))
  const done = input.tasks.filter(
    (task) => task.status === 'feita' && task.day >= from && task.day < input.today,
  ).length

  const average = Math.round(done / CAPACITY_WEEKS)
  if (average === 0 || planned < average * OVERPLAN_FACTOR) return null

  return {
    id: 'semana-maior-que-a-capacidade',
    title: 'Essa semana está maior do que as que você entrega',
    reason: `Você planejou ${planned} ações pros próximos 7 dias, e tua média das últimas ${CAPACITY_WEEKS} semanas é ${average}.`,
    recommendation: `Deixa perto de ${average} e empurra o resto. Semana que não fecha vira dívida, e dívida de plano é o que faz largar o objetivo.`,
    action: 'abrir-plano',
    actionLabel: 'Enxugar a semana',
  }
}

/** Queda de consistência a partir da qual vale avisar, em pontos percentuais. */
const CONSISTENCY_DROP = 0.25

/** A constância caiu de uma semana pra outra — e o número diz o quanto. */
const consistencyDrop: Rule = (input) => {
  const running = input.habits.filter((habit) => habit.archivedAt === null)
  if (running.length === 0) return null

  const rateOf = (from: DayKey, to: DayKey) => {
    const scheduled = running.reduce(
      (total, habit) => total + scheduledCountBetween(habit, from, to),
      0,
    )
    if (scheduled === 0) return null
    const done = input.habitLogs.filter(
      (log) => log.day >= from && log.day <= to && countsAsDone(log.status),
    ).length
    return Math.min(1, done / scheduled)
  }

  const current = rateOf(addDays(input.today, -6), input.today)
  const previous = rateOf(addDays(input.today, -13), addDays(input.today, -7))

  if (current === null || previous === null) return null
  if (previous < 0.5 || previous - current < CONSISTENCY_DROP) return null

  return {
    id: 'queda-de-consistencia',
    title: 'Tua constância caiu de uma semana pra outra',
    reason: `Os hábitos saíram em ${Math.round(previous * 100)}% das vezes esperadas na semana passada e ${Math.round(current * 100)}% nesta.`,
    recommendation:
      'Escolhe UM hábito pra proteger nos próximos dias e roda ele na versão mínima. Recuperar dois ao mesmo tempo costuma terminar com nenhum.',
    action: 'usar-versao-minima',
    actionLabel: 'Rodar no mínimo',
  }
}

/** Mínimo de dias de cada lado pra a comparação não ser anedota. */
const CORRELATION_MIN_DAYS = 3

/**
 * O hábito que puxa a execução. É o insight que muda a rotina de verdade:
 * mostra que o dia rende mais quando um comportamento específico acontece.
 */
const habitDrivesExecution: Rule = (input) => {
  const start = addDays(input.today, -20)
  const days = countDays(start, input.today)

  for (const habit of input.habits.filter((item) => item.archivedAt === null)) {
    const doneDays = new Set(
      input.habitLogs
        .filter((log) => log.habitId === habit.id && countsAsDone(log.status))
        .map((log) => log.day),
    )

    const withHabit = days.filter((day) => doneDays.has(day))
    const withoutHabit = days.filter((day) => !doneDays.has(day) && isScheduledOn(habit, day))

    if (withHabit.length < CORRELATION_MIN_DAYS || withoutHabit.length < CORRELATION_MIN_DAYS) {
      continue
    }

    const tasksOn = (list: readonly DayKey[]) => {
      const total = list.reduce(
        (sum, day) =>
          sum + input.tasks.filter((task) => task.day === day && task.status === 'feita').length,
        0,
      )
      return total / list.length
    }

    const on = tasksOn(withHabit)
    const off = tasksOn(withoutHabit)
    if (on < 1 || on < off * 1.5) continue

    return {
      id: `habito-puxa-execucao-${habit.id}`,
      title: `Você entrega mais nos dias em que faz “${habit.name}”`,
      reason: `Nesses dias você concluiu ${on.toFixed(1)} ações em média, contra ${off.toFixed(1)} nos dias em que ele não saiu.`,
      recommendation: `Trata esse hábito como parte da execução, não como extra: colocar ele antes da tua ação principal tende a puxar o resto do dia.`,
      action: 'nenhuma',
      actionLabel: '',
    }
  }

  return null
}

/** Ações capturadas sem destino a partir das quais a caixa vira bagunça. */
const INBOX_THRESHOLD = 3

/** A caixa de entrada cobrando destino. Ação sem objetivo não move progresso. */
const inboxWaiting: Rule = (input) => {
  const inbox = inboxTasks(input.tasks)
  if (inbox.length < INBOX_THRESHOLD) return null

  return {
    id: 'caixa-de-entrada-cheia',
    title: `${inbox.length} ações esperando um destino`,
    reason:
      'Elas foram anotadas sem objetivo, então não contam pra nenhum progresso e não aparecem em nenhuma etapa.',
    recommendation:
      'Dá um objetivo a cada uma ou descarta. Ação que não empurra nada só ocupa espaço na cabeça.',
    action: 'abrir-plano',
    actionLabel: 'Organizar a caixa',
  }
}

/** Dias parados que caracterizam uma pausa de verdade. */
const PAUSE_DAYS = 5
/** Dias seguidos de volta que caracterizam retomada, não um dia solto. */
const RESUME_DAYS = 3

/**
 * A retomada reconhecida.
 *
 * É o único insight que não pede nada — e é de propósito. Quem voltou depois de
 * uma semana parada não precisa de mais uma tarefa: precisa ver que o app
 * percebeu, senão a única leitura disponível na tela é a do que foi perdido.
 */
const resumedAfterPause: Rule = (input) => {
  const moved = new Set<DayKey>()
  for (const activity of input.activities) moved.add(activity.day)
  for (const log of input.habitLogs) if (countsAsDone(log.status)) moved.add(log.day)
  for (const task of input.tasks) if (task.status === 'feita') moved.add(task.day)

  const recent = countDays(addDays(input.today, -(RESUME_DAYS - 1)), input.today)
  if (!recent.every((day) => moved.has(day))) return null

  const before = countDays(
    addDays(input.today, -(RESUME_DAYS + PAUSE_DAYS - 1)),
    addDays(input.today, -RESUME_DAYS),
  )
  if (before.some((day) => moved.has(day))) return null

  return {
    id: 'retomada-reconhecida',
    title: `Você voltou: ${RESUME_DAYS} dias seguidos depois de uma semana parada`,
    reason: `Nos ${PAUSE_DAYS} dias anteriores não houve nenhum registro, e nos últimos ${RESUME_DAYS} houve em todos.`,
    recommendation:
      'Não tenta compensar o que ficou pra trás. Mantém o mesmo tamanho de hoje por mais alguns dias: é assim que a volta vira rotina de novo.',
    action: 'nenhuma',
    actionLabel: '',
  }
}

/**
 * Ordem = prioridade. O primeiro que casar é o que aparece.
 *
 * A hierarquia vem antes do dia de propósito: uma etapa travando o objetivo é
 * uma informação maior que "hoje tem ação demais", e mostrar a segunda
 * escondendo a primeira é o que faz a pessoa executar sem chegar a lugar nenhum.
 */
const RULES: readonly Rule[] = [
  streakAtRisk,
  stageBottleneck,
  paceBehindDeadline,
  overloadedDay,
  weekBiggerThanCapacity,
  lowEnergyPattern,
  consistencyDrop,
  unlockNextStage,
  habitsHoldTasksSlip,
  habitDrivesExecution,
  inboxWaiting,
  resumedAfterPause,
  noActionToday,
  morningBeatsEvening,
]
