/**
 * De onde a conta veio.
 *
 * Uma escrita só, e ela não recebe quem convidou: recebe o CÓDIGO e deixa o
 * servidor resolver. É o que impede alguém de gravar "fulano me convidou"
 * escolhendo o id de qualquer pessoa, e é também o que mantém as regras
 * (conta nova, uma vez só, nunca a si mesma) num lugar só, no banco.
 */
export interface ReferralRepository {
  /** Registra a origem da conta atual. `false` quando a regra não deixou. */
  register(inviteCode: string): Promise<boolean>
  /** Quantas pessoas entraram pelo convite desta conta. */
  countInvited(userId: string): Promise<number>
}
