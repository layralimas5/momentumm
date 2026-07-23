import type { MissionRepository } from '@/domain/repositories/mission-repository'
import { dayKey, shiftDay, type DayKey } from '@/domain/entities/day'

/**
 * Repositório de Missões em memória — modo demo, sem Supabase. Já vem com alguns
 * dias recentes concluídos pra sequência e XP aparecerem vivos no dashboard.
 */
export class InMemoryMissionRepository implements MissionRepository {
  private readonly byUser = new Map<string, Set<DayKey>>()

  constructor(seed: DayKey[] = defaultSeed()) {
    this.byUser.set('demo', new Set(seed))
  }

  async listCompletedDates(userId: string): Promise<DayKey[]> {
    return [...(this.byUser.get(userId) ?? new Set())].sort()
  }

  async setDone(userId: string, day: DayKey, done: boolean): Promise<void> {
    const set = this.byUser.get(userId) ?? new Set<DayKey>()
    if (done) set.add(day)
    else set.delete(day)
    this.byUser.set(userId, set)
  }
}

function defaultSeed(): DayKey[] {
  const today = dayKey()
  // Últimos dias concluídos (com um furo em -3, pra não parecer perfeito demais).
  return [0, 1, 2, 4, 5, 6].map((o) => shiftDay(today, -o)).sort()
}
