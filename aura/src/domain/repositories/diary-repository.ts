import type { DiaryEntry, NewDiaryEntry } from '@/domain/entities/diary'

/**
 * Port do repositório de Diário. Regra de dependência aponta pra dentro:
 * a aplicação conhece só esta interface, não o adapter concreto.
 */
export interface DiaryRepository {
  listByUser(userId: string): Promise<DiaryEntry[]>
  create(userId: string, data: NewDiaryEntry): Promise<DiaryEntry>
  remove(id: string): Promise<void>
}
