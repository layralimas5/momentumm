import type { Club, ClubMember, ClubRankedMember, NewClubInput } from '@/domain/entities/club'

/**
 * Os clubes.
 *
 * `create` não recebe o dono: quem cria é sempre a sessão atual, e o servidor
 * é quem confere a assinatura. Uma assinatura que aceitasse `ownerId` seria um
 * convite a passar o id de outra pessoa — e a checagem passaria a depender de
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
  join(clubId: string, userId: string): Promise<void>
  leave(clubId: string, userId: string): Promise<void>
}
