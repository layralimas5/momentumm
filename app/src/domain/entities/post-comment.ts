import { DomainError } from '@/shared/errors'

/**
 * O comentário.
 *
 * Sem thread nesta versão, e é uma escolha: resposta aninhada muda o desenho
 * da tela, a paginação e a notificação, e nada disso se decide bem antes de
 * existir conversa de verdade acontecendo.
 *
 * Também não se edita. Comentário alterado depois de respondido é a fonte do
 * mal-entendido, e apagar e escrever de novo é uma ação que a outra pessoa
 * consegue perceber.
 */

export const MAX_COMMENT_LENGTH = 500

export interface PostComment {
  readonly id: string
  readonly postId: string
  readonly author: {
    readonly id: string
    readonly name: string
    readonly handle: string
    readonly avatarUrl: string | null
  }
  readonly body: string
  readonly createdAt: Date
  /** Escrito por mim. */
  readonly mine: boolean
  /**
   * Meu, ou de uma publicação minha. A segunda metade é a moderação mínima:
   * sem ela, tirar um comentário indesejado exigiria apagar a publicação
   * inteira. Quem decide de verdade é a RLS; isto é o que a tela desenha.
   */
  readonly canDelete: boolean
}

export function assertValidComment(body: string): void {
  const trimmed = body.trim()
  if (trimmed.length === 0) {
    throw new DomainError('Escreve alguma coisa antes de enviar.')
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new DomainError(`O comentário pode ter no máximo ${MAX_COMMENT_LENGTH} caracteres.`)
  }
}

/** "1 comentário" / "12 comentários". O plural certo, num lugar só. */
export function commentsLabel(count: number): string {
  return count === 1 ? '1 comentário' : `${count} comentários`
}

export function likesLabel(count: number): string {
  return count === 1 ? '1 curtida' : `${count} curtidas`
}
