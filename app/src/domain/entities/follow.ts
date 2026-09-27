import { DomainError } from '@/shared/errors'

/**
 * Seguir.
 *
 * Uma relação de UMA VIA: A segue B sem que B precise fazer nada. É o oposto
 * da amizade (`friendship.ts`), que é combinada dos dois lados, e as duas
 * convivem de propósito, elas respondem perguntas diferentes:
 *
 *   amizade   "a gente combinou de se acompanhar", dá acesso ao perfil de
 *             quem escolheu `amigos` como visibilidade.
 *   seguir    "eu quero ver o que essa pessoa publica", não pede licença, não
 *             dá acesso a nada que já não fosse público.
 *
 * A segunda frase é a regra inteira de privacidade daqui: seguir alguém NÃO
 * abre nada. Quem tem perfil privado continua privado pra quem segue, e o
 * número de seguidores não é uma porta, é uma contagem.
 *
 * Uma linha por direção. "A e B se seguem" são duas linhas, e é isso que
 * permite que uma delas acabe sem mexer na outra.
 */

export interface Follow {
  /** Quem segue. */
  readonly followerId: string
  /** Quem é seguido. */
  readonly followingId: string
  readonly createdAt: Date
}

export interface FollowCounts {
  readonly followers: number
  readonly following: number
}

export const EMPTY_FOLLOW_COUNTS: FollowCounts = { followers: 0, following: 0 }

export interface NewFollowInput {
  readonly followerId: string
  readonly followingId: string
}

export function createFollow(input: NewFollowInput): Follow {
  assertCanFollow(input.followerId, input.followingId)

  return {
    followerId: input.followerId,
    followingId: input.followingId,
    createdAt: new Date(),
  }
}

/**
 * Seguir a si mesmo infla o próprio número e não significa nada. A regra mora
 * aqui e também no banco (constraint), porque validação de tela é conveniência
 * e constraint é garantia.
 */
export function assertCanFollow(followerId: string, followingId: string): void {
  if (followerId === followingId) {
    throw new DomainError('Você não pode seguir você mesmo.')
  }
}

/** O rótulo no singular quando é um só: "1 seguidor", "132 seguidores". */
export function followersLabel(count: number): string {
  return count === 1 ? 'Seguidor' : 'Seguidores'
}
