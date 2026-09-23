import type {
  EncouragementKind,
  InvitePreview,
  Pair,
  PairInvite,
} from '@/domain/entities/pair'

/**
 * A dupla, pelo lado do app.
 *
 * Todo método aqui vira uma função do banco, nunca um `select` numa tabela. É
 * o que faz o contrato de privacidade ser verificável: a superfície inteira do
 * Juntos são seis chamadas, e cada uma delas tem o que devolve escrito na
 * migration 0049.
 *
 * Repare no que NÃO existe: nenhum método aceita o id da outra pessoa. Mandar
 * incentivo não pergunta pra quem — numa dupla só existe uma resposta, e
 * deixar o app escolher seria abrir a porta pra mandar reação pra quem não é
 * do par.
 */
export interface PairRepository {
  /** A dupla e o estado de hoje. Null quando a pessoa não tem dupla. */
  load(): Promise<Pair | null>
  /** Cria o convite e devolve o token em claro — a única vez que ele existe. */
  createInvite(): Promise<PairInvite>
  /** O que mostrar na tela de convite, antes de aceitar. Funciona sem sessão. */
  previewInvite(token: string): Promise<InvitePreview>
  /** Aceita e devolve o id da dupla criada. */
  acceptInvite(token: string): Promise<string>
  declineInvite(token: string): Promise<void>
  sendEncouragement(kind: EncouragementKind): Promise<void>
  /** Marca como lidos os incentivos recebidos. */
  markRead(ids: readonly string[]): Promise<void>
  /** Desfaz a dupla — para os dois lados. */
  leave(): Promise<void>
}
