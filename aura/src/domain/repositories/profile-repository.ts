import type { Profile, SubscriptionStatus } from '@/domain/entities/profile'

/**
 * Port do repositório de Perfis. A aplicação depende dessa interface.
 * As operações de listagem/alteração de status são de uso administrativo
 * (protegidas por RLS no banco).
 */
export interface ProfileRepository {
  /** Perfil da usuária logada. */
  getMine(userId: string): Promise<Profile | null>
  /** Admin: todas as contas. */
  listAll(): Promise<Profile[]>
  /** Admin: liberar/bloquear/cancelar uma conta. */
  setStatus(id: string, status: SubscriptionStatus): Promise<Profile>
}
