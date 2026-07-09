import type { ProfileRepository } from '@/domain/repositories/profile-repository'
import type { Profile, SubscriptionStatus } from '@/domain/entities/profile'

export interface AdminMetrics {
  total: number
  active: number
  pending: number
  canceled: number
  blocked: number
  /** Receita mensal recorrente estimada (R$), somando planos das contas ativas. */
  estimatedMrr: number
}

/** Preço mensal equivalente por plano (R$) — pra estimar MRR no admin. */
const MONTHLY_EQUIVALENT: Record<string, number> = {
  founder: 14.9,
  monthly: 29.9,
  quarterly: 23.3,
  annual: 14.99,
}

export function createProfileUseCases(repo: ProfileRepository) {
  return {
    getMine(userId: string): Promise<Profile | null> {
      return repo.getMine(userId)
    },

    adminList(): Promise<Profile[]> {
      return repo.listAll()
    },

    adminSetStatus(id: string, status: SubscriptionStatus): Promise<Profile> {
      return repo.setStatus(id, status)
    },

    async adminMetrics(): Promise<AdminMetrics> {
      const all = await repo.listAll()
      const count = (s: SubscriptionStatus) => all.filter((p) => p.subscriptionStatus === s).length
      const estimatedMrr = all
        .filter((p) => p.subscriptionStatus === 'active')
        .reduce((sum, p) => sum + (p.plan ? (MONTHLY_EQUIVALENT[p.plan] ?? 0) : 0), 0)

      return {
        total: all.length,
        active: count('active'),
        pending: count('pending'),
        canceled: count('canceled'),
        blocked: count('blocked'),
        estimatedMrr: Math.round(estimatedMrr * 100) / 100,
      }
    },
  }
}

export type ProfileUseCases = ReturnType<typeof createProfileUseCases>
