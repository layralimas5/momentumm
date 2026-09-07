import { DomainError } from '@/shared/errors'
import type { DayKey } from './day'

/**
 * Etapa do plano: o caminho entre o objetivo e a ação.
 *
 * Sem ela o produto é um CRUD com tela bonita. "Lançar meu SaaS" não vira
 * movimento diretamente — vira Pesquisa, MVP, Landing, Beta, Lançamento, e é
 * dentro de uma dessas que a ação de hoje faz sentido. É também a etapa que
 * responde a pergunta que nenhuma lista de tarefas responde: **o que está
 * travando o objetivo**.
 *
 * ## Um plano por objetivo
 *
 * A etapa aponta direto pro objetivo, sem uma tabela `plans` no meio. Não é
 * atalho: no V1 um objetivo tem UM caminho, e uma tabela que só teria uma linha
 * por objetivo adicionaria um join em toda leitura pra representar uma escolha
 * que ninguém faz. Quando existir mais de um plano por objetivo, `objectiveId`
 * vira `planId` e o resto continua igual.
 *
 * ## O peso é o que torna o progresso honesto
 *
 * Cinco etapas não valem 20% cada só porque são cinco. O MVP pesa mais que a
 * pesquisa, e é o peso que faz "31% do objetivo" significar alguma coisa em vez
 * de ser uma barra que anda sozinha. Os pesos somam 100 — sempre, e o domínio
 * recusa qualquer conjunto que não some.
 */

export const MAX_STAGE_TITLE = 80
export const MAX_STAGE_DESCRIPTION = 400
/** Mais que isso não é plano, é lista de tarefas com outro nome. */
export const MAX_STAGES_PER_OBJECTIVE = 12
export const TOTAL_WEIGHT = 100

/**
 * Estados que a PESSOA controla. `atrasada` não está aqui de propósito: ela é
 * derivada da data prevista, e guardar um estado que o calendário já responde
 * abriria a porta pra uma etapa marcada "atrasada" com prazo lá na frente — o
 * tipo de contradição que o app não pode mostrar. Mesma decisão que
 * `ObjectiveState` versus `ObjectiveStatus`.
 */
export const STAGE_STATUSES = ['nao-iniciada', 'em-andamento', 'concluida', 'pausada'] as const
export type StageStatus = (typeof STAGE_STATUSES)[number]

/** O que a tela mostra: os estados guardados mais o atraso, que é calculado. */
export const STAGE_VIEW_STATUSES = [...STAGE_STATUSES, 'atrasada'] as const
export type StageViewStatus = (typeof STAGE_VIEW_STATUSES)[number]

export const STAGE_STATUS_LABELS: Readonly<Record<StageViewStatus, string>> = {
  'nao-iniciada': 'Não iniciada',
  'em-andamento': 'Em andamento',
  concluida: 'Concluída',
  pausada: 'Pausada',
  atrasada: 'Atrasada',
}

export interface PlanStage {
  readonly id: string
  readonly userId: string
  readonly objectiveId: string
  readonly title: string
  readonly description: string | null
  /** Posição no caminho. Menor vem primeiro. */
  readonly order: number
  /** Quanto essa etapa vale do objetivo, de 0 a 100. O conjunto soma 100. */
  readonly weight: number
  readonly status: StageStatus
  /** Data prevista de conclusão. Opcional: nem toda etapa tem data própria. */
  readonly dueOn: DayKey | null
  readonly completedAt: Date | null
  readonly createdAt: Date
}

export interface NewPlanStageInput {
  readonly userId: string
  readonly objectiveId: string
  readonly title: string
  readonly description?: string | null
  readonly order?: number
  readonly weight?: number
  readonly status?: StageStatus
  readonly dueOn?: DayKey | null
}

export function createPlanStage(
  input: NewPlanStageInput,
  id: string,
  now = new Date(),
): PlanStage {
  const title = input.title.trim()
  if (title.length < 2) {
    throw new DomainError('Escreve a etapa com pelo menos 2 letras.')
  }
  if (title.length > MAX_STAGE_TITLE) {
    throw new DomainError(`A etapa pode ter no máximo ${MAX_STAGE_TITLE} caracteres.`)
  }

  const description = input.description?.trim() || null
  if (description && description.length > MAX_STAGE_DESCRIPTION) {
    throw new DomainError(
      `A descrição da etapa pode ter no máximo ${MAX_STAGE_DESCRIPTION} caracteres.`,
    )
  }

  if (!input.objectiveId) {
    throw new DomainError('Toda etapa precisa pertencer a um objetivo.')
  }

  return {
    id,
    userId: input.userId,
    objectiveId: input.objectiveId,
    title,
    description,
    order: input.order ?? 0,
    weight: normalizeWeight(input.weight ?? 0),
    status: input.status ?? 'nao-iniciada',
    dueOn: input.dueOn ?? null,
    completedAt: null,
    createdAt: now,
  }
}

function normalizeWeight(value: number): number {
  const rounded = Math.round(value)
  if (!Number.isFinite(rounded) || rounded < 0) {
    throw new DomainError('O peso da etapa não pode ser negativo.')
  }
  if (rounded > TOTAL_WEIGHT) {
    throw new DomainError(`O peso de uma etapa vai de 0 a ${TOTAL_WEIGHT}.`)
  }
  return rounded
}

export function stagesOfObjective(
  stages: readonly PlanStage[],
  objectiveId: string,
): PlanStage[] {
  return stages
    .filter((stage) => stage.objectiveId === objectiveId)
    .sort((a, b) => a.order - b.order)
}

/**
 * Distribui 100 entre N etapas, sem sobra e sem falta.
 *
 * O resto da divisão vai pras primeiras etapas em vez de virar uma etapa final
 * com peso quebrado: quem olha 34/33/33 entende na hora, quem olha 33/33/34 fica
 * procurando o motivo do último ser diferente.
 */
export function distributeWeights(count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(TOTAL_WEIGHT / count)
  const remainder = TOTAL_WEIGHT - base * count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

/**
 * Reaplica pesos equilibrados numa lista de etapas, preservando a ordem.
 * É o que roda quando a pessoa cria ou apaga uma etapa sem ter mexido nos
 * pesos: o conjunto continua somando 100 sozinho.
 */
export function rebalanceWeights(stages: readonly PlanStage[]): PlanStage[] {
  const ordered = [...stages].sort((a, b) => a.order - b.order)
  const weights = distributeWeights(ordered.length)
  return ordered.map((stage, index) => ({
    ...stage,
    order: index,
    weight: weights[index] ?? 0,
  }))
}

/** A soma dos pesos. Serve pra tela avisar antes de o domínio recusar. */
export function totalWeightOf(stages: readonly PlanStage[]): number {
  return stages.reduce((sum, stage) => sum + stage.weight, 0)
}

export function weightsAreComplete(stages: readonly PlanStage[]): boolean {
  return stages.length === 0 || totalWeightOf(stages) === TOTAL_WEIGHT
}

/**
 * Recusa um conjunto de pesos que não fecha 100.
 *
 * Deixar passar 90 ou 110 é o mesmo que mentir na barra de progresso: um
 * objetivo inteiramente concluído mostraria 90%, e o outro passaria de 100%.
 */
export function assertWeightsComplete(stages: readonly PlanStage[]): void {
  if (weightsAreComplete(stages)) return
  const total = totalWeightOf(stages)
  throw new DomainError(
    total > TOTAL_WEIGHT
      ? `Os pesos das etapas somam ${total}%. Tira ${total - TOTAL_WEIGHT} de algum lugar pra fechar 100%.`
      : `Os pesos das etapas somam ${total}%. Faltam ${TOTAL_WEIGHT - total}% pra fechar o plano.`,
  )
}

export function assertStageBelongsTo(stage: PlanStage, objectiveId: string): void {
  if (stage.objectiveId !== objectiveId) {
    throw new DomainError('Essa etapa é de outro objetivo.')
  }
}

/** Etapa que ainda cobra movimento. Concluída e pausada saem da fila do dia. */
export function isStageRunning(stage: PlanStage): boolean {
  return stage.status === 'nao-iniciada' || stage.status === 'em-andamento'
}

/**
 * O estado que a tela mostra. `atrasada` entra quando a data prevista passou e
 * a etapa não fechou — e nunca por cima de pausada, porque pausar é justamente
 * dizer "para de me cobrar prazo".
 */
export function viewStatusOf(stage: PlanStage, today: DayKey): StageViewStatus {
  if (stage.status === 'concluida' || stage.status === 'pausada') return stage.status
  if (stage.dueOn && stage.dueOn < today) return 'atrasada'
  return stage.status
}

export function completeStage(stage: PlanStage, now = new Date()): PlanStage {
  return { ...stage, status: 'concluida', completedAt: now }
}

export function reopenStage(stage: PlanStage): PlanStage {
  return { ...stage, status: 'em-andamento', completedAt: null }
}

/**
 * Datas previstas distribuídas ao longo do prazo do objetivo, proporcionais ao
 * peso. Uma etapa de 35% ocupa 35% do calendário — é a única distribuição que a
 * pessoa consegue conferir de cabeça, e ela pode mexer depois.
 */
export function suggestDueDates(
  stages: readonly PlanStage[],
  startedOn: DayKey,
  deadline: DayKey,
  addDaysFn: (day: DayKey, amount: number) => DayKey,
  daysBetweenFn: (from: DayKey, to: DayKey) => number,
): DayKey[] {
  const totalDays = Math.max(1, daysBetweenFn(startedOn, deadline))
  const total = totalWeightOf(stages) || TOTAL_WEIGHT

  let consumed = 0
  return stages.map((stage, index) => {
    consumed += stage.weight
    const isLast = index === stages.length - 1
    if (isLast) return deadline
    return addDaysFn(startedOn, Math.max(1, Math.round((consumed / total) * totalDays)))
  })
}
