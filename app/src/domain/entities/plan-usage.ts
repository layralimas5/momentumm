import { DomainError } from '@/shared/errors'
import type { ActivityTypeSlug } from './activity-type'
import { addDays, type DayKey } from './day'
import { isHabitRunning, type Habit } from './habit'
import { isActiveObjective, isRunning, type Objective } from './objective'
import { checkLimit, type LimitCheck, type PlanLimits } from './plan'
import type { PlanStage } from './plan-stage'
import { OPEN_TASK_STATUSES, type Task } from './task'

/**
 * Quanto do plano a conta já usou, contra o que o plano dela permite.
 *
 * Uma função pura por limite, lendo o mesmo estado que as telas leem. O
 * `PlannerProvider` recusa a criação que passaria do limite e as telas
 * perguntam ANTES, pra desabilitar o botão e explicar — mas a regra é uma só,
 * e mora aqui: dois lugares contando "objetivo ativo" de jeitos diferentes é
 * como a tela promete um objetivo que o provider recusa.
 */

export interface PlanUsageInput {
  readonly objectives: readonly Objective[]
  readonly planStages: readonly PlanStage[]
  readonly habits: readonly Habit[]
  readonly tasks: readonly Task[]
}

/** O limite que a pessoa encostou. A tela mostra o PRO no ponto exato. */
export class PlanLimitError extends DomainError {
  readonly feature: string

  constructor(feature: string, message: string) {
    super(message)
    this.name = 'PlanLimitError'
    this.feature = feature
  }
}

export function objectiveLimit(limits: PlanLimits, objectives: readonly Objective[]): LimitCheck {
  return checkLimit(objectives.filter(isRunning).length, limits.activeObjectives, 'objetivos ativos')
}

/**
 * Quantos objetivos a conta já tem nessa área, contra o que o plano dela deixa.
 *
 * Conta o NÃO ARQUIVADO — pausado e concluído incluídos —, que é a mesma janela
 * do índice que a 0057 substituiu e a mesma da contagem do servidor. É diferente
 * da janela de `objectiveLimit` de propósito: ver `plan.objectivesPerAxis`.
 */
export function axisObjectiveLimit(
  limits: PlanLimits,
  objectives: readonly Objective[],
  axis: ActivityTypeSlug,
): LimitCheck {
  const used = objectives.filter(
    (objective) => objective.axis === axis && isActiveObjective(objective),
  ).length
  const check = checkLimit(used, limits.objectivesPerAxis, 'objetivos na mesma área')
  return {
    ...check,
    message: check.reached
      ? 'Essa área já tem um objetivo ativo. Escolhe outra, ou assina o PRO pra manter várias frentes na mesma área.'
      : null,
  }
}

/**
 * Áreas que não cabem outro objetivo agora.
 *
 * É o que o seletor de área usa pra desabilitar cartão, e é por isso que ela
 * devolve VAZIO quando o plano não tem teto por eixo: no PRO nenhuma área está
 * ocupada, e uma lista cheia ali era exatamente o que travava o diálogo de
 * objetivo novo em "Leitura", sem nada clicável.
 */
export function takenAxesFor(
  limits: PlanLimits,
  objectives: readonly Objective[],
): readonly ActivityTypeSlug[] {
  if (!Number.isFinite(limits.objectivesPerAxis)) return []
  const perAxis = new Map<ActivityTypeSlug, number>()
  for (const objective of objectives) {
    if (!isActiveObjective(objective)) continue
    perAxis.set(objective.axis, (perAxis.get(objective.axis) ?? 0) + 1)
  }
  return [...perAxis.entries()]
    .filter(([, used]) => used >= limits.objectivesPerAxis)
    .map(([axis]) => axis)
}

/** Um plano é um objetivo em andamento com pelo menos uma etapa. */
export function planLimit(
  limits: PlanLimits,
  objectives: readonly Objective[],
  stages: readonly PlanStage[],
): LimitCheck {
  const withPlan = new Set(stages.map((stage) => stage.objectiveId))
  const used = objectives.filter((objective) => isRunning(objective) && withPlan.has(objective.id)).length
  return checkLimit(used, limits.activePlans, 'planos ativos')
}

export function hasPlan(stages: readonly PlanStage[], objectiveId: string): boolean {
  return stages.some((stage) => stage.objectiveId === objectiveId)
}

export function habitLimit(limits: PlanLimits, habits: readonly Habit[]): LimitCheck {
  return checkLimit(habits.filter(isHabitRunning).length, limits.activeHabits, 'hábitos ativos')
}

/**
 * Ações de um dia. Cancelada não conta: a pessoa desistiu dela, e uma vaga
 * que continua ocupada por uma decisão de largar seria o limite punindo a
 * decisão certa. Concluída conta — o dia foi planejado com ela dentro.
 */
export function actionsLimit(limits: PlanLimits, tasks: readonly Task[], day: DayKey): LimitCheck {
  const used = tasks.filter(
    (task) => task.day === day && (task.status === 'feita' || OPEN_TASK_STATUSES.includes(task.status)),
  ).length
  const check = checkLimit(used, limits.actionsPerDay, 'ações por dia')
  return {
    ...check,
    message: check.reached ? `O plano gratuito guarda até ${check.max} ações num mesmo dia.` : null,
  }
}

export interface PlanUsage {
  readonly objectives: LimitCheck
  readonly plans: LimitCheck
  readonly habits: LimitCheck
  /** Áreas sem vaga pra outro objetivo. Vazio quando o plano não tem teto por eixo. */
  readonly takenAxes: readonly ActivityTypeSlug[]
  actionsOn(day: DayKey): LimitCheck
  axisObjectivesOn(axis: ActivityTypeSlug): LimitCheck
}

export function planUsageOf(limits: PlanLimits, input: PlanUsageInput): PlanUsage {
  return {
    objectives: objectiveLimit(limits, input.objectives),
    plans: planLimit(limits, input.objectives, input.planStages),
    habits: habitLimit(limits, input.habits),
    takenAxes: takenAxesFor(limits, input.objectives),
    actionsOn: (day) => actionsLimit(limits, input.tasks, day),
    axisObjectivesOn: (axis) => axisObjectiveLimit(limits, input.objectives, axis),
  }
}

/** Lança quando o limite já foi atingido. Chamado antes de criar. */
export function assertWithinLimit(feature: string, check: LimitCheck): void {
  if (check.reached && check.message) throw new PlanLimitError(feature, check.message)
}

/**
 * Registros mais antigos que o histórico do plano ficam guardados, mas fora
 * da tela: quem passa pro PRO reencontra tudo. Sem `historyDays` finito, a
 * lista passa inteira.
 */
export function withinHistory<T>(
  items: readonly T[],
  limits: PlanLimits,
  today: DayKey,
  dayOf: (item: T) => DayKey,
): readonly T[] {
  if (!Number.isFinite(limits.historyDays)) return items
  const floor = addDays(today, -(limits.historyDays - 1))
  return items.filter((item) => dayOf(item) >= floor)
}

export function historyFloor(limits: PlanLimits, today: DayKey): DayKey | null {
  if (!Number.isFinite(limits.historyDays)) return null
  return addDays(today, -(limits.historyDays - 1))
}
