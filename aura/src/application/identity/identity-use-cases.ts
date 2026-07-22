import type { IdentityRepository } from '@/domain/repositories/identity-repository'
import { IdentityRules, type Identity, type IdentityAnswers } from '@/domain/entities/identity'

/**
 * Casos de uso da Identidade Futura. Validam que a jornada foi respondida por
 * inteiro antes de gravar, e delegam a persistência ao port.
 */
export function createIdentityUseCases(repo: IdentityRepository) {
  return {
    get(userId: string): Promise<Identity | null> {
      return repo.get(userId)
    },

    async save(userId: string, answers: IdentityAnswers): Promise<Identity> {
      if (!IdentityRules.isComplete(answers)) {
        throw new Error('Responda todas as perguntas pra desenhar sua identidade.')
      }
      return repo.save(userId, IdentityRules.trim(answers))
    },
  }
}

export type IdentityUseCases = ReturnType<typeof createIdentityUseCases>
