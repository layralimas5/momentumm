import type { ProfileRepository } from '@/domain/repositories/profile-repository'
import type { Profile, SubscriptionStatus } from '@/domain/entities/profile'

/**
 * Perfis em memória — modo demo. A usuária "demo" é admin + ativa, então você
 * navega tanto o app quanto o admin localmente. NÃO persiste entre reloads.
 */
export class InMemoryProfileRepository implements ProfileRepository {
  private profiles: Profile[]

  constructor(seed: Profile[] = defaultSeed()) {
    this.profiles = [...seed]
  }

  async getMine(userId: string): Promise<Profile | null> {
    return this.profiles.find((p) => p.id === userId) ?? null
  }

  async listAll(): Promise<Profile[]> {
    return [...this.profiles]
  }

  async setStatus(id: string, status: SubscriptionStatus): Promise<Profile> {
    const profile = this.profiles.find((p) => p.id === id)
    if (!profile) throw new Error(`Perfil ${id} não encontrado`)
    profile.subscriptionStatus = status
    return profile
  }
}

function defaultSeed(): Profile[] {
  const at = (daysAgo: number) => {
    // Datas fixas relativas (sem Date.now em runtime de app tudo bem, mas mantemos simples).
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    return d.toISOString()
  }
  return [
    {
      id: 'demo',
      email: 'voce@aura.app',
      role: 'admin',
      subscriptionStatus: 'active',
      plan: 'founder',
      createdAt: at(30),
    },
    {
      id: 'seed-user-1',
      email: 'ana@exemplo.com',
      role: 'user',
      subscriptionStatus: 'active',
      plan: 'annual',
      createdAt: at(12),
    },
    {
      id: 'seed-user-2',
      email: 'bruna@exemplo.com',
      role: 'user',
      subscriptionStatus: 'active',
      plan: 'monthly',
      createdAt: at(6),
    },
    {
      id: 'seed-user-3',
      email: 'carla@exemplo.com',
      role: 'user',
      subscriptionStatus: 'pending',
      plan: null,
      createdAt: at(2),
    },
    {
      id: 'seed-user-4',
      email: 'duda@exemplo.com',
      role: 'user',
      subscriptionStatus: 'canceled',
      plan: 'monthly',
      createdAt: at(40),
    },
  ]
}
