import type { ActivityType } from '@/domain/entities/activity-type'

export interface NewCustomAxisInput {
  readonly userId: string
  readonly label: string
  /** Posição entre as áreas já criadas pela conta. Define a cor. */
  readonly order: number
}

/**
 * Os eixos que a conta criou. Os de fábrica não passam por aqui: eles são
 * conhecidos em tempo de compilação e não dependem de rede pra existir.
 */
export interface ActivityTypeRepository {
  listCustom(userId: string): Promise<ActivityType[]>
  createCustom(input: NewCustomAxisInput): Promise<ActivityType>
}
