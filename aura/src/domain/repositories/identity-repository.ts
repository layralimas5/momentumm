import type { Identity, IdentityAnswers } from '@/domain/entities/identity'

/**
 * Port do repositório de Identidade Futura. Uma identidade por usuária (1:1).
 * A aplicação depende só desta interface, nunca do adapter concreto.
 */
export interface IdentityRepository {
  get(userId: string): Promise<Identity | null>
  /** Cria ou atualiza a identidade da usuária (upsert). */
  save(userId: string, answers: IdentityAnswers): Promise<Identity>
}
