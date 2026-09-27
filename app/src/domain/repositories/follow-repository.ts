import type { Follow, FollowCounts, NewFollowInput } from '@/domain/entities/follow'

/**
 * Seguir e deixar de seguir, e as duas contagens do perfil.
 *
 * As contagens vêm juntas de propósito: a tela mostra as duas lado a lado, e
 * duas chamadas pra encher uma linha só seriam duas idas ao servidor pra
 * responder a mesma pergunta.
 *
 * Nada aqui devolve a LISTA de quem segue. Enquanto não existir a tela que
 * mostra essa lista, um método que a traga é superfície aberta sem uso — e o
 * dia em que ela existir, a pergunta sobre quem pode ver o quê vai precisar ser
 * respondida de novo, com calma.
 */
export interface FollowRepository {
  counts(userId: string): Promise<FollowCounts>
  isFollowing(followerId: string, followingId: string): Promise<boolean>
  follow(input: NewFollowInput): Promise<Follow>
  /** Desfaz. Quem segue e quem é seguido podem chamar. */
  unfollow(followerId: string, followingId: string): Promise<void>
}
