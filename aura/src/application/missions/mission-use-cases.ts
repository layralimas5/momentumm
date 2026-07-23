import type { MissionRepository } from '@/domain/repositories/mission-repository'
import { MissionRules } from '@/domain/entities/mission'
import type { DayKey } from '@/domain/entities/day'

/**
 * Casos de uso das Missões. Orquestram regra de domínio + repositório, sem
 * conhecer UI nem banco. Recebem o port por injeção de dependência.
 */
export function createMissionUseCases(repo: MissionRepository) {
  return {
    listCompletedDates(userId: string): Promise<DayKey[]> {
      return repo.listCompletedDates(userId)
    },

    /** Alterna a conclusão da missão no dia informado. */
    async setDone(
      userId: string,
      day: DayKey,
      completedDates: readonly DayKey[],
    ): Promise<void> {
      const done = MissionRules.isDoneOn(completedDates, day)
      await repo.setDone(userId, day, !done)
    },
  }
}

export type MissionUseCases = ReturnType<typeof createMissionUseCases>
