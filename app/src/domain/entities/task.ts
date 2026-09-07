import { DomainError } from '@/shared/errors'
import type { ActivityTypeSlug } from './activity-type'
import { addDays, daysBetween, startOfWeek, type DayKey } from './day'
import { comparePriority, type Priority } from './priority'

/**
 * Ação: o degrau entre a meta e o movimento. Meta sem ação é intenção; por isso
 * toda ação pode apontar pra uma meta, e é dela que sai a "próxima ação" que a
 * meta mostra no dashboard.
 *
 * A ação de maior peso do dia é a PRIORIDADE PRINCIPAL. Existe no máximo uma,
 * porque o produto inteiro é uma aposta contra a lista infinita.
 */

export const TASK_EFFORTS = ['leve', 'medio', 'pesado'] as const
export type TaskEffort = (typeof TASK_EFFORTS)[number]

export const TASK_EFFORT_LABELS: Readonly<Record<TaskEffort, string>> = {
  leve: 'Esforço leve',
  medio: 'Esforço médio',
  pesado: 'Esforço alto',
}

/**
 * Estados da ação.
 *
 * `em-andamento` existe pro cronômetro ter onde marcar que a ação começou —
 * sem ele, sair no meio de uma sessão de foco deixa a ação indistinguível de
 * uma nunca tocada. `cancelada` é diferente de excluída: a decisão de largar
 * uma ação é informação, e é ela que a review usa pra perguntar o porquê.
 */
export const TASK_STATUSES = ['pendente', 'em-andamento', 'feita', 'adiada', 'cancelada'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  pendente: 'Pendente',
  'em-andamento': 'Em andamento',
  feita: 'Concluída',
  adiada: 'Adiada',
  cancelada: 'Cancelada',
}

/** Estados que ainda esperam movimento. Cancelada e feita saíram da fila. */
export const OPEN_TASK_STATUSES: readonly TaskStatus[] = ['pendente', 'em-andamento', 'adiada']

export const MAX_TASK_TITLE = 90
export const MAX_TASK_DESCRIPTION = 400
export const MAX_MINIMAL_VERSION = 90
export const MAX_ESTIMATED_MIN = 8 * 60

/** Peso padrão. Com todas as ações em 1, a etapa se divide por igual. */
export const DEFAULT_TASK_WEIGHT = 1
/** Acima disso o peso deixa de ordenar e vira número mágico. */
export const MAX_TASK_WEIGHT = 10

export interface Task {
  readonly id: string
  readonly userId: string
  readonly title: string
  readonly description: string | null
  /** Meta que essa ação empurra. Null quando é uma ação solta do dia. */
  readonly goalId: string | null
  /**
   * Objetivo que essa ação empurra. É o vínculo que faz o `Hoje` responder
   * "pra que serve isso" em vez de mostrar uma lista de tarefas soltas.
   */
  readonly objectiveId: string | null
  /**
   * Etapa do plano em que essa ação vive. É o vínculo que faz a conclusão
   * empurrar uma barra de progresso específica em vez de sumir numa lista.
   * Null significa ação sem etapa — legítima quando o objetivo ainda não tem
   * plano, e caixa de entrada quando nem objetivo tem.
   */
  readonly stageId: string | null
  /**
   * Quanto essa ação vale dentro da etapa. Ações de peso igual dividem a etapa
   * por igual; peso 3 contra peso 1 diz que uma vale o triplo da outra.
   */
  readonly weight: number
  /**
   * Obrigatória pra etapa fechar. A opcional soma progresso quando sai, mas não
   * segura a conclusão da etapa — senão toda melhoria "se der tempo" viraria um
   * bloqueio permanente.
   */
  readonly isRequired: boolean
  readonly axis: ActivityTypeSlug | null
  readonly estimatedMin: number
  readonly effort: TaskEffort
  readonly priority: Priority
  /** O que fazer no lugar num dia ruim. É a saída em vez do abandono. */
  readonly minimalVersion: string | null
  /** Dia em que a ação está planejada. */
  readonly day: DayKey
  /** Horário sugerido em `HH:MM`. Opcional. */
  readonly timeOfDay: string | null
  /** Posição dentro do plano do objetivo. Menor vem primeiro. */
  readonly order: number
  /** Ação que precisa sair antes dessa. Null quando não depende de nada. */
  readonly dependsOnId: string | null
  /** Só uma ação por dia pode ser a principal. */
  readonly isMainPriority: boolean
  readonly status: TaskStatus
  readonly completedAt: Date | null
  readonly createdAt: Date
}

export interface NewTaskInput {
  readonly userId: string
  readonly title: string
  readonly day: DayKey
  readonly goalId?: string | null
  readonly objectiveId?: string | null
  readonly stageId?: string | null
  readonly weight?: number
  readonly isRequired?: boolean
  readonly axis?: ActivityTypeSlug | null
  readonly estimatedMin?: number
  readonly effort?: TaskEffort
  readonly priority?: Priority
  readonly minimalVersion?: string | null
  readonly isMainPriority?: boolean
  readonly description?: string | null
  readonly timeOfDay?: string | null
  readonly order?: number
  readonly dependsOnId?: string | null
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function createTask(input: NewTaskInput, id: string, now = new Date()): Task {
  const title = input.title.trim()
  if (title.length < 2) {
    throw new DomainError('Escreve a ação com pelo menos 2 letras.')
  }
  if (title.length > MAX_TASK_TITLE) {
    throw new DomainError(`A ação pode ter no máximo ${MAX_TASK_TITLE} caracteres.`)
  }

  const minimalVersion = input.minimalVersion?.trim() || null
  if (minimalVersion && minimalVersion.length > MAX_MINIMAL_VERSION) {
    throw new DomainError(`A versão mínima pode ter no máximo ${MAX_MINIMAL_VERSION} caracteres.`)
  }

  const description = input.description?.trim() || null
  if (description && description.length > MAX_TASK_DESCRIPTION) {
    throw new DomainError(`A descrição pode ter no máximo ${MAX_TASK_DESCRIPTION} caracteres.`)
  }

  const timeOfDay = input.timeOfDay?.trim() || null
  if (timeOfDay && !TIME_PATTERN.test(timeOfDay)) {
    throw new DomainError('O horário precisa estar no formato HH:MM.')
  }

  const estimatedMin = normalizeEstimate(input.estimatedMin ?? 25)

  return {
    id,
    userId: input.userId,
    title,
    description,
    goalId: input.goalId ?? null,
    objectiveId: input.objectiveId ?? null,
    stageId: input.stageId ?? null,
    weight: normalizeWeight(input.weight ?? DEFAULT_TASK_WEIGHT),
    isRequired: input.isRequired ?? true,
    axis: input.axis ?? null,
    estimatedMin,
    effort: input.effort ?? 'medio',
    priority: input.priority ?? 'media',
    minimalVersion,
    day: input.day,
    timeOfDay,
    order: input.order ?? 0,
    dependsOnId: input.dependsOnId ?? null,
    isMainPriority: input.isMainPriority ?? false,
    status: 'pendente',
    completedAt: null,
    createdAt: now,
  }
}

function normalizeWeight(value: number): number {
  const rounded = Math.round(value)
  if (!Number.isFinite(rounded) || rounded < 1) {
    throw new DomainError('O peso da ação precisa ser pelo menos 1.')
  }
  if (rounded > MAX_TASK_WEIGHT) {
    throw new DomainError(`O peso da ação vai de 1 a ${MAX_TASK_WEIGHT}.`)
  }
  return rounded
}

function normalizeEstimate(value: number): number {
  const rounded = Math.round(value)
  if (!Number.isFinite(rounded) || rounded <= 0) {
    throw new DomainError('O tempo estimado precisa ser maior que zero.')
  }
  if (rounded > MAX_ESTIMATED_MIN) {
    throw new DomainError('Uma ação de mais de oito horas não é uma ação, é um projeto.')
  }
  return rounded
}

/**
 * Ação que ainda espera ser feita hoje. Uma ação em andamento continua
 * pendente: começar não é terminar, e ela precisa seguir na tela.
 */
export function isPending(task: Task): boolean {
  return task.status === 'pendente' || task.status === 'em-andamento'
}

export function isDone(task: Task): boolean {
  return task.status === 'feita'
}

export function isCancelled(task: Task): boolean {
  return task.status === 'cancelada'
}

/**
 * A ação está travada por outra que ainda não saiu?
 *
 * Dependência não some da lista, aparece travada. Esconder a ação faria o plano
 * mentir sobre o tamanho: a pessoa acharia que a semana tem três passos quando
 * tem seis.
 */
export function isBlocked(task: Task, all: readonly Task[]): boolean {
  if (!task.dependsOnId) return false
  const parent = all.find((item) => item.id === task.dependsOnId)
  if (!parent) return false
  return parent.status !== 'feita' && parent.status !== 'cancelada'
}

export function startTask(task: Task): Task {
  return { ...task, status: 'em-andamento' }
}

export function cancelTask(task: Task): Task {
  return { ...task, status: 'cancelada', isMainPriority: false, completedAt: null }
}

/** Ordena pelo que o plano manda: ordem definida, depois prioridade, depois dia. */
export function byPlanOrder(a: Task, b: Task): number {
  if (a.order !== b.order) return a.order - b.order
  const priority = comparePriority(a.priority, b.priority)
  if (priority !== 0) return priority
  return a.day < b.day ? -1 : a.day > b.day ? 1 : 0
}

/** Ordena o dia: prioridade principal na frente, depois prioridade e horário. */
export function byDayOrder(a: Task, b: Task): number {
  if (a.isMainPriority !== b.isMainPriority) return a.isMainPriority ? -1 : 1
  const priority = comparePriority(a.priority, b.priority)
  if (priority !== 0) return priority
  if (a.timeOfDay && b.timeOfDay) return a.timeOfDay.localeCompare(b.timeOfDay)
  if (a.timeOfDay) return -1
  if (b.timeOfDay) return 1
  return a.order - b.order
}

export function tasksOfObjective(tasks: readonly Task[], objectiveId: string): Task[] {
  return tasks.filter((task) => task.objectiveId === objectiveId).sort(byPlanOrder)
}

/**
 * Reordena a lista aplicando `order` sequencial. Usado depois de arrastar uma
 * ação: a ordem visível e a guardada precisam ser a mesma coisa.
 */
export function resequence(tasks: readonly Task[]): { id: string; order: number }[] {
  return tasks.map((task, index) => ({ id: task.id, order: index }))
}

export function tasksOfDay(tasks: readonly Task[], day: DayKey): Task[] {
  return tasks.filter((task) => task.day === day)
}

/**
 * A prioridade principal do dia. Quando ninguém marcou uma, o dashboard elege
 * a primeira pendente — a tela não pode ficar sem resposta pra "o que agora?".
 */
export function mainPriorityOf(tasks: readonly Task[], day: DayKey): Task | null {
  const pending = tasksOfDay(tasks, day).filter(isPending)
  return pending.find((task) => task.isMainPriority) ?? pending[0] ?? null
}

/** As demais ações do dia, já sem a principal. */
export function supportingTasksOf(tasks: readonly Task[], day: DayKey): Task[] {
  const main = mainPriorityOf(tasks, day)
  return tasksOfDay(tasks, day).filter((task) => task.id !== main?.id)
}

export type TaskGroupKey = 'hoje' | 'semana' | 'depois'

export interface TaskGroup {
  readonly key: TaskGroupKey
  readonly label: string
  readonly tasks: readonly Task[]
}

/**
 * Agrupa as ações pendentes em horizontes. Sem isso a lista vira um monte só e
 * a pessoa não consegue decidir o que é de hoje.
 */
export function groupPendingTasks(tasks: readonly Task[], today: DayKey): TaskGroup[] {
  const weekEnd = addDays(startOfWeek(today), 6)
  const pending = tasks.filter(isPending)

  const groups: TaskGroup[] = [
    {
      key: 'hoje',
      label: 'Hoje',
      // Ação vencida continua sendo de hoje: esconder atrasado não resolve.
      tasks: pending.filter((task) => task.day <= today),
    },
    {
      key: 'semana',
      label: 'Esta semana',
      tasks: pending.filter((task) => task.day > today && task.day <= weekEnd),
    },
    {
      key: 'depois',
      label: 'Mais pra frente',
      tasks: pending.filter((task) => task.day > weekEnd),
    },
  ]

  return groups.filter((group) => group.tasks.length > 0)
}

export type PlanHorizonKey = 'atrasada' | 'hoje' | 'semana' | 'depois'

export interface PlanHorizon {
  readonly key: PlanHorizonKey
  readonly label: string
  readonly hint: string
  readonly tasks: readonly Task[]
}

/**
 * Os horizontes do plano. Diferente de `groupPendingTasks`, que serve ao dia e
 * de propósito puxa o atrasado pra hoje: aqui o atraso aparece separado, porque
 * a tela do plano existe justamente pra a pessoa decidir o que fazer com ele —
 * refazer a data, encolher ou cancelar.
 */
export function planHorizons(tasks: readonly Task[], today: DayKey): PlanHorizon[] {
  const weekEnd = addDays(startOfWeek(today), 6)
  const open = tasks.filter(isPending).sort(byDayOrder)

  const horizons: PlanHorizon[] = [
    {
      key: 'atrasada',
      label: 'Atrasadas',
      hint: 'Ficaram pra trás. Remarcar não é falhar.',
      tasks: open.filter((task) => task.day < today),
    },
    {
      key: 'hoje',
      label: 'Hoje',
      hint: 'O que está na mesa agora.',
      tasks: open.filter((task) => task.day === today),
    },
    {
      key: 'semana',
      label: 'Esta semana',
      hint: 'Já tem data e ainda não chegou.',
      tasks: open.filter((task) => task.day > today && task.day <= weekEnd),
    },
    {
      key: 'depois',
      label: 'Mais pra frente',
      hint: 'O resto do caminho.',
      tasks: open.filter((task) => task.day > weekEnd),
    },
  ]

  return horizons.filter((horizon) => horizon.tasks.length > 0)
}

export function completeTask(task: Task, now = new Date()): Task {
  return { ...task, status: 'feita', completedAt: now }
}

export function reopenTask(task: Task): Task {
  return { ...task, status: 'pendente', completedAt: null }
}

/** Adiar é uma escolha consciente, não uma falha: a ação muda de dia e segue viva. */
export function postponeTask(task: Task, today: DayKey, days = 1): Task {
  const base = task.day < today ? today : task.day
  return { ...task, day: addDays(base, days), status: 'pendente', completedAt: null }
}

/** Troca a ação pela versão mínima dela. É a saída pro dia ruim. */
export function shrinkToMinimal(task: Task): Task {
  if (!task.minimalVersion) {
    throw new DomainError('Essa ação ainda não tem versão mínima definida.')
  }
  return {
    ...task,
    title: task.minimalVersion,
    minimalVersion: null,
    estimatedMin: Math.max(5, Math.round(task.estimatedMin / 3)),
    effort: 'leve',
  }
}

export function tasksCompletedBetween(
  tasks: readonly Task[],
  from: DayKey,
  to: DayKey,
): Task[] {
  return tasks.filter((task) => task.status === 'feita' && task.day >= from && task.day <= to)
}

export function nextTaskForGoal(tasks: readonly Task[], goalId: string): Task | null {
  const pending = tasks.filter((task) => task.goalId === goalId && isPending(task))
  return [...pending].sort((a, b) => daysBetween(b.day, a.day))[0] ?? null
}

export function estimatedMinutesOf(tasks: readonly Task[]): number {
  return tasks.reduce((sum, task) => sum + task.estimatedMin, 0)
}

// ---------------------------------------------------------------------------
// hierarquia: etapa e caixa de entrada
// ---------------------------------------------------------------------------

/** As ações de uma etapa, na ordem do plano. */
export function tasksOfStage(tasks: readonly Task[], stageId: string): Task[] {
  return tasks.filter((task) => task.stageId === stageId).sort(byPlanOrder)
}

/**
 * Ação sem objetivo: a captura rápida.
 *
 * Ela é permitida de propósito — obrigar a escolher um objetivo pra anotar algo
 * que acabou de surgir faz a pessoa anotar fora do app, e aí o app perde a
 * informação. O que ela NÃO faz é influenciar progresso: fica na caixa de
 * entrada até ganhar um destino.
 */
export function isInbox(task: Task): boolean {
  return task.objectiveId === null
}

export function inboxTasks(tasks: readonly Task[]): Task[] {
  return tasks.filter((task) => isInbox(task) && isPending(task)).sort(byPlanOrder)
}

/**
 * Ação de um objetivo que ainda não foi colocada numa etapa. Diferente da caixa
 * de entrada: aqui o destino existe, falta só o lugar dentro do caminho.
 */
export function unstagedTasks(tasks: readonly Task[], objectiveId: string): Task[] {
  return tasks
    .filter((task) => task.objectiveId === objectiveId && task.stageId === null)
    .sort(byPlanOrder)
}

/** Ação em aberto cujo dia já passou. É a fila que a etapa usa pra dizer que travou. */
export function isOverdue(task: Task, today: DayKey): boolean {
  return isPending(task) && task.day < today
}

export function overdueTasks(tasks: readonly Task[], today: DayKey): Task[] {
  return tasks.filter((task) => isOverdue(task, today))
}

/** Conta os adiamentos do período. Entra no momentum como sinal de plano grande demais. */
export function postponedBetween(tasks: readonly Task[], from: DayKey, to: DayKey): number {
  return tasks.filter((task) => task.status === 'adiada' && task.day >= from && task.day <= to)
    .length
}
