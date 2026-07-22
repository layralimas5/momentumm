import type { DiaryRepository } from '@/domain/repositories/diary-repository'
import type { DiaryEntry, NewDiaryEntry } from '@/domain/entities/diary'

/**
 * Repositório de Diário em memória — modo demo, sem Supabase. Não persiste
 * entre reloads. Começa vazio: a estante do diário é construída pela usuária.
 */
export class InMemoryDiaryRepository implements DiaryRepository {
  private entries: DiaryEntry[]

  constructor(seed: DiaryEntry[] = []) {
    this.entries = [...seed]
  }

  async listByUser(userId: string): Promise<DiaryEntry[]> {
    return this.entries
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async create(userId: string, data: NewDiaryEntry): Promise<DiaryEntry> {
    const entry: DiaryEntry = {
      id: crypto.randomUUID(),
      userId,
      content: data.content.trim(),
      createdAt: new Date().toISOString(),
    }
    this.entries = [entry, ...this.entries]
    return entry
  }

  async remove(id: string): Promise<void> {
    this.entries = this.entries.filter((e) => e.id !== id)
  }
}
