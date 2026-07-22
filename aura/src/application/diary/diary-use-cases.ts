import type { DiaryRepository } from '@/domain/repositories/diary-repository'
import { DiaryRules, type DiaryEntry } from '@/domain/entities/diary'

/**
 * Casos de uso de Diário. Validam a entrada e delegam a persistência ao port.
 */
export function createDiaryUseCases(repo: DiaryRepository) {
  return {
    list(userId: string): Promise<DiaryEntry[]> {
      return repo.listByUser(userId)
    },

    async create(userId: string, content: string): Promise<DiaryEntry> {
      if (!DiaryRules.isValid(content)) {
        throw new Error('Escreva algo antes de salvar.')
      }
      return repo.create(userId, { content: content.trim() })
    },

    remove(id: string): Promise<void> {
      return repo.remove(id)
    },
  }
}

export type DiaryUseCases = ReturnType<typeof createDiaryUseCases>
