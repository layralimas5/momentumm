import { DomainError } from '@/shared/errors'
import type { Activity } from './activity'
import { activityType, formatUnit, type ActivityTypeSlug } from './activity-type'
import { addDays, daysBetween, type DayKey } from './day'
import type { Priority } from './priority'

/**
 * Objetivo: o que a pessoa quer mudar, com prazo.
 *
 * A diferença pra `Goal` é de natureza, não de tamanho. A meta é um ritmo que
 * se repete ("20 páginas por dia") e não termina. O objetivo TERMINA: tem um
 * alvo acumulado e uma data em que fecha, e é dele que sai o plano — hábitos e
 * ações existem pra empurrar um objetivo, não o contrário.
 *
 * Um objetivo ativo por eixo. Não é limitação técnica: é a mesma regra que o
 * onboarding aplica ao pedir uma área só. Dois objetivos disputando o mesmo
 * eixo tornam o progresso ambíguo e a decisão do dia, impossível.
 */

export const MAX_OBJECTIVE_TITLE = 80
export const MAX_OBJECTIVE_MOTIVE = 140
export const MAX_OBJECTIVE_DESCRIPTION = 400
export const MAX_OBJECTIVE_TARGET = 1_000_000
/** Prazo além disso deixa de ser objetivo e vira desejo. */
export const MAX_OBJECTIVE_DAYS = 366
export const MIN_OBJECTIVE_DAYS = 7

export interface Objective {
  readonly id: string
  readonly userId: string
  readonly title: string
  readonly axis: ActivityTypeSlug
  /** Detalhe livre. Opcional: objetivo que exige parágrafo raramente vira plano. */
  readonly description: string | null
  /** Por que isso importa. É o que a tela mostra de volta num dia ruim. */
  readonly motive: string | null
  readonly priority: Priority
  /** Alvo acumulado até o prazo, na unidade do eixo. */
  readonly target: number
  readonly startedOn: DayKey
  readonly deadline: DayKey
  readonly createdAt: Date
  readonly completedAt: Date | null
  /**
   * Pausa explícita. Diferente de arquivar: o objetivo continua na lista, só
   * para de cobrar prazo e de aparecer no dia. É a saída pra quem precisa
   * suspender sem apagar — e apagar é justamente o que faz a pessoa desistir.
   */
  readonly pausedAt: Date | null
  readonly archivedAt: Date | null
}

export interface NewObjectiveInput {
  readonly userId: string
  readonly title: string
  readonly axis: ActivityTypeSlug
  readonly target: number
  readonly startedOn: DayKey
  readonly deadline: DayKey
  readonly motive?: string | null
  readonly description?: string | null
  readonly priority?: Priority
}

export function createObjective(
  input: NewObjectiveInput,
  id: string,
  now = new Date(),
): Objective {
  const title = input.title.trim()
  if (title.length < 3) {
    throw new DomainError('Escreve o objetivo com pelo menos 3 letras.')
  }
  if (title.length > MAX_OBJECTIVE_TITLE) {
    throw new DomainError(`O objetivo pode ter no máximo ${MAX_OBJECTIVE_TITLE} caracteres.`)
  }

  const motive = input.motive?.trim() || null
  if (motive && motive.length > MAX_OBJECTIVE_MOTIVE) {
    throw new DomainError(`O motivo pode ter no máximo ${MAX_OBJECTIVE_MOTIVE} caracteres.`)
  }

  const description = input.description?.trim() || null
  if (description && description.length > MAX_OBJECTIVE_DESCRIPTION) {
    throw new DomainError(
      `A descrição pode ter no máximo ${MAX_OBJECTIVE_DESCRIPTION} caracteres.`,
    )
  }

  const target = Math.round(input.target)
  if (!Number.isFinite(target) || target <= 0) {
    throw new DomainError('O objetivo precisa de um alvo maior que zero.')
  }
  if (target > MAX_OBJECTIVE_TARGET) {
    throw new DomainError('Esse alvo está fora do razoável.')
  }

  const span = daysBetween(input.startedOn, input.deadline) + 1
  if (span < MIN_OBJECTIVE_DAYS) {
    throw new DomainError(`Dá pelo menos ${MIN_OBJECTIVE_DAYS} dias pro objetivo.`)
  }
  if (span > MAX_OBJECTIVE_DAYS) {
    throw new DomainError('Prazo de mais de um ano não vira plano. Quebra em etapas menores.')
  }

  return {
    id,
    userId: input.userId,
    title,
    axis: input.axis,
    description,
    motive,
    priority: input.priority ?? 'media',
    target,
    startedOn: input.startedOn,
    deadline: input.deadline,
    createdAt: now,
    completedAt: null,
    pausedAt: null,
    archivedAt: null,
  }
}

export function isActiveObjective(objective: Objective): boolean {
  return objective.archivedAt === null
}

/**
 * Ciclo de vida do objetivo. Não confundir com `ObjectiveStatus`, que é a
 * leitura de RITMO (no prazo, atrasado). Aqui é o estado que a pessoa controla:
 * ela pausa, retoma, conclui e arquiva. Os dois convivem porque respondem
 * perguntas diferentes — "como está indo" e "ainda está valendo".
 *
 * O estado é derivado, não guardado. Guardar abriria a porta pra um objetivo
 * com `completedAt` preenchido e estado "em andamento", que é exatamente o tipo
 * de contradição que o app não pode mostrar.
 */
export const OBJECTIVE_STATES = [
  'nao-iniciado',
  'em-andamento',
  'pausado',
  'concluido',
  'arquivado',
] as const
export type ObjectiveState = (typeof OBJECTIVE_STATES)[number]

export const OBJECTIVE_STATE_LABELS: Readonly<Record<ObjectiveState, string>> = {
  'nao-iniciado': 'Não iniciado',
  'em-andamento': 'Em andamento',
  pausado: 'Pausado',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
}

export function stateOf(objective: Objective, done: number): ObjectiveState {
  if (objective.archivedAt) return 'arquivado'
  if (objective.completedAt) return 'concluido'
  if (objective.pausedAt) return 'pausado'
  return done > 0 ? 'em-andamento' : 'nao-iniciado'
}

/** Objetivo que ainda cobra o dia. Pausado e concluído saem da fila. */
export function isRunning(objective: Objective): boolean {
  return objective.archivedAt === null && objective.pausedAt === null && objective.completedAt === null
}

export const OBJECTIVE_STATUSES = [
  'no-prazo',
  'atencao',
  'atrasado',
  'concluido',
  'vencido',
] as const
export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number]

export const OBJECTIVE_STATUS_LABELS: Readonly<Record<ObjectiveStatus, string>> = {
  'no-prazo': 'No prazo',
  atencao: 'Atenção',
  atrasado: 'Atrasado',
  concluido: 'Concluído',
  vencido: 'Prazo vencido',
}

export interface ObjectiveProgress {
  readonly objective: Objective
  readonly done: number
  readonly target: number
  /** 0 a 1. */
  readonly ratio: number
  readonly remaining: number
  readonly status: ObjectiveStatus
  /** O estado que a pessoa controla: pausado, concluído, arquivado. */
  readonly state: ObjectiveState
  readonly daysLeft: number
  readonly totalDays: number
  /** Quanto do prazo já foi consumido, de 0 a 1. */
  readonly elapsed: number
  /** Quanto ainda falta por dia pra fechar no prazo. */
  readonly dailyPace: number
  /** A leitura em uma frase. */
  readonly summary: string
}

/** Margem em que estar um pouco atrás do esperado ainda é estar no prazo. */
const ON_TRACK_TOLERANCE = 0.1
const BEHIND_TOLERANCE = 0.25

/**
 * Progresso do objetivo.
 *
 * A conta usa as atividades do eixo dentro da janela do objetivo, e não uma
 * tabela de vínculo. É deliberado: a unidade do produto é a atividade, e
 * registrar leitura DEVE empurrar o objetivo de leitura, tenha ela vindo de um
 * hábito, de uma ação, do cronômetro ou de um registro solto.
 */
export function progressOfObjective(
  objective: Objective,
  activities: readonly Activity[],
  today: DayKey,
): ObjectiveProgress {
  const done = activities.reduce((sum, activity) => {
    if (activity.type !== objective.axis) return sum
    if (activity.day < objective.startedOn || activity.day > objective.deadline) return sum
    return sum + activity.value
  }, 0)

  const ratio = Math.min(1, done / objective.target)
  const remaining = Math.max(0, objective.target - done)

  const totalDays = daysBetween(objective.startedOn, objective.deadline) + 1
  const daysLeft = Math.max(0, daysBetween(today, objective.deadline))
  const elapsedDays = Math.min(totalDays, Math.max(0, daysBetween(objective.startedOn, today) + 1))
  const elapsed = elapsedDays / totalDays

  // Divide pelos dias que ainda restam incluindo hoje: hoje ainda é dia útil.
  const dailyPace = remaining === 0 ? 0 : remaining / Math.max(1, daysLeft + 1)

  const status = statusOfObjective({ objective, ratio, elapsed, daysLeft, today })

  return {
    objective,
    done,
    target: objective.target,
    ratio,
    remaining,
    status,
    state: stateOf(objective, done),
    daysLeft,
    totalDays,
    elapsed,
    dailyPace,
    summary: summarize(objective, { done, remaining, status, daysLeft, dailyPace }),
  }
}

function statusOfObjective(input: {
  objective: Objective
  ratio: number
  elapsed: number
  daysLeft: number
  today: DayKey
}): ObjectiveStatus {
  // Concluir na mão vale tanto quanto bater o alvo: a pessoa é quem sabe se o
  // objetivo terminou, e o número nem sempre acompanha.
  if (input.objective.completedAt) return 'concluido'
  if (input.ratio >= 1) return 'concluido'
  if (input.today > input.objective.deadline) return 'vencido'
  if (input.ratio >= input.elapsed - ON_TRACK_TOLERANCE) return 'no-prazo'
  if (input.ratio >= input.elapsed - BEHIND_TOLERANCE) return 'atencao'
  return 'atrasado'
}

function summarize(
  objective: Objective,
  input: {
    done: number
    remaining: number
    status: ObjectiveStatus
    daysLeft: number
    dailyPace: number
  },
): string {
  const type = activityType(objective.axis)
  const pace = `${Math.ceil(input.dailyPace)} ${type.unitLabel.many} por dia`

  // Pausado NÃO cobra ritmo. O objetivo continua com prazo no banco, mas
  // enquanto está pausado dizer "atrasado, faça 29 por dia" é exatamente o
  // oposto do que pausar significa — e é o tipo de recado que faz a pessoa
  // arquivar em vez de pausar da próxima vez.
  if (objective.pausedAt && input.status !== 'concluido') {
    return `Pausado com ${formatUnit(type, input.done)} de ${objective.target}. Retomar devolve ele pro teu dia.`
  }

  switch (input.status) {
    case 'concluido':
      return `Objetivo fechado: ${formatUnit(type, objective.target)}.`
    case 'vencido':
      return `Prazo passou: ${formatUnit(type, input.done)} de ${objective.target}. Dá pra renovar a data.`
    case 'no-prazo':
      return input.daysLeft === 0
        ? `Último dia: faltam ${formatUnit(type, input.remaining)}.`
        : `No ritmo. Faltam ${formatUnit(type, input.remaining)}, ${pace}.`
    case 'atencao':
      return `Um pouco atrás. Pra fechar no prazo: ${pace}.`
    case 'atrasado':
      return `Atrasado. Fechar no prazo pede ${pace}. Se não cabe, mexe no prazo.`
  }
}

export function deadlineLabelOf(progress: ObjectiveProgress): string {
  if (progress.status === 'concluido') return 'Concluído'
  if (progress.daysLeft === 0) return 'Fecha hoje'
  if (progress.daysLeft === 1) return 'Falta 1 dia'
  return `Faltam ${progress.daysLeft} dias`
}

export function describeObjective(objective: Objective): string {
  const type = activityType(objective.axis)
  return `${formatUnit(type, objective.target)} até ${formatDeadline(objective.deadline)}`
}

function formatDeadline(deadline: DayKey): string {
  const [year, month, day] = deadline.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day, 12).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

/** Prazos que o onboarding oferece, em dias. */
export const DEADLINE_PRESETS: readonly { readonly days: number; readonly label: string }[] = [
  { days: 30, label: '30 dias' },
  { days: 60, label: '2 meses' },
  { days: 90, label: '3 meses' },
  { days: 180, label: '6 meses' },
]

export function deadlineFrom(today: DayKey, days: number): DayKey {
  return addDays(today, days - 1)
}
