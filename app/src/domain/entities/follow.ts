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
 * ## O que mudou quando o feed entrou (migrations 0067 e 0068)
 *
 * Quando `follows` nasceu (0060), seguir NÃO abria nada: era contagem, e o
 * comentário aqui dizia isso com todas as letras. Com o feed, seguir passou a
 * ser a porta do conteúdo — sem ele não existe feed — e o que entrou junto foi
 * o PEDIDO DE APROVAÇÃO: perfil aberto aceita na hora, perfil fechado
 * responde. Sem essa segunda metade, abrir o feed teria transformado toda
 * conta fechada em conta aberta sem ninguém escolher isso.
 *
 * O estado do laço (segue, pediu, me segue, bloqueei) mora em
 * `social-graph.ts`, porque é outra coisa: aqui está a LINHA, lá está o que a
 * tela precisa saber pra desenhar um botão.
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

/** Os dois lados de um par, como o `demo-store` os conta. */
export interface FollowCounts {
  readonly followers: number
  readonly following: number
}

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
