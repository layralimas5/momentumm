import type {
  EncouragementKind,
  InvitePreview,
  PairInvite,
  PairOverview,
} from '@/domain/entities/pair'

/**
 * A dupla, pelo lado do app.
 *
 * Todo método aqui vira uma função do banco, nunca um `select` numa tabela. É
 * o que faz o contrato de privacidade ser verificável: a superfície inteira do
 * Juntos são seis chamadas, e cada uma delas tem o que devolve escrito na
 * migration 0049.
 *
 * Repare no que NÃO existe: nenhum método aceita o id da outra PESSOA. Mandar
 * incentivo diz em qual dupla, nunca pra quem — dentro de uma dupla só existe
 * uma resposta, e deixar o app escolher o destinatário seria abrir a porta pra
 * mandar reação pra quem não é do par.
 *
 * O id da DUPLA passou a ser obrigatório em `sendEncouragement` e `leave`
 * (0053): com várias duplas ativas, um método sem esse argumento agiria sobre
 * uma qualquer.
 */
export interface PairRepository {
  /** As duplas, o estado de hoje de cada uma e se ainda cabe outra. */
  load(): Promise<PairOverview>
  /** Cria o convite e devolve o token em claro — a única vez que ele existe. */
  createInvite(): Promise<PairInvite>
  /** O que mostrar na tela de convite, antes de aceitar. Funciona sem sessão. */
  previewInvite(token: string): Promise<InvitePreview>
  /** Aceita e devolve o id da dupla criada. */
  acceptInvite(token: string): Promise<string>
  declineInvite(token: string): Promise<void>
  sendEncouragement(pairId: string, kind: EncouragementKind): Promise<void>
  /** Marca como lidos os incentivos recebidos. */
  markRead(ids: readonly string[]): Promise<void>
  /** Desfaz UMA dupla — para os dois lados dela. */
  leave(pairId: string): Promise<void>
}
