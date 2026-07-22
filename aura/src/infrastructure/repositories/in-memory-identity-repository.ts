import type { IdentityRepository } from '@/domain/repositories/identity-repository'
import type { Identity, IdentityAnswers } from '@/domain/entities/identity'

/**
 * Repositório de Identidade em memória — modo demo, sem Supabase. Não persiste
 * entre reloads. Já vem com uma identidade de exemplo pra a jornada ser visível.
 */
export class InMemoryIdentityRepository implements IdentityRepository {
  private byUser = new Map<string, Identity>()

  constructor(seed: Identity[] = defaultSeed()) {
    for (const identity of seed) this.byUser.set(identity.userId, identity)
  }

  async get(userId: string): Promise<Identity | null> {
    return this.byUser.get(userId) ?? null
  }

  async save(userId: string, answers: IdentityAnswers): Promise<Identity> {
    const existing = this.byUser.get(userId)
    const now = new Date().toISOString()
    const identity: Identity = {
      userId,
      ...answers,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    this.byUser.set(userId, identity)
    return identity
  }
}

function defaultSeed(): Identity[] {
  const now = new Date().toISOString()
  return [
    {
      userId: 'demo',
      becoming: 'a mulher que cuida de si com constância e calma',
      morning: 'cedo e sem pressa, com um copo d’água e 10 minutos de silêncio',
      dressing: 'com intenção — roupas que a fazem sentir poderosa, mesmo em casa',
      daily: 'treina, lê alguns minutos e escreve no diário',
      neverAgain: 'se abandona quando a rotina aperta',
      createdAt: now,
      updatedAt: now,
    },
  ]
}
