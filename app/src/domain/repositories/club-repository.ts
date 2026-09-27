import type { Club, ClubMember, ClubRankedMember, NewClubInput } from '@/domain/entities/club'
import type { ClubInvitation, ClubInvitePreview } from '@/domain/entities/club-invite'

/**
 * Os clubes.
 *
 * `create` não recebe o dono: quem cria é sempre a sessão atual, e o servidor
 * é quem confere a assinatura. Uma assinatura que aceitasse `ownerId` seria um
 * convite a passar o id de outra pessoa, e a checagem passaria a depender de
 * quem chama.
 *
 * `ranking` devolve nome e avatar junto com o número porque a política de
 * perfis não deixa ler perfil alheio fechado, e um ranking de uuids não é um
 * ranking. Quem monta é uma função de retorno estreito, no banco.
 */
export interface ClubRepository {
  /** Os clubes de que a pessoa participa, incluindo os que ela criou. */
  listMine(userId: string): Promise<Club[]>
  /** Clubes abertos, pra descoberta. Nunca os de convite. */
  listOpen(limit?: number): Promise<Club[]>
  findById(id: string): Promise<Club | null>
  listMembers(clubId: string): Promise<ClubMember[]>
  ranking(clubId: string): Promise<ClubRankedMember[]>
  /** Cria e já coloca o dono dentro. Recusa quem não tem PRO. */
  create(input: NewClubInput): Promise<Club>
  update(id: string, changes: Partial<NewClubInput>): Promise<Club>
  archive(id: string): Promise<void>
  /**
   * Coloca alguém dentro do clube.
   *
   * Serve às duas portas, e quem decide qual vale é a política do banco: a
   * pessoa entrando sozinha passa o PRÓPRIO id (e isso só é aceito em clube
   * aberto), e o dono passa o id de quem ele chamou (e isso exige assinatura).
   * Um método por porta daria dois caminhos escrevendo na mesma tabela com a
   * mesma regra, e a regra mora no banco, não aqui.
   */
  join(clubId: string, userId: string): Promise<void>
  leave(clubId: string, userId: string): Promise<void>

  /**
   * Chama pro clube quem já tem conta aqui.
   *
   * Não coloca ninguém dentro: cria um convite pendente, que vira aviso pra
   * pessoa. É o contrário de `join` com o id do outro, que era a única forma
   * que existia antes, e que dispensava o sim de quem entrava.
   */
  invite(clubId: string, userId: string): Promise<void>
  /** Os convites esperando resposta desta pessoa, com nome do clube e de quem chamou. */
  listMyInvitations(): Promise<ClubInvitation[]>
  /** Aceitar entra no clube; recusar só responde. Os dois encerram o aviso. */
  respondInvitation(invitationId: string, accept: boolean): Promise<void>

  /**
   * O token do link do clube. Cria na primeira vez e devolve o mesmo depois.
   *
   * `rotate` mata o anterior e gera outro, que é o que se faz quando o link
   * chegou onde não devia.
   */
  inviteToken(clubId: string, rotate?: boolean): Promise<string>
  /** O que quem abre o link vê antes de entrar. Funciona sem sessão. */
  previewInvite(token: string): Promise<ClubInvitePreview>
  /** Entra pelo link, inclusive em clube por convite. Devolve o id do clube. */
  joinByToken(token: string): Promise<string>
}
