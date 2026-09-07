import { DomainError } from '@/shared/errors'

/**
 * A amizade.
 *
 * Uma linha por par, com lado de quem pediu e lado de quem recebeu. Não são
 * duas linhas espelhadas: com duas, aceitar teria que escrever nas duas e
 * qualquer falha no meio deixaria o par em desacordo consigo mesmo — A achando
 * que são amigos e B não.
 *
 * Por isso "quem é meu amigo" é sempre uma pergunta sobre o OUTRO LADO da
 * linha, e nunca sobre uma coluna fixa. Toda leitura passa por `otherSideOf`.
 *
 * Amizade aqui é simétrica de propósito. Seguidor é uma relação de uma via e
 * traz junto tudo que o produto não quer agora: audiência, alcance e a
 * pergunta "quantos me seguem". Amigo é combinado dos dois lados.
 */

export const FRIENDSHIP_STATUSES = ['pendente', 'aceita', 'recusada'] as const
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number]

export interface Friendship {
  readonly id: string
  /** Quem enviou o pedido. */
  readonly requesterId: string
  /** Quem recebeu, e é o único que pode aceitar ou recusar. */
  readonly addresseeId: string
  readonly status: FriendshipStatus
  readonly createdAt: Date
  readonly respondedAt: Date | null
}

export interface NewFriendshipInput {
  readonly requesterId: string
  readonly addresseeId: string
}

export function createFriendship(input: NewFriendshipInput, id: string): Friendship {
  if (input.requesterId === input.addresseeId) {
    throw new DomainError('Você não pode adicionar você mesmo.')
  }

  return {
    id,
    requesterId: input.requesterId,
    addresseeId: input.addresseeId,
    status: 'pendente',
    createdAt: new Date(),
    respondedAt: null,
  }
}

/** O outro lado da linha, seja qual for a ponta em que a pessoa está. */
export function otherSideOf(friendship: Friendship, userId: string): string {
  return friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId
}

export function involves(friendship: Friendship, userId: string): boolean {
  return friendship.requesterId === userId || friendship.addresseeId === userId
}

export function isAccepted(friendship: Friendship): boolean {
  return friendship.status === 'aceita'
}

/** Pedido esperando a MINHA resposta. */
export function isIncoming(friendship: Friendship, userId: string): boolean {
  return friendship.status === 'pendente' && friendship.addresseeId === userId
}

/** Pedido que EU enviei e ainda não foi respondido. */
export function isOutgoing(friendship: Friendship, userId: string): boolean {
  return friendship.status === 'pendente' && friendship.requesterId === userId
}

/** Os ids de quem já é amigo de verdade. É o filtro do feed do Círculo. */
export function friendIdsOf(friendships: readonly Friendship[], userId: string): string[] {
  return friendships
    .filter((friendship) => isAccepted(friendship) && involves(friendship, userId))
    .map((friendship) => otherSideOf(friendship, userId))
}

/**
 * Em que pé está a relação com alguém.
 *
 * A tela de busca depende disso pra saber que botão mostrar: adicionar,
 * "pedido enviado", "responder" ou "já é seu amigo". Sem um único lugar
 * decidindo isso, cada tela inventa a própria interpretação dos mesmos dados.
 */
export type Relation =
  | 'voce'
  | 'nenhuma'
  | 'pedido-enviado'
  | 'pedido-recebido'
  | 'amigos'
  | 'recusada'

export function relationWith(
  friendships: readonly Friendship[],
  userId: string,
  otherId: string,
): Relation {
  if (userId === otherId) return 'voce'

  const found = friendships.find(
    (friendship) => involves(friendship, userId) && otherSideOf(friendship, userId) === otherId,
  )
  if (!found) return 'nenhuma'

  if (found.status === 'aceita') return 'amigos'
  if (found.status === 'recusada') return 'recusada'
  return found.addresseeId === userId ? 'pedido-recebido' : 'pedido-enviado'
}
