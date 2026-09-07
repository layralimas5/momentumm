import type { CircleFeedItem } from '@/domain/entities/circle-feed'
import type {
  JourneyEvent,
  JourneyVisibility,
  NewJourneyEventInput,
} from '@/domain/entities/journey-event'

export interface JourneyEventRepository {
  listByUser(userId: string): Promise<JourneyEvent[]>

  /**
   * O que os amigos escolheram mostrar.
   *
   * A montagem do item — evento, autor e contagem de apoio — acontece na
   * infraestrutura porque é lá que uma consulta só resolve o que seriam três
   * viagens ao banco. O filtro por tipo continua no domínio.
   */
  listCircleFeed(userId: string): Promise<CircleFeedItem[]>

  /** Momentos de um amigo específico, os que ele compartilhou. */
  listByAuthor(userId: string, authorId: string): Promise<CircleFeedItem[]>

  /**
   * Muda o alcance de um momento. É a ÚNICA porta pra um evento deixar de ser
   * privado, e ela existe só onde a pessoa toca — nada aqui acontece sozinho.
   */
  setVisibility(id: string, userId: string, visibility: JourneyVisibility): Promise<JourneyEvent>

  /** Apoio: uma reação por pessoa por momento. Ligar de novo desliga. */
  support(eventId: string, userId: string, supported: boolean): Promise<void>
  /**
   * Grava o momento.
   *
   * Idempotente por (tipo, origem, dia): desmarcar e remarcar o último hábito
   * do dia não pode gerar três "dia concluído". Regravar atualiza a linha
   * existente em vez de criar outra.
   */
  record(input: NewJourneyEventInput): Promise<JourneyEvent>
}
