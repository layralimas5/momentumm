import type { JourneyEvent, NewJourneyEventInput } from '@/domain/entities/journey-event'

export interface JourneyEventRepository {
  listByUser(userId: string): Promise<JourneyEvent[]>
  /**
   * Grava o momento.
   *
   * Idempotente por (tipo, origem, dia): desmarcar e remarcar o último hábito
   * do dia não pode gerar três "dia concluído". Regravar atualiza a linha
   * existente em vez de criar outra.
   */
  record(input: NewJourneyEventInput): Promise<JourneyEvent>
}
