import { DomainError } from '@/shared/errors'
import type { ActivityTypeSlug } from './activity-type'
import { addDays, daysBetween, startOfWeek, type DayKey } from './day'

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

export const TASK_STATUSES = ['pendente', 'feita', 'adiada'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const MAX_TASK_TITLE = 90
export const MAX_MINIMAL_VERSION = 90
export const MAX_ESTIMATED_MIN = 8 * 60

export interface Task {
  readonly id: string
  readonly userId: string
  readonly title: string
  /** Meta que essa ação empurra. Null quando é uma ação solta do dia. */
  readonly goalId: string | null
  readonly axis: ActivityTypeSlug | null
  readonly estimatedMin: number
  readonly effort: TaskEffort
  /** O que fazer no lugar num dia ruim. É a saída em vez do abandono. */
  readonly minimalVersion: string | null
  /** Dia em que a ação está planejada. */
  readonly day: DayKey
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
  readonly axis?: ActivityTypeSlug | null
  readonly estimatedMin?: number
  readonly effort?: TaskEffort
  readonly minimalVersion?: string | null
  readonly isMainPriority?: boolean
}

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

  const estimatedMin = normalizeEstimate(input.estimatedMin ?? 25)

  return {
    id,
    userId: input.userId,
    title,
    goalId: input.goalId ?? null,
    axis: input.axis ?? null,
    estimatedMin,
    effort: input.effort ?? 'medio',
    minimalVersion,
    day: input.day,
    isMainPriority: input.isMainPriority ?? false,
    status: 'pendente',
    completedAt: null,
    createdAt: now,
  }
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

export function isPending(task: Task): boolean {
  return task.status === 'pendente'
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
