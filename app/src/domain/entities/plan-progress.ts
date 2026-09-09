import type { DayKey } from './day'
import type { Habit } from './habit'
import type { Objective } from './objective'
import {
  isStageRunning,
  stagesOfObjective,
  totalWeightOf,
  viewStatusOf,
  type PlanStage,
  type StageViewStatus,
} from './plan-stage'
import {
  isBlocked,
  isOverdue,
  isPending,
  byPlanOrder,
  tasksOfStage,
  unstagedTasks,
  type Task,
} from './task'

/**
 * O progresso da hierarquia, num lugar só.
 *
 * Este arquivo é a resposta pra "quanto do objetivo está feito", e existe
 * exatamente UMA resposta. Antes daqui a mesma pergunta era respondida de dois
 * jeitos em telas vizinhas — o plano dividia ações concluídas pelo total, o
 * detalhe mostrava volume sobre alvo — e duas barras diferentes pro mesmo
 * objetivo é o que faz um produto parecer vários.
 *
 * A conta sobe pela hierarquia:
 *
 *   ação (peso) → etapa (peso) → objetivo (0 a 1)
 *
 * ## Por que o volume continua existindo
 *
 * O progresso do objetivo NÃO mistura consistência de hábito nem minutos
 * registrados: execução é execução. Mas o volume não sumiu — ele continua
 * sendo lido em `ObjectiveProgress` (atividades do eixo sobre o alvo) e aparece
 * ao lado, como ritmo. São perguntas diferentes: "quanto do caminho eu andei" e
 * "quanto eu produzi". Um objetivo sem plano nenhum cai no volume, porque uma
 * barra em zero pra quem leu 400 páginas seria simplesmente falsa.
 */

export interface StageProgress {
  readonly stage: PlanStage
  readonly status: StageViewStatus
  readonly tasks: readonly Task[]
  /** Ações que ainda esperam movimento. */
  readonly openTasks: readonly Task[]
  readonly overdueTasks: readonly Task[]
  readonly doneTasks: number
  readonly totalTasks: number
  /** Ações obrigatórias que faltam pra etapa poder fechar. */
  readonly requiredLeft: number
  /** 0 a 1: o quanto da etapa saiu, ponderado pelo peso das ações. */
  readonly ratio: number
  /** Pontos que essa etapa entrega ao objetivo agora, de 0 a 100. */
  readonly points: number
  /** Pontos que ela entregaria concluída. É o peso dela. */
  readonly maxPoints: number
  /**
   * Todas as ações obrigatórias saíram e a etapa ainda não foi fechada.
   * É SUGESTÃO: quem fecha etapa é a pessoa, porque ela pode ter critério que
   * o app não conhece — e uma etapa fechada sozinha some da tela sem aviso.
   */
  readonly canSuggestCompletion: boolean
  readonly hasOptionalLeft: boolean
  /** A próxima ação executável desta etapa, já sem as travadas por dependência. */
  readonly nextTask: Task | null
}

export interface PlanProgress {
  readonly objective: Objective
  readonly stages: readonly StageProgress[]
  /** 0 a 1, ponderado pelos pesos das etapas. */
  readonly ratio: number
  /** Falso quando o objetivo ainda não tem etapa: a tela mostra o convite. */
  readonly hasPlan: boolean
  /** A etapa em que o trabalho está agora. */
  readonly currentStage: StageProgress | null
  /**
   * A etapa que está segurando o objetivo. Pode não ser a atual: uma etapa
   * anterior parada com ações atrasadas trava tudo que vem depois.
   */
  readonly bottleneck: StageProgress | null
  readonly nextTask: Task | null
  readonly overdueCount: number
  /** Ações do objetivo que ainda não entraram em nenhuma etapa. */
  readonly unstaged: readonly Task[]
  readonly habits: readonly Habit[]
}

/**
 * Progresso de uma etapa a partir das ações dela.
 *
 * Cancelada sai da conta inteira — numerador e denominador. Largar uma ação
 * conscientemente não pode derrubar a barra, senão a pessoa passa a deixar
 * pendente aquilo que já decidiu não fazer, e o plano vira ficção.
 */
export function stageProgressOf(
  stage: PlanStage,
  allTasks: readonly Task[],
  today: DayKey,
): StageProgress {
  const tasks = tasksOfStage(allTasks, stage.id)
  const counted = tasks.filter((task) => task.status !== 'cancelada')

  const totalWeight = counted.reduce((sum, task) => sum + task.weight, 0)
  const doneWeight = counted
    .filter((task) => task.status === 'feita')
    .reduce((sum, task) => sum + task.weight, 0)

  /*
    Etapa sem ação nenhuma vale 0 enquanto está aberta e 100% quando a pessoa
    marca como concluída. É o caso da etapa que se resolve fora do app
    ("aprovar contrato"), e ela não pode ficar presa em zero pra sempre.
  */
  const ratio =
    stage.status === 'concluida' ? 1 : totalWeight === 0 ? 0 : doneWeight / totalWeight

  const openTasks = counted.filter(isPending)
  const requiredLeft = openTasks.filter((task) => task.isRequired).length
  const hasOptionalLeft = openTasks.some((task) => !task.isRequired)

  const nextTask =
    openTasks
      .filter((task) => !isBlocked(task, allTasks))
      .sort(byPlanOrder)[0] ?? null

  return {
    stage,
    status: viewStatusOf(stage, today),
    tasks,
    openTasks,
    overdueTasks: openTasks.filter((task) => isOverdue(task, today)),
    doneTasks: counted.filter((task) => task.status === 'feita').length,
    totalTasks: counted.length,
    requiredLeft,
    ratio,
    points: Math.round(ratio * stage.weight),
    maxPoints: stage.weight,
    canSuggestCompletion:
      stage.status !== 'concluida' && counted.length > 0 && requiredLeft === 0,
    hasOptionalLeft,
    nextTask,
  }
}

export function planProgressOf(
  objective: Objective,
  allStages: readonly PlanStage[],
  allTasks: readonly Task[],
  allHabits: readonly Habit[],
  today: DayKey,
): PlanProgress {
  const stages = stagesOfObjective(allStages, objective.id).map((stage) =>
    stageProgressOf(stage, allTasks, today),
  )

  /*
    Divide pela soma real dos pesos, não pelos 100 nominais.

    O domínio recusa gravar um conjunto que não some 100, mas um banco vindo de
    outra versão, ou uma etapa apagada por fora, pode chegar aqui somando 90 — e
    nesse caso é melhor mostrar a proporção correta entre as etapas existentes
    do que teimar num denominador que não bate com a tela.
  */
  const total = totalWeightOf(stages.map((item) => item.stage))
  const ratio =
    stages.length === 0 || total === 0
      ? 0
      : stages.reduce((sum, item) => sum + item.ratio * item.stage.weight, 0) / total

  const running = stages.filter((item) => isStageRunning(item.stage))
  const currentStage =
    running.find((item) => item.stage.status === 'em-andamento') ?? running[0] ?? null

  const unstaged = unstagedTasks(allTasks, objective.id)

  return {
    objective,
    stages,
    ratio: Math.min(1, ratio),
    hasPlan: stages.length > 0,
    currentStage,
    bottleneck: bottleneckOf(stages),
    nextTask: currentStage?.nextTask ?? unstaged.filter(isPending)[0] ?? null,
    overdueCount: stages.reduce((sum, item) => sum + item.overdueTasks.length, 0),
    unstaged,
    habits: allHabits.filter(
      (habit) => habit.objectiveId === objective.id && habit.archivedAt === null,
    ),
  }
}

/**
 * A etapa que está travando o objetivo.
 *
 * Critério, em ordem: etapa aberta com ações atrasadas (mais atrasadas primeiro,
 * e entre iguais a mais antiga do caminho), depois etapa aberta com peso alto e
 * nenhum movimento. Sem nenhum dos dois casos não há gargalo — e é importante
 * que não haja, porque apontar um gargalo inventado ensina a pessoa a ignorar o
 * aviso quando ele for real.
 */
function bottleneckOf(stages: readonly StageProgress[]): StageProgress | null {
  const open = stages.filter((item) => isStageRunning(item.stage))
  if (open.length === 0) return null

  const withOverdue = open
    .filter((item) => item.overdueTasks.length > 0)
    .sort(
      (a, b) =>
        b.overdueTasks.length - a.overdueTasks.length || a.stage.order - b.stage.order,
    )

  if (withOverdue[0]) return withOverdue[0]

  /*
    Etapa parada só existe onde alguma outra andou.

    Num plano recém-criado todas as etapas estão em zero, e a de maior peso
    ganharia o selo de "segurando o objetivo" no primeiro dia — antes de a
    pessoa ter tido chance de fazer qualquer coisa. Atraso é fato e continua
    valendo acima; "parada" é comparação, e sem nada em movimento não há com o
    que comparar.
  */
  const moved = stages.some((item) => item.ratio > 0 || item.stage.status === 'concluida')
  if (!moved) return null

  const stalled = open
    .filter((item) => item.totalTasks > 0 && item.ratio === 0 && item.stage.weight >= 20)
    .sort((a, b) => b.stage.weight - a.stage.weight || a.stage.order - b.stage.order)

  return stalled[0] ?? null
}

/**
 * O progresso do plano num dia passado.
 *
 * Só olha `completedAt`: é o único carimbo que diz QUANDO a ação saiu. Serve à
 * previsão, que precisa medir velocidade, e à review, que precisa comparar
 * semanas. Ação concluída sem data não conta — o domínio não deixa criar uma,
 * e uma linha antiga sem carimbo seria contada como feita hoje, inflando a
 * velocidade justamente de quem está parado.
 */
export function planRatioAt(
  stages: readonly StageProgress[],
  day: DayKey,
  dayKeyOfDate: (date: Date) => DayKey,
): number {
  const total = totalWeightOf(stages.map((item) => item.stage))
  if (total === 0) return 0

  const sum = stages.reduce((acc, item) => {
    const counted = item.tasks.filter((task) => task.status !== 'cancelada')
    const totalWeight = counted.reduce((weight, task) => weight + task.weight, 0)

    const doneWeight = counted
      .filter((task) => task.completedAt !== null && dayKeyOfDate(task.completedAt) <= day)
      .reduce((weight, task) => weight + task.weight, 0)

    const stageDone =
      item.stage.completedAt !== null && dayKeyOfDate(item.stage.completedAt) <= day

    const ratio = stageDone ? 1 : totalWeight === 0 ? 0 : doneWeight / totalWeight
    return acc + ratio * item.stage.weight
  }, 0)

  return Math.min(1, sum / total)
}
