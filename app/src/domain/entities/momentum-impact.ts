import type { Habit } from './habit'
import type { Task } from './task'

/**
 * O peso de cada coisa feita.
 *
 * Sem isso o score vira contagem, e contagem se infla: marcar cinco hábitos de
 * dois minutos renderia mais que fechar a ação que destrava a etapa do
 * objetivo. O produto inteiro defende o contrário — o que importa é o que move
 * o objetivo —, então o número que resume o ritmo precisa dizer a mesma coisa.
 *
 * Três níveis e não sete: a régua precisa caber na cabeça de quem lê o
 * detalhamento do score. Se a pessoa não consegue prever se a ação dela vale 1
 * ou 3, o número volta a ser um oráculo.
 */

export const IMPACT_LEVELS = ['baixo', 'medio', 'alto'] as const
export type ImpactLevel = (typeof IMPACT_LEVELS)[number]

export const IMPACT_POINTS: Readonly<Record<ImpactLevel, number>> = {
  baixo: 1,
  medio: 2,
  alto: 3,
}

export const IMPACT_LABELS: Readonly<Record<ImpactLevel, string>> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
}

/**
 * O impacto de uma ação.
 *
 * ALTO é o que a pessoa mesma marcou como o movimento do dia, ou o que a etapa
 * precisa pra fechar: prioridade principal, ação de alta prioridade dentro de
 * um objetivo, ou ação obrigatória que pesa mais que as irmãs da etapa.
 *
 * MÉDIO é o que empurra um objetivo sem ser o passo decisivo — e também a ação
 * solta que a pessoa marcou como alta: ela não move plano nenhum, mas foi uma
 * escolha explícita.
 *
 * BAIXO é a tarefa comum do dia. Ela conta, só não vale o mesmo.
 */
export function taskImpact(task: Task): ImpactLevel {
  if (task.isMainPriority) return 'alto'
  if (task.objectiveId !== null && task.priority === 'alta') return 'alto'
  if (task.stageId !== null && task.isRequired && task.weight >= 2) return 'alto'
  if (task.objectiveId !== null || task.priority === 'alta') return 'medio'
  return 'baixo'
}

/**
 * O impacto de um hábito, com teto em MÉDIO.
 *
 * Hábito é repetição, e repetição não pode competir com a ação que destrava a
 * etapa: são cinco marcações por dia contra uma. O teto é o que impede a pessoa
 * de subir o score criando hábitos fáceis — que é exatamente o comportamento
 * que o número deveria desencorajar.
 */
export function habitImpact(habit: Habit): ImpactLevel {
  return habit.objectiveId !== null ? 'medio' : 'baixo'
}

export function impactPointsOf(level: ImpactLevel): number {
  return IMPACT_POINTS[level]
}
