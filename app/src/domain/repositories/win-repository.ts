import type { NewWinInput, Win } from '@/domain/entities/win'

export interface WinRepository {
  listByUser(userId: string): Promise<Win[]>
  /** Uma vitória por dia: escrever de novo reescreve a do dia. */
  save(input: NewWinInput): Promise<Win>
}
