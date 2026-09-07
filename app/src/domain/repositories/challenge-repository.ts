import type {
  Challenge,
  ChallengeParticipant,
  NewChallengeInput,
} from '@/domain/entities/challenge'

export interface ChallengeUpdate {
  readonly name?: string
  readonly description?: string | null
  readonly completedAt?: Date | null
  readonly archivedAt?: Date | null
}

/**
 * Desafios e participações.
 *
 * A leitura traz os desafios em que a pessoa aparece de qualquer forma — dona,
 * participando ou apenas convidada — porque as três importam na tela, e porque
 * é a RLS que define o alcance: nenhum desafio de estranho chega aqui pra ser
 * filtrado depois.
 */
export interface ChallengeRepository {
  listByUser(userId: string): Promise<Challenge[]>

  /**
   * Os participantes dos desafios informados, em uma viagem só.
   *
   * Uma consulta por desafio faria dez desafios virarem dez idas ao banco pra
   * montar uma tela que mostra os dez juntos.
   */
  listParticipants(challengeIds: readonly string[]): Promise<ChallengeParticipant[]>

  /** Cria o desafio já com o dono dentro: desafio sem dono participando é lista. */
  create(input: NewChallengeInput): Promise<{
    readonly challenge: Challenge
    readonly participant: ChallengeParticipant
  }>

  update(id: string, ownerId: string, changes: ChallengeUpdate): Promise<Challenge>

  /** Convida alguém. Só o dono, e só quem já é amigo dele no Círculo. */
  invite(challengeId: string, ownerId: string, userId: string): Promise<ChallengeParticipant>

  /** Aceitar ou recusar o convite. Só quem foi convidado responde. */
  respond(participantId: string, userId: string, accept: boolean): Promise<ChallengeParticipant>

  /** Sair. O dono não sai do próprio desafio: ele encerra. */
  leave(participantId: string, userId: string): Promise<void>

  /** Vincula (ou desvincula) o hábito que move o progresso dessa pessoa. */
  setHabit(
    participantId: string,
    userId: string,
    habitId: string | null,
  ): Promise<ChallengeParticipant>

  /**
   * Publica os dias fechados.
   *
   * É o único número que atravessa a fronteira entre duas pessoas, e quem o
   * escreve é sempre o dono da linha — o cliente recalcula a partir dos
   * próprios hábitos e atividades, que ninguém mais consegue ler.
   */
  publishProgress(
    participantId: string,
    userId: string,
    doneDays: number,
    completed: boolean,
  ): Promise<ChallengeParticipant>
}
