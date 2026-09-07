import type { DayKey } from '@/domain/entities/day'
import type { NewPlanStageInput, PlanStage, StageStatus } from '@/domain/entities/plan-stage'

export type PlanStageUpdate = Partial<{
  readonly title: string
  readonly description: string | null
  readonly order: number
  readonly weight: number
  readonly status: StageStatus
  readonly dueOn: DayKey | null
  readonly completedAt: Date | null
}>

export interface PlanStageReweight {
  readonly id: string
  readonly order: number
  readonly weight: number
}

export interface PlanStageRepository {
  listByUser(userId: string): Promise<PlanStage[]>
  create(input: NewPlanStageInput): Promise<PlanStage>
  update(id: string, userId: string, changes: PlanStageUpdate): Promise<PlanStage>
  /**
   * Reordena e repesa várias etapas de uma vez.
   *
   * É uma operação só porque peso é uma propriedade do CONJUNTO: os pesos
   * precisam somar 100 o tempo todo, e salvar etapa por etapa deixaria o plano
   * somando 80 no meio do caminho — visível na tela de quem estiver com o app
   * aberto em outro dispositivo.
   */
  reweight(userId: string, items: readonly PlanStageReweight[]): Promise<void>
  /**
   * Apaga a etapa. As ações dela NÃO são apagadas junto: elas voltam pro
   * objetivo sem etapa, onde a pessoa decide o destino. Apagar trabalho junto
   * com uma organização é a forma mais rápida de alguém perder confiança no app.
   */
  remove(id: string, userId: string): Promise<void>
}
