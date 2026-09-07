import type { Friendship, NewFriendshipInput } from '@/domain/entities/friendship'
import type { CircleAuthor } from '@/domain/entities/circle-feed'

/**
 * Amizades e a busca por gente.
 *
 * A busca devolve `CircleAuthor` e não `Profile` inteiro de propósito: procurar
 * alguém pra adicionar não deveria trazer visibilidade padrão, plano da conta
 * nem data de criação. O que a tela precisa é nome, @ e foto.
 */
export interface FriendshipRepository {
  /** Todas as linhas em que a pessoa aparece, de qualquer lado e em qualquer estado. */
  listByUser(userId: string): Promise<Friendship[]>
  /** Os perfis por trás dos ids. É o que dá nome e foto às linhas de amizade. */
  listPeople(ids: readonly string[]): Promise<CircleAuthor[]>
  /** Busca por nome ou @. Nunca devolve a própria pessoa. */
  search(userId: string, term: string): Promise<CircleAuthor[]>
  request(input: NewFriendshipInput): Promise<Friendship>
  /** Aceitar ou recusar. Só quem recebeu o pedido pode. */
  respond(id: string, userId: string, accept: boolean): Promise<Friendship>
  /** Desfazer a amizade ou cancelar o pedido. Os dois lados podem. */
  remove(id: string, userId: string): Promise<void>
}
