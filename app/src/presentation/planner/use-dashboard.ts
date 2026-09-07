import { useCallback, useMemo, useState } from 'react'
import { totalMinutes } from '@/domain/entities/activity'
import { addDays, dayKeyOf, type DayKey } from '@/domain/entities/day'
import { capacityOf, checkInOfDay, type CapacityProfile, type CheckIn } from '@/domain/entities/checkin'
import { paceOf, type GoalPace, type GoalProgress } from '@/domain/entities/goal'
import {
  countsAsDone,
  habitDayProgress,
  habitDayStates,
  habitTargetLabel,
  type HabitDayProgress,
  type HabitDayState,
} from '@/domain/entities/habit'
import { activityType } from '@/domain/entities/activity-type'
import type { Objective } from '@/domain/entities/objective'
import type { Priority } from '@/domain/entities/priority'
import { isRunning } from '@/domain/entities/objective'
import {
  primaryInsight,
  type Insight,
  type InsightInput,
  type ObjectiveInsightInput,
} from '@/domain/entities/insight'
import { planRatioAt } from '@/domain/entities/plan-progress'
import { MOMENTUM_WINDOW_DAYS } from '@/domain/entities/momentum'
import {
  calculateMomentum,
  recommendationFor,
  type MomentumInput,
  type MomentumScore,
} from '@/domain/entities/momentum'
import { isPending, mainPriorityOf, nextTaskForGoal, supportingTasksOf, type Task } from '@/domain/entities/task'
import { summarizeWeek, type WeeklySummary } from '@/domain/entities/week'
import { winOfDay, type Win } from '@/domain/entities/win'
import { usePlanner } from './use-planner'
import { useObjectives, type ObjectiveView } from './use-objectives'

const DISMISSED_KEY = 'momentumm.insights.dismissed.v1'

/**
 * Quantos itens do dia aparecem no foco.
 *
 * Três é o limite da decisão, não do espaço: a partir do quarto item a pessoa
 * para de escolher e passa a varrer a lista. O que sobra continua acessível em
 * "ver tudo do dia" — o dashboard não esconde trabalho, ele ordena.
 */
export const MAX_FOCUS_ITEMS = 3

export interface GoalInMotion {
  readonly progress: GoalProgress
  readonly pace: GoalPace
  readonly nextTask: Task | null
}

/**
 * Um item do foco de hoje — ação ou hábito, na mesma lista.
 *
 * O dia é vivido misturado: às nove da manhã não existe "aba de hábitos" e
 * "aba de ações", existe o que precisa sair. Duas listas separadas obrigam a
 * pessoa a somar de cabeça pra responder "o que falta hoje", que é a única
 * pergunta que ela tem ao abrir o app.
 *
 * O item NÃO é uma cópia: ele aponta pro registro original (`task` ou
 * `habitState`), e concluir por aqui escreve lá. Não existe segunda lista.
 */
export interface FocusItem {
  readonly kind: 'acao' | 'habito'
  readonly id: string
  readonly title: string
  readonly done: boolean
  /** Duração estimada. Null quando o eixo não é medido em minutos. */
  readonly minutes: number | null
  readonly objective: Objective | undefined
  readonly stageTitle: string | null
  readonly priority: Priority
  /** Rótulo curto do papel: "Prioridade principal", "Hábito". */
  readonly role: string
  readonly task: Task | null
  readonly habitState: HabitDayState | null
}

export interface TodayFocus {
  /** Até três itens: é o que cabe numa decisão. */
  readonly items: readonly FocusItem[]
  /** Tudo do dia, pra tela dizer quantos ficaram de fora. */
  readonly all: readonly FocusItem[]
  readonly done: number
  readonly total: number
  /** Soma estimada dos itens em aberto, em minutos. Null sem nenhuma estimativa. */
  readonly minutes: number | null
}

/** Uma ação com o caminho dela: objetivo, etapa e por que ela importa hoje. */
export interface NextUp {
  readonly task: Task
  readonly view: ObjectiveView
  readonly stageTitle: string | null
  readonly reason: string
}

export interface DayProgress {
  readonly done: number
  readonly total: number
  /** 0 a 1: hábitos e ações do dia somados. */
  readonly ratio: number
}

export interface DashboardView {
  readonly checkIn: CheckIn | null
  /**
   * Os objetivos com plano e previsão. O dia lê daqui pra dizer a que etapa e
   * a que objetivo cada linha pertence — é o que separa uma lista de tarefas
   * de um sistema de progresso.
   */
  readonly objectives: readonly ObjectiveView[]
  /** O foco de hoje: ações e hábitos numa lista só, na ordem da decisão. */
  readonly focus: TodayFocus
  /** A frase de contexto abaixo da saudação. Muda com o estado real do dia. */
  readonly headline: string
  /**
   * Existe semana anterior pra comparar? Sem isso o Momentum mostra o número
   * sem variação, em vez de comparar com o vazio e inflar o primeiro dado que
   * a pessoa vê.
   */
  readonly hasHistory: boolean
  /** Ações em aberto com o dia já vencido. Vira um aviso curto no topo. */
  readonly overdueCount: number
  /** A próxima ação recomendada, com o contexto dela. Null quando não há. */
  readonly nextUp: NextUp | null
  /** Quanto do dia já saiu, contando hábitos e ações juntos. */
  readonly dayProgress: DayProgress
  /**
   * O recado de retomada quando ontem ficou pra trás. Null quando não há nada
   * a retomar — a mensagem só aparece se muda alguma decisão de hoje.
   */
  readonly resumeNote: string | null
  readonly capacity: CapacityProfile
  readonly momentum: MomentumScore
  readonly recommendation: string
  readonly mainPriority: Task | null
  readonly supportingTasks: readonly Task[]
  readonly habitStates: readonly HabitDayState[]
  readonly habitProgress: HabitDayProgress
  readonly week: WeeklySummary
  /**
   * Dias parados imediatamente antes de hoje. Zero quando ontem teve
   * movimento. É o que separa uma retomada de um dia comum, e mora aqui porque
   * o gravador de momentos e o Share Studio precisam da MESMA contagem — duas
   * cópias da regra dariam dois números com o mesmo nome.
   */
  readonly daysAway: number
  readonly goalsInMotion: readonly GoalInMotion[]
  readonly insight: Insight | null
  readonly todayWin: Win | null
  readonly focusMinutesToday: number
  /** Todos os hábitos do dia concluídos: o dashboard muda de tom. */
  readonly dayComplete: boolean
  dismissInsight(id: string): void
}

/**
 * A leitura do dia. Aqui as seções deixam de ser independentes: o check-in
 * define a capacidade, a capacidade calibra a recomendação, hábitos e ações
 * alimentam o momentum, o momentum vira progresso semanal e o conjunto gera o
 * insight. Nenhuma dessas contas mora em componente.
 */
export function useDashboard(): DashboardView {
  const planner = usePlanner()
  const objectives = useObjectives()
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(loadDismissed)

  const {
    today,
    activities,
    todayActivities,
    habits,
    habitLogs,
    tasks,
    checkIns,
    wins,
    goalProgress,
    streak,
  } = planner

  const checkIn = useMemo(() => checkInOfDay(checkIns, today), [checkIns, today])
  const capacity = useMemo(() => capacityOf(checkIn), [checkIn])

  /**
   * O avanço de plano na janela do momentum, somado entre os objetivos.
   *
   * É o que faz fechar uma etapa mexer no ritmo — sem isso o momentum
   * enxergaria só hábito e ação solta, e uma semana de trabalho pesado num
   * objetivo apareceria como semana parada.
   */
  const planGains = useMemo<Pick<MomentumInput, 'planGain' | 'previousPlanGain'>>(() => {
    const running = objectives.filter((view) => view.plan.hasPlan)
    // Objeto vazio, não `undefined` explícito: sem plano nenhum o fator fica
    // neutro no momentum em vez de valer zero.
    if (running.length === 0) return {}

    const gainSince = (end: DayKey) => {
      const start = addDays(end, -(MOMENTUM_WINDOW_DAYS - 1))
      const total = running.reduce(
        (sum, view) =>
          sum +
          (planRatioAt(view.plan.stages, end, dayKeyOf) -
            planRatioAt(view.plan.stages, start, dayKeyOf)),
        0,
      )
      return Math.max(0, total / running.length)
    }

    return {
      planGain: gainSince(today),
      previousPlanGain: gainSince(addDays(today, -MOMENTUM_WINDOW_DAYS)),
    }
  }, [objectives, today])

  const momentumInput = useMemo<MomentumInput>(
    () => ({
      activities,
      habits,
      habitLogs,
      tasks,
      today,
      weeklyReviews: planner.weeklyReviews,
      ...planGains,
    }),
    [activities, habits, habitLogs, tasks, today, planner.weeklyReviews, planGains],
  )

  const momentum = useMemo(() => calculateMomentum(momentumInput), [momentumInput])
  const week = useMemo(() => summarizeWeek(momentumInput), [momentumInput])

  // Lê a série de trás pra frente, pulando o próprio dia: o buraco que
  // interessa é o que veio ANTES de hoje.
  const daysAway = useMemo(() => {
    let gap = 0
    for (let index = week.series.length - 2; index >= 0; index -= 1) {
      const day = week.series[index]
      if (!day || day.intensity > 0) break
      gap += 1
    }
    return gap
  }, [week.series])

  const habitStates = useMemo(
    () => habitDayStates(habits, habitLogs, today),
    [habits, habitLogs, today],
  )
  const habitProgress = useMemo(() => habitDayProgress(habitStates), [habitStates])

  const objectiveOf = useCallback(
    (id: string | null) => planner.objectives.find((item) => item.id === id),
    [planner.objectives],
  )

  const stageTitleOf = useCallback(
    (id: string | null) => planner.planStages.find((item) => item.id === id)?.title ?? null,
    [planner.planStages],
  )

  const mainPriority = useMemo(() => mainPriorityOf(tasks, today), [tasks, today])
  const supportingTasks = useMemo(() => supportingTasksOf(tasks, today), [tasks, today])

  const goalsInMotion = useMemo<GoalInMotion[]>(
    () =>
      goalProgress.map((progress) => ({
        progress,
        pace: paceOf(progress, today),
        nextTask: nextTaskForGoal(tasks, progress.goal.id),
      })),
    [goalProgress, tasks, today],
  )

  const objectiveInput = useMemo<ObjectiveInsightInput[]>(
    () => objectives.map((view) => ({ plan: view.plan, forecast: view.forecast })),
    [objectives],
  )

  const insight = useMemo(() => {
    const input: InsightInput = {
      activities,
      habits,
      habitLogs,
      tasks,
      checkIns,
      streak,
      momentum,
      capacity,
      today,
      objectives: objectiveInput,
    }
    return primaryInsight(input, dismissed)
  }, [
    activities,
    habits,
    habitLogs,
    tasks,
    checkIns,
    streak,
    momentum,
    capacity,
    today,
    objectiveInput,
    dismissed,
  ])

  /**
   * O foco de hoje.
   *
   * A ordem é a da decisão, não a do banco: prioridade principal, depois o que
   * ainda está aberto por prioridade, e por último o que já saiu — o concluído
   * fica pra dar a sensação de avanço, nunca pra ocupar o topo.
   */
  const focus = useMemo<TodayFocus>(() => {
    const dayTasks = tasks.filter(
      (task) => task.day === today && task.status !== 'cancelada',
    )

    const fromTasks: FocusItem[] = dayTasks.map((task) => ({
      kind: 'acao',
      id: task.id,
      title: task.title,
      done: task.status === 'feita',
      minutes: task.estimatedMin,
      objective: objectiveOf(task.objectiveId),
      stageTitle: stageTitleOf(task.stageId),
      priority: task.priority,
      role: task.isMainPriority ? 'Prioridade principal' : 'Ação',
      task,
      habitState: null,
    }))

    const fromHabits: FocusItem[] = habitStates.map((state) => ({
      kind: 'habito',
      id: state.habit.id,
      title: state.habit.name,
      done: countsAsDone(state.status),
      // Eixo medido em páginas não vira minutos por chute: a estimativa fica
      // nula e some da soma, em vez de inventar um tempo que ninguém deu.
      minutes:
        activityType(state.habit.axis).unit === 'minutos' ? state.habit.target : null,
      objective: objectiveOf(state.habit.objectiveId),
      stageTitle: stageTitleOf(state.habit.stageId),
      priority: state.habit.priority,
      role: `Hábito · ${habitTargetLabel(state.habit)}`,
      task: null,
      habitState: state,
    }))

    const rank = (item: FocusItem) => {
      if (item.done) return 3
      if (item.role === 'Prioridade principal') return 0
      return item.priority === 'alta' ? 1 : 2
    }

    const all = [...fromTasks, ...fromHabits].sort((a, b) => rank(a) - rank(b))
    const items = all.slice(0, MAX_FOCUS_ITEMS)

    const open = items.filter((item) => !item.done)
    const estimated = open.reduce((sum, item) => sum + (item.minutes ?? 0), 0)

    return {
      items,
      all,
      done: all.filter((item) => item.done).length,
      total: all.length,
      minutes: open.some((item) => item.minutes !== null) ? estimated : null,
    }
  }, [tasks, today, habitStates, objectiveOf, stageTitleOf])

  /**
   * A próxima ação, com o motivo dela.
   *
   * A prioridade principal vem primeiro por ser uma escolha explícita da
   * pessoa. Sem ela, o app propõe a próxima ação do objetivo mais apertado —
   * e diz por quê, porque uma sugestão sem motivo é indistinguível de um chute.
   */
  const nextUp = useMemo<NextUp | null>(() => {
    /*
      A ação que a pessoa já escolheu pra hoje sai da disputa.

      Repetir a prioridade principal aqui não acrescenta nada — ela já é o
      maior elemento da tela. O valor deste bloco é justamente mostrar o que o
      plano está pedindo QUANDO isso não é o que ela escolheu fazer.

      Objetivo pausado também sai: pausar é dizer "para de me cobrar", e um
      card sugerindo a próxima ação dele seria exatamente a cobrança.
    */
    const candidates = objectives.filter(
      (view) =>
        view.plan.nextTask !== null &&
        view.plan.nextTask.id !== mainPriority?.id &&
        isRunning(view.progress.objective),
    )
    if (candidates.length === 0) return null

    // Gargalo primeiro; sem gargalo, o prazo mais apertado. É a ordem que
    // responde "o que trava" antes de "o que vence".
    const chosen =
      candidates.find((view) => view.plan.bottleneck !== null) ??
      [...candidates].sort((a, b) => a.progress.daysLeft - b.progress.daysLeft)[0]

    const task = chosen?.plan.nextTask
    if (!chosen || !task) return null

    const stage =
      chosen.plan.stages.find((item) => item.stage.id === task.stageId)?.stage ?? null

    const reason =
      chosen.plan.bottleneck?.stage.id === stage?.id && stage
        ? `Destrava a etapa ${stage.title}, que está segurando o objetivo.`
        : stage
          ? `Próximo passo da etapa ${stage.title}.`
          : 'Próxima ação em aberto desse objetivo.'

    return { task, view: chosen, stageTitle: stage?.title ?? null, reason }
  }, [objectives, mainPriority])

  const dismissInsight = useCallback((id: string) => {
    setDismissed((current) => {
      const next = new Set(current)
      next.add(id)
      persistDismissed(next)
      return next
    })
  }, [])

  const pendingToday = tasks.filter((task) => task.day === today && isPending(task)).length

  const dayProgress = useMemo<DayProgress>(() => {
    const dayTasks = tasks.filter((task) => task.day === today && task.status !== 'cancelada')
    const tasksDone = dayTasks.filter((task) => task.status === 'feita').length

    const total = habitProgress.total + dayTasks.length
    const done = habitProgress.done + tasksDone

    return { done, total, ratio: total === 0 ? 0 : done / total }
  }, [tasks, today, habitProgress])

  /**
   * A retomada.
   *
   * O tom aqui é decisão de produto, não de copy: a frase diz o que ficou e o
   * que dá pra fazer, e nunca quantos dias foram perdidos. "Você quebrou uma
   * sequência de 12 dias" é verdade e é exatamente o que faz a pessoa não
   * voltar.
   */
  const resumeNote = useMemo(() => {
    const yesterday = addDays(today, -1)

    const missedTasks = tasks.filter((task) => task.day === yesterday && isPending(task)).length
    const scheduledYesterday = habitDayStates(habits, habitLogs, yesterday)
    const missedHabits = scheduledYesterday.filter((state) => state.status === 'pendente').length

    if (missedTasks === 0 && missedHabits === 0) return null

    const parts: string[] = []
    if (missedTasks > 0) {
      parts.push(`${missedTasks} ${missedTasks === 1 ? 'ação' : 'ações'}`)
    }
    if (missedHabits > 0) {
      parts.push(`${missedHabits} ${missedHabits === 1 ? 'hábito' : 'hábitos'}`)
    }

    return `Ontem ficaram ${parts.join(' e ')} sem sair. Não precisa compensar: escolhe o que ainda faz sentido hoje e segue daqui.`
  }, [tasks, habits, habitLogs, today])

  /*
    A frase abaixo da saudação.

    Ela descreve o estado real do dia e nada além disso. "Você consegue!" não
    entra: uma frase que serviria pra qualquer pessoa em qualquer dia é a mesma
    coisa que nenhuma frase, e ainda gasta a linha mais lida da tela.
  */
  const headline = useMemo(() => {
    if (planner.isNewUser) return 'Vamos transformar o que você quer mudar em um plano.'
    if (focus.total === 0) return 'Seu dia ainda não tem atividades planejadas.'
    if (focus.done === focus.total) return 'Você concluiu tudo que planejou pra hoje.'
    if (mainPriority === null && focus.done > 0) {
      return 'Você já concluiu a principal prioridade do dia.'
    }
    if (resumeNote) return 'Hoje é um bom dia pra retomar.'
    if (focus.done > 0) return 'Continue de onde você parou.'
    return 'Seu plano de hoje está pronto.'
  }, [planner.isNewUser, focus, mainPriority, resumeNote])

  /*
    Há registro anterior à janela do momentum? É o que separa "subiu 6 pontos"
    de "essa é a primeira semana".
  */
  const hasHistory = useMemo(() => {
    const cutoff = addDays(today, -MOMENTUM_WINDOW_DAYS)
    return (
      activities.some((item) => item.day < cutoff) ||
      habitLogs.some((item) => item.day < cutoff) ||
      tasks.some((item) => item.completedAt !== null && item.day < cutoff)
    )
  }, [activities, habitLogs, tasks, today])

  const overdueCount = useMemo(
    () => tasks.filter((task) => isPending(task) && task.day < today).length,
    [tasks, today],
  )

  return {
    checkIn,
    objectives,
    focus,
    headline,
    hasHistory,
    overdueCount,
    nextUp,
    dayProgress,
    resumeNote,
    capacity,
    momentum,
    recommendation: recommendationFor(momentum, capacity),
    mainPriority,
    supportingTasks,
    habitStates,
    habitProgress,
    week,
    daysAway,
    goalsInMotion,
    insight,
    todayWin: winOfDay(wins, today),
    focusMinutesToday: totalMinutes(todayActivities),
    dayComplete: habitProgress.allDone && pendingToday === 0 && habitProgress.total > 0,
    dismissInsight,
  }
}

/**
 * Insight dispensado fica só no dispositivo: é preferência de leitura, não dado
 * de negócio, e não vale uma escrita de rede.
 */
function loadDismissed(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function persistDismissed(ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
  } catch {
    // Sem armazenamento o insight simplesmente volta na próxima sessão.
  }
}
