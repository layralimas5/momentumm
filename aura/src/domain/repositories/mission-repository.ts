import type { DayKey } from '@/domain/entities/day'

/**
 * Port do repositório de Missões. Guarda só as conclusões — o conteúdo da missão
 * é derivado do dia, não persistido. Regra de dependência apontando pra dentro.
 */
export interface MissionRepository {
  /** Dias em que a missão foi concluída (YYYY-MM-DD), crescentes. */
  listCompletedDates(userId: string): Promise<DayKey[]>
  /** Marca ou desmarca a missão de um dia. Idempotente. */
  setDone(userId: string, day: DayKey, done: boolean): Promise<void>
}
