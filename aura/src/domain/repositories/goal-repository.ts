import type { Goal, NewGoal } from '@/domain/entities/goal'

/**
 * Port do repositório de Metas. A camada de aplicação depende dessa interface,
 * nunca de uma implementação concreta (Supabase, memória, etc.).
 * Regra de dependência: aponta pra dentro (domínio).
 */
export interface GoalRepository {
  listByUser(userId: string): Promise<Goal[]>
  create(userId: string, data: NewGoal): Promise<Goal>
  updateProgress(id: string, progress: number): Promise<Goal>
  complete(id: string): Promise<Goal>
  remove(id: string): Promise<void>
}
