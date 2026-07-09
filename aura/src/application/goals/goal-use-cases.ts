import type { GoalRepository } from '@/domain/repositories/goal-repository'
import { GoalRules, type Goal, type NewGoal } from '@/domain/entities/goal'

/**
 * Casos de uso de Metas. Orquestram regras de domínio + repositório, sem
 * conhecer UI nem banco. Recebem o port por injeção de dependência.
 */
export function createGoalUseCases(repo: GoalRepository) {
  return {
    list(userId: string): Promise<Goal[]> {
      return repo.listByUser(userId)
    },

    async create(userId: string, data: NewGoal): Promise<Goal> {
      if (!GoalRules.isValidTitle(data.title)) {
        throw new Error('O título da meta precisa ter entre 2 e 120 caracteres.')
      }
      return repo.create(userId, data)
    },

    setProgress(id: string, progress: number): Promise<Goal> {
      return repo.updateProgress(id, GoalRules.clampProgress(progress))
    },

    complete(id: string): Promise<Goal> {
      return repo.complete(id)
    },

    remove(id: string): Promise<void> {
      return repo.remove(id)
    },
  }
}

export type GoalUseCases = ReturnType<typeof createGoalUseCases>
