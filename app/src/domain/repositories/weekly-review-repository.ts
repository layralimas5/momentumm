import type { DayKey } from '@/domain/entities/day'
import type { WeeklyReview, WeeklyReviewDraft } from '@/domain/entities/weekly-review'

export interface WeeklyReviewRepository {
  listByUser(userId: string): Promise<WeeklyReview[]>
  /**
   * Um review por semana: salvar de novo atualiza o da semana em vez de criar
   * outro. É o que permite fechar o app no meio e voltar depois.
   */
  save(userId: string, weekStart: DayKey, draft: WeeklyReviewDraft): Promise<WeeklyReview>
}
